from __future__ import annotations

from firebase_admin import auth as firebase_auth


class FirebaseTokenService:
    """Thin wrapper around Firebase Admin SDK custom token issuance.

    Architecture:
    - Firebase Auth remains the primary identity system.
    - After successful WebAuthn verification, we issue a Firebase Custom Auth Token.
    """

    @staticmethod
    def create_custom_token(uid: str) -> str:
        token = firebase_auth.create_custom_token(uid)
        return token.decode("utf-8") if isinstance(token, (bytes, bytearray)) else str(token)
