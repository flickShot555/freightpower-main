import firebase_admin
from firebase_admin import credentials, firestore, storage
import os
from typing import Any, Dict
import datetime
import threading

# Initialize Firebase only once
if not firebase_admin._apps:
    # Get the directory where this file is located
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one level to get to the apps folder
    apps_dir = os.path.dirname(current_dir)
    # Path to serviceAccountKey.json
    service_account_path = os.path.join(apps_dir, "serviceAccountKey.json")
    
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'freightpowerai-e90fe.firebasestorage.app'
    })

db = firestore.client()
bucket = storage.bucket()


# --- Firestore safety guard ---
#
# We have seen production/dev crashes like:
#   RuntimeError: can't start new thread
# originating from google-cloud-firestore gRPC internals during batch_get_documents
# (i.e., FirestoreClient.batch_get_documents, which powers db.get_all()).
#
# Root cause is typically excessive concurrent Firestore RPCs (poll loops, SSE,
# multiple overlapping requests, etc.) which can cause gRPC to spawn many metadata
# callback threads until the process hits OS limits.
#
# To reduce risk without changing application behavior, we only throttle
# *concurrent* db.get_all() calls at a global level. This keeps responses the same
# and only adds backpressure under load instead of letting the process crash.

_GET_ALL_CONCURRENCY = int(os.getenv("FIRESTORE_GET_ALL_CONCURRENCY", "32") or "32")
if _GET_ALL_CONCURRENCY < 1:
    _GET_ALL_CONCURRENCY = 1

_get_all_semaphore = threading.BoundedSemaphore(value=_GET_ALL_CONCURRENCY)
_orig_get_all = db.get_all


def _guarded_get_all(*args, **kwargs):
    """A concurrency-limited wrapper for Firestore batch reads (db.get_all).

    Important: db.get_all returns an iterator/generator; we hold the semaphore
    for the duration of iteration so the underlying gRPC call remains protected.
    """

    _get_all_semaphore.acquire()
    try:
        for snap in _orig_get_all(*args, **kwargs):
            yield snap
    finally:
        _get_all_semaphore.release()


# Monkey-patch the client instance so existing call sites are unaffected.
db.get_all = _guarded_get_all


def signed_download_url(
    storage_path: str,
    filename: str | None = None,
    disposition: str = "attachment",
    ttl_seconds: int = 3600,
) -> str | None:
    """Generate a short-lived signed URL for a private object.

    Returns None if signing is not available.
    """
    path = str(storage_path or "").strip()
    if not path:
        return None
    try:
        blob = bucket.blob(path)

        params: Dict[str, str] = {}
        if filename:
            safe = str(filename).replace('"', "").replace("\r", "").replace("\n", "")
            params["response-content-disposition"] = f"{disposition}; filename=\"{safe}\""

        expires = datetime.timedelta(seconds=int(ttl_seconds) if ttl_seconds else 3600)
        return blob.generate_signed_url(
            version="v4",
            expiration=expires,
            method="GET",
            query_parameters=(params or None),
        )
    except Exception:
        return None

# Helper to log actions
def log_action(user_id: str, action: str, details: str, ip: str = None):
    try:
        db.collection("audit_logs").add({
            "user_id": user_id,
            "action": action,
            "details": details,
            "ip_address": ip,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        print(f"Audit log error: {e}")


def record_profile_update(
    user_id: str,
    changes: Dict[str, Any],
    source: str,
    actor_id: str | None = None,
    actor_role: str | None = None,
    fmcsa_verification: Dict[str, Any] | None = None,
):
    """Record a per-user profile update event.

    Stored under: users/{uid}/profile_updates (subcollection)
    """
    try:
        payload: Dict[str, Any] = {
            "source": source,
            "changes": changes,
            "actor_id": actor_id or user_id,
            "actor_role": actor_role,
            "timestamp": firestore.SERVER_TIMESTAMP,
        }
        if fmcsa_verification is not None:
            payload["fmcsa_verification"] = fmcsa_verification

        db.collection("users").document(user_id).collection("profile_updates").add(payload)
    except Exception as e:
        print(f"Profile update history error: {e}")