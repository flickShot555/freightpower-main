from __future__ import annotations

from typing import Any, Dict, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from firebase_admin import auth as firebase_auth

from .auth import get_current_user
from .database import db, log_action
from .services.firebase_token_service import FirebaseTokenService
from .services.webauthn_service import (
    WebAuthnService,
    list_user_webauthn_credentials,
    set_user_biometric_enabled,
    update_webauthn_counter,
    upsert_webauthn_credential,
)
from .settings import settings


router = APIRouter(prefix="/auth/biometric", tags=["Biometric Auth"])


class RegisterOptionsResponse(BaseModel):
    challengeId: str
    options: Dict[str, Any]


class RegisterVerifyRequest(BaseModel):
    challengeId: str
    # WebAuthn attestation response object produced by the browser.
    response: Dict[str, Any]


class LoginOptionsRequest(BaseModel):
    identifier: str  # email or username


class LoginOptionsResponse(BaseModel):
    challengeId: str
    options: Dict[str, Any]


class LoginVerifyRequest(BaseModel):
    challengeId: str
    # WebAuthn assertion response object produced by the browser.
    response: Dict[str, Any]


class LoginVerifyResponse(BaseModel):
    ok: bool = True
    custom_token: str
    uid: str


def _is_https_request(request: Request) -> bool:
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "").lower()
    return proto == "https"


def _is_localhost_origin(origin: str) -> bool:
    try:
        parsed = urlparse(origin)
        return parsed.hostname in {"localhost", "127.0.0.1"}
    except Exception:
        return False


def _assert_https(request: Request) -> None:
    if not bool(getattr(settings, "WEBAUTHN_REQUIRE_HTTPS", True)):
        return

    if _is_https_request(request):
        return

    # Allow local development over http when the API host itself is localhost.
    try:
        host = (request.url.hostname or "").lower()
        if host in {"localhost", "127.0.0.1"}:
            return
    except Exception:
        pass

    try:
        client_host = (getattr(request.client, "host", "") or "").lower()
        if client_host in {"localhost", "127.0.0.1"}:
            return
    except Exception:
        pass

    # Also allow if the browser Origin header is localhost.
    try:
        origin_hdr = (request.headers.get("origin") or "").strip()
        if origin_hdr and _is_localhost_origin(origin_hdr):
            return
    except Exception:
        pass

    # Allow local development over http for localhost only.
    origin = (getattr(settings, "WEBAUTHN_ORIGIN", "") or "").strip()
    if _is_localhost_origin(origin):
        return

    raise HTTPException(status_code=400, detail="HTTPS is required for biometric authentication")


async def _get_user_doc_by_uid(uid: str) -> Dict[str, Any]:
    snap = await __import__("asyncio").to_thread(lambda: db.collection("users").document(uid).get())
    if not snap.exists:
        raise HTTPException(status_code=404, detail="User profile not found")
    return snap.to_dict() or {}


