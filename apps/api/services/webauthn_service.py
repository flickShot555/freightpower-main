from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional, Sequence
from urllib.parse import urlparse

from fastapi import HTTPException
from firebase_admin import firestore

from ..database import db
from ..settings import settings


_ALLOWED_BIOMETRIC_ROLES = {"driver", "carrier"}


@dataclass(frozen=True)
class WebAuthnConfig:
    rp_name: str
    rp_id: str
    origin: str
    require_https: bool
    challenge_ttl_s: int


class WebAuthnService:
    """Backend-driven WebAuthn service.

    Key properties:
    - All verification happens on the backend.
    - No biometric data (fingerprint/face images) is accessed or stored.
    - Strict RP ID / Origin validation is enforced via SimpleWebAuthn.
    - Challenges are persisted server-side to prevent replay.

    Implementation note:
    This Python backend invokes @simplewebauthn/server through a small Node CLI
    in `apps/api/webauthn_node/cli.mjs`.
    """

    def __init__(self) -> None:
        self._cfg = self._load_config()
        self._node_cli_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "webauthn_node",
            "cli.mjs",
        )
        self._node_cli_path = os.path.abspath(self._node_cli_path)
        # Repo root where package.json and node_modules live.
        self._repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

    @staticmethod
    def _load_config() -> WebAuthnConfig:
        rp_id = (getattr(settings, "WEBAUTHN_RP_ID", "") or "").strip()
        origin = (getattr(settings, "WEBAUTHN_ORIGIN", "") or "").strip()
        rp_name = (getattr(settings, "WEBAUTHN_RP_NAME", "FreightPower") or "FreightPower").strip()
        require_https = bool(getattr(settings, "WEBAUTHN_REQUIRE_HTTPS", True))
        ttl = int(getattr(settings, "WEBAUTHN_CHALLENGE_TTL_SECONDS", 300) or 300)

        # Dev convenience: if not explicitly configured, infer from FRONTEND_BASE_URL
        # but only when it is localhost (never auto-configure public domains).
        if not origin:
            fb = (getattr(settings, "FRONTEND_BASE_URL", "") or "").strip()
            parsed_fb = urlparse(fb) if fb else None
            if parsed_fb and parsed_fb.hostname in {"localhost", "127.0.0.1"}:
                origin = fb

        if not rp_id and origin:
            parsed_origin = urlparse(origin)
            if parsed_origin.hostname in {"localhost", "127.0.0.1"}:
                rp_id = parsed_origin.hostname or "localhost"

        if not rp_id or not origin:
            raise RuntimeError(
                "WebAuthn is not configured. Set WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN in apps/.env"
            )

        if require_https:
            parsed = urlparse(origin)
            is_localhost = parsed.hostname in {"localhost", "127.0.0.1"}
            if parsed.scheme != "https" and not is_localhost:
                raise RuntimeError("WEBAUTHN_ORIGIN must be https when WEBAUTHN_REQUIRE_HTTPS=true")

        return WebAuthnConfig(
            rp_name=rp_name,
            rp_id=rp_id,
            origin=origin,
            require_https=require_https,
            challenge_ttl_s=max(60, min(ttl, 1800)),
        )

    @staticmethod
    def _user_id_base64url(uid: str) -> str:
        """Generate a stable WebAuthn user handle.

        @simplewebauthn/server no longer accepts string values for userID.
        We derive a deterministic 32-byte user handle from the uid using SHA-256
        and encode it as base64url for transport to the Node helper.
        """

        uid_norm = str(uid or "").strip()
        digest = hashlib.sha256(uid_norm.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

    # ---------------------------------------------------------------------
    # Role/status enforcement helpers
    # ---------------------------------------------------------------------

    @staticmethod
    def _normalize_user_status(user_doc: Dict[str, Any]) -> str:
        """Cope with legacy schema.

        New target schema has `status: active|disabled`.
        Existing schema in this codebase often uses `is_active: bool`.
        """

        status = str(user_doc.get("status") or "").strip().lower()
        if status in {"active", "disabled"}:
            return status

        # Legacy fallback: treat is_active True as active.
        if user_doc.get("is_active") is True:
            return "active"
        if user_doc.get("is_active") is False:
            return "disabled"

        # Default to disabled if unknown (secure by default)
        return "disabled"

    @staticmethod
    def assert_user_allowed_for_biometrics(user_doc: Dict[str, Any]) -> None:
        role = str(user_doc.get("role") or "").strip().lower()
        if role not in _ALLOWED_BIOMETRIC_ROLES:
            raise HTTPException(status_code=403, detail="Biometric authentication is not allowed for this role")

        if WebAuthnService._normalize_user_status(user_doc) != "active":
            raise HTTPException(status_code=403, detail="Account is not active")

    # ---------------------------------------------------------------------
    # Node CLI invocations
    # ---------------------------------------------------------------------

    async def _run_node(self, *, command: str, payload: Dict[str, Any], timeout_s: float = 12.0) -> Dict[str, Any]:
        req = {"command": command, "payload": payload}
        input_bytes = json.dumps(req).encode("utf-8")

        def _run() -> Dict[str, Any]:
            import subprocess

            try:
                proc = subprocess.run(
                    ["node", self._node_cli_path],
                    input=input_bytes,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    cwd=self._repo_root,
                    timeout=timeout_s,
                    check=False,
                )
            except FileNotFoundError:
                raise RuntimeError(
                    "Node.js is required for WebAuthn (@simplewebauthn/server). Install Node 18+ and ensure `node` is on PATH."
                )

            out = (proc.stdout or b"").decode("utf-8", errors="replace").strip() or "{}"
            try:
                data = json.loads(out)
            except Exception:
                raise RuntimeError(f"WebAuthn helper returned non-JSON output (exit={proc.returncode}): {out[:400]}")

            if proc.returncode != 0:
                err = data.get("error") or "WebAuthn helper error"
                details = data.get("details")
                raise RuntimeError(f"{err}: {details}")

            return data

        return await asyncio.to_thread(_run)

    # ---------------------------------------------------------------------
    # Challenge persistence
    # ---------------------------------------------------------------------

    def _challenge_ref(self, challenge_id: str):
        return db.collection("webauthn_challenges").document(challenge_id)

    async def _store_challenge(self, *, challenge_id: str, uid: str, kind: str, challenge: str) -> None:
        now = int(time.time())
        expires_at = now + int(self._cfg.challenge_ttl_s)

        doc = {
            "challenge_id": challenge_id,
            "uid": uid,
            "kind": kind,  # "registration" | "authentication"
            "challenge": challenge,
            "origin": self._cfg.origin,
            "rp_id": self._cfg.rp_id,
            "created_at": now,
            "expires_at": expires_at,
            "used_at": None,
        }

        await asyncio.to_thread(lambda: self._challenge_ref(challenge_id).set(doc, merge=False))

    async def _consume_challenge(self, *, challenge_id: str, uid: str, kind: str) -> Dict[str, Any]:
        snap = await asyncio.to_thread(lambda: self._challenge_ref(challenge_id).get())
        if not snap.exists:
            raise HTTPException(status_code=400, detail="Invalid or expired challenge")

        doc = snap.to_dict() or {}
        if doc.get("uid") != uid or doc.get("kind") != kind:
            raise HTTPException(status_code=400, detail="Challenge mismatch")

        if doc.get("used_at"):
            raise HTTPException(status_code=400, detail="Challenge already used")

        if int(doc.get("expires_at") or 0) < int(time.time()):
            raise HTTPException(status_code=400, detail="Challenge expired")

        # Mark used immediately to reduce replay races (best-effort).
        try:
            await asyncio.to_thread(lambda: self._challenge_ref(challenge_id).update({"used_at": int(time.time())}))
        except Exception:
            # If update fails, verification may still proceed; final verification will still be strict.
            pass

        return doc

    # ---------------------------------------------------------------------
    # Public operations
    # ---------------------------------------------------------------------

    async def generate_registration_options(
        self,
        *,
        uid: str,
        email: str,
        existing_credential_ids: Sequence[str],
    ) -> Dict[str, Any]:
        res = await self._run_node(
            command="generateRegistrationOptions",
            payload={
                "rpName": self._cfg.rp_name,
                "rpID": self._cfg.rp_id,
                "userIDBase64Url": self._user_id_base64url(uid),
                "userName": (email or uid),
                "userDisplayName": (email or uid),
                "excludeCredentialIDs": list(existing_credential_ids or []),
            },
        )

        options = res.get("options") or {}
        challenge = options.get("challenge")
        if not isinstance(challenge, str) or not challenge:
            raise HTTPException(status_code=500, detail="Failed to generate WebAuthn registration challenge")

        challenge_id = str(uuid.uuid4())
        await self._store_challenge(challenge_id=challenge_id, uid=uid, kind="registration", challenge=challenge)

        return {"challengeId": challenge_id, "options": options}

    async def verify_registration(
        self,
        *,
        uid: str,
        challenge_id: str,
        attestation_response: Dict[str, Any],
    ) -> Dict[str, Any]:
        challenge_doc = await self._consume_challenge(challenge_id=challenge_id, uid=uid, kind="registration")

        res = await self._run_node(
            command="verifyRegistrationResponse",
            payload={
                "response": attestation_response,
                "expectedChallenge": challenge_doc.get("challenge"),
                "expectedOrigin": self._cfg.origin,
                "expectedRPID": self._cfg.rp_id,
            },
            timeout_s=18.0,
        )

        if res.get("verified") is not True:
            raise HTTPException(status_code=400, detail="WebAuthn registration verification failed")

        info = res.get("registrationInfo") or {}
        credential_id = info.get("credentialID")
        public_key = info.get("credentialPublicKey")
        counter = int(info.get("counter") or 0)
        if not credential_id or not public_key:
            raise HTTPException(status_code=500, detail="WebAuthn registration missing credential data")

        # Best-effort cleanup: challenge is single-use.
        try:
            await asyncio.to_thread(lambda: self._challenge_ref(challenge_id).delete())
        except Exception:
            pass

        return {
            "credentialId": str(credential_id),
            "publicKey": str(public_key),
            "counter": counter,
        }

    async def generate_authentication_options(
        self,
        *,
        uid: str,
        allow_credential_ids: Sequence[str],
    ) -> Dict[str, Any]:
        res = await self._run_node(
            command="generateAuthenticationOptions",
            payload={
                "rpID": self._cfg.rp_id,
                "allowCredentialIDs": list(allow_credential_ids or []),
            },
        )

        options = res.get("options") or {}
        challenge = options.get("challenge")
        if not isinstance(challenge, str) or not challenge:
            raise HTTPException(status_code=500, detail="Failed to generate WebAuthn authentication challenge")

        challenge_id = str(uuid.uuid4())
        await self._store_challenge(challenge_id=challenge_id, uid=uid, kind="authentication", challenge=challenge)

        return {"challengeId": challenge_id, "options": options}

    async def verify_authentication(
        self,
        *,
        uid: str,
        challenge_id: str,
        assertion_response: Dict[str, Any],
        authenticator: Dict[str, Any],
    ) -> int:
        challenge_doc = await self._consume_challenge(challenge_id=challenge_id, uid=uid, kind="authentication")

        res = await self._run_node(
            command="verifyAuthenticationResponse",
            payload={
                "response": assertion_response,
                "expectedChallenge": challenge_doc.get("challenge"),
                "expectedOrigin": self._cfg.origin,
                "expectedRPID": self._cfg.rp_id,
                "authenticator": authenticator,
            },
            timeout_s=18.0,
        )

        if res.get("verified") is not True:
            raise HTTPException(status_code=400, detail="WebAuthn authentication verification failed")

        info = res.get("authenticationInfo") or {}
        new_counter = int(info.get("newCounter") or 0)

        # Best-effort cleanup: challenge is single-use.
        try:
            await asyncio.to_thread(lambda: self._challenge_ref(challenge_id).delete())
        except Exception:
            pass

        return new_counter


async def list_user_webauthn_credentials(uid: str) -> list[Dict[str, Any]]:
    def _fetch() -> list[Dict[str, Any]]:
        snaps = (
            db.collection("webauthn_credentials")
            .where("uid", "==", uid)
            .stream()
        )
        out: list[Dict[str, Any]] = []
        for s in snaps:
            d = s.to_dict() or {}
            d["_doc_id"] = s.id
            out.append(d)
        return out

    return await asyncio.to_thread(_fetch)


async def upsert_webauthn_credential(
    *,
    uid: str,
    credential_id: str,
    public_key: str,
    counter: int,
    device: str,
) -> None:
    """Persist credential.

    We store credentials in a top-level collection to support efficient queries
    and allow multiple devices per user.
    """

    def _write() -> None:
        # Use deterministic doc id to prevent duplicates across retries.
        doc_id = f"{uid}:{credential_id}"
        ref = db.collection("webauthn_credentials").document(doc_id)
        ref.set(
            {
                "uid": uid,
                "credentialId": credential_id,
                "publicKey": public_key,
                "counter": int(counter or 0),
                "device": device,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "revoked": False,
            },
            merge=True,
        )

    await asyncio.to_thread(_write)


async def update_webauthn_counter(*, uid: str, credential_id: str, new_counter: int) -> None:
    def _update() -> None:
        doc_id = f"{uid}:{credential_id}"
        db.collection("webauthn_credentials").document(doc_id).update(
            {
                "counter": int(new_counter or 0),
                "lastUsedAt": firestore.SERVER_TIMESTAMP,
            }
        )

    await asyncio.to_thread(_update)


async def set_user_biometric_enabled(*, uid: str, enabled: bool) -> None:
    def _update() -> None:
        db.collection("users").document(uid).set(
            {
                "biometricEnabled": bool(enabled),
                "biometricEnabledAt": firestore.SERVER_TIMESTAMP if enabled else None,
            },
            merge=True,
        )

    await asyncio.to_thread(_update)