async def _resolve_uid_by_identifier(identifier: str) -> str:
    value = (identifier or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Missing identifier")

    # Heuristic: treat values containing @ as email.
    if "@" in value:
        email = value.lower()
        try:
            user_record = await __import__("asyncio").to_thread(lambda: firebase_auth.get_user_by_email(email))
            return user_record.uid
        except Exception:
            # Fallback to Firestore query if Auth lookup fails.
            def _q() -> Optional[str]:
                snaps = db.collection("users").where("email", "==", email).limit(1).stream()
                for s in snaps:
                    d = s.to_dict() or {}
                    return d.get("uid") or s.id
                return None

            uid = await __import__("asyncio").to_thread(_q)
            if not uid:
                raise HTTPException(status_code=404, detail="User not found")
            return uid

    # Username lookup (if your users schema includes a username field).
    username = value

    def _q_username() -> Optional[str]:
        snaps = db.collection("users").where("username", "==", username).limit(1).stream()
        for s in snaps:
            d = s.to_dict() or {}
            return d.get("uid") or s.id
        return None

    uid = await __import__("asyncio").to_thread(_q_username)
    if not uid:
        raise HTTPException(status_code=404, detail="User not found")
    return uid


@router.post("/register/options", response_model=RegisterOptionsResponse)
async def biometric_register_options(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate WebAuthn registration options for an already-authenticated Firebase user.

    Security:
    - Enforces role + active status on backend.
    - Stores the challenge server-side (replay protection).
    """

    _assert_https(request)

    uid = str(user.get("uid") or user.get("user_id") or "").strip() or str(user.get("id") or "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid authenticated user")

    user_doc = await _get_user_doc_by_uid(uid)
    WebAuthnService.assert_user_allowed_for_biometrics(user_doc)

    email = (user_doc.get("email") or user.get("email") or "").strip().lower()

    creds = await list_user_webauthn_credentials(uid)
    existing_ids = [c.get("credentialId") for c in creds if c.get("revoked") is not True and c.get("credentialId")]

    service = WebAuthnService()
    result = await service.generate_registration_options(uid=uid, email=email or uid, existing_credential_ids=existing_ids)

    log_action(uid, "WEBAUTHN_REGISTER_OPTIONS", "Generated biometric registration options")
    return result


@router.post("/register/verify")
async def biometric_register_verify(
    body: RegisterVerifyRequest,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Verify WebAuthn attestation response and persist the credential."""

    _assert_https(request)

    uid = str(user.get("uid") or "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid authenticated user")

    user_doc = await _get_user_doc_by_uid(uid)
    WebAuthnService.assert_user_allowed_for_biometrics(user_doc)

    service = WebAuthnService()
    verified = await service.verify_registration(
        uid=uid,
        challenge_id=body.challengeId,
        attestation_response=body.response,
    )

    device = (request.headers.get("user-agent") or "").strip()[:200] or "Unknown device"

    await upsert_webauthn_credential(
        uid=uid,
        credential_id=verified["credentialId"],
        public_key=verified["publicKey"],
        counter=int(verified["counter"] or 0),
        device=device,
    )

    await set_user_biometric_enabled(uid=uid, enabled=True)

    log_action(uid, "WEBAUTHN_REGISTER", "Biometric credential registered")
    return {"ok": True}


@router.post("/login/options", response_model=LoginOptionsResponse)
async def biometric_login_options(body: LoginOptionsRequest, request: Request):
    """Generate WebAuthn authentication options for a user identified by email/username."""

    _assert_https(request)

    uid = await _resolve_uid_by_identifier(body.identifier)
    user_doc = await _get_user_doc_by_uid(uid)

    # Strict role/status enforcement
    WebAuthnService.assert_user_allowed_for_biometrics(user_doc)

    if user_doc.get("biometricEnabled") is not True:
        raise HTTPException(status_code=403, detail="Biometric authentication is not enabled")

    creds = await list_user_webauthn_credentials(uid)
    allow_ids = [c.get("credentialId") for c in creds if c.get("revoked") is not True and c.get("credentialId")]
    if not allow_ids:
        raise HTTPException(status_code=403, detail="No active biometric credentials found")

    service = WebAuthnService()
    result = await service.generate_authentication_options(uid=uid, allow_credential_ids=allow_ids)

    log_action(uid, "WEBAUTHN_LOGIN_OPTIONS", "Generated biometric login options")
    return result


@router.post("/login/verify", response_model=LoginVerifyResponse)
async def biometric_login_verify(body: LoginVerifyRequest, request: Request):
    """Verify WebAuthn assertion and issue a Firebase Custom Token."""

    _assert_https(request)

    # Determine UID from challenge record via service consumption.
    # Our WebAuthnService requires uid to consume the challenge; we derive it by reading the challenge.
    # (This stays backend-driven; client never supplies uid directly.)
    service = WebAuthnService()

    # Peek challenge to get uid (best-effort). We use Firestore directly to avoid expanding the service API surface.
    snap = await __import__("asyncio").to_thread(lambda: db.collection("webauthn_challenges").document(body.challengeId).get())
    if not snap.exists:
        raise HTTPException(status_code=400, detail="Invalid or expired challenge")
    challenge_doc = snap.to_dict() or {}
    uid = str(challenge_doc.get("uid") or "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="Challenge missing uid")

    user_doc = await _get_user_doc_by_uid(uid)
    WebAuthnService.assert_user_allowed_for_biometrics(user_doc)

    if user_doc.get("biometricEnabled") is not True:
        raise HTTPException(status_code=403, detail="Biometric authentication is not enabled")

    # Find the referenced credential.
    credential_id = None
    try:
        credential_id = str(body.response.get("id") or "").strip()
    except Exception:
        credential_id = None

    if not credential_id:
        raise HTTPException(status_code=400, detail="Missing credential id in assertion")

    creds = await list_user_webauthn_credentials(uid)
    cred = None
    for c in creds:
        if str(c.get("credentialId") or "") == credential_id:
            cred = c
            break

    if not cred or cred.get("revoked") is True:
        raise HTTPException(status_code=403, detail="Unknown or revoked biometric credential")

    stored_counter = int(cred.get("counter") or 0)

    new_counter = await service.verify_authentication(
        uid=uid,
        challenge_id=body.challengeId,
        assertion_response=body.response,
        authenticator={
            "credentialID": credential_id,
            "credentialPublicKey": cred.get("publicKey"),
            "counter": stored_counter,
        },
    )

    # Replay protection (signature verification handled by SimpleWebAuthn).
    # Reject if authenticator counter did not increase (except legacy non-incrementing authenticators).
    if stored_counter != 0 or new_counter != 0:
        if new_counter <= stored_counter:
            raise HTTPException(status_code=403, detail="Replay detected (authenticator counter)")

    await update_webauthn_counter(uid=uid, credential_id=credential_id, new_counter=new_counter)

    custom_token = FirebaseTokenService.create_custom_token(uid)

    log_action(uid, "WEBAUTHN_LOGIN", "Biometric login successful")
    return LoginVerifyResponse(custom_token=custom_token, uid=uid)
