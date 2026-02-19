from __future__ import annotations

import base64
import os
import re
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

import dotenv

from ..settings import settings


_DATA_URI_RE = re.compile(r"^data:application/pdf[^,]*,(?P<b64>.+)$", re.IGNORECASE | re.DOTALL)

_APPS_DIR = Path(__file__).resolve().parents[2]


def _invoice_emails_enabled() -> bool:
    # Prefer the Settings value (works in prod), but also re-load apps/.env for local dev
    # so toggling ENABLE_INVOICE_EMAILS doesn't require a server restart.
    try:
        dotenv.load_dotenv(dotenv_path=_APPS_DIR / ".env", override=True)
    except Exception:
        pass

    env_flag = (os.getenv("ENABLE_INVOICE_EMAILS", "").strip().lower() == "true")
    return bool(settings.ENABLE_INVOICE_EMAILS) or env_flag


def _decode_pdf_base64(pdf_base64: str) -> bytes:
    s = (pdf_base64 or "").strip()
    if not s:
        raise ValueError("Missing pdf_base64")

    # Accept raw base64 or a full data URI string.
    # jsPDF commonly produces: data:application/pdf;filename=generated.pdf;base64,<b64>
    if s.lower().startswith("data:"):
        m = _DATA_URI_RE.match(s)
        if m:
            s = m.group("b64")
        else:
            # Fallback: split on the first comma and take the payload.
            parts = s.split(",", 1)
            if len(parts) == 2:
                s = parts[1]

    # Remove whitespace/newlines that may be inserted by some encoders.
    s = re.sub(r"\s+", "", s)

    try:
        return base64.b64decode(s, validate=True)
    except Exception:
        # Some base64 encoders add newlines; retry without strict validation.
        try:
            return base64.b64decode(s)
        except Exception as e:
            raise ValueError("Invalid pdf_base64") from e


def send_invoice_email(*, to_email: str, subject: str, body: str, pdf_base64: str, filename: Optional[str] = None) -> None:
    if not _invoice_emails_enabled():
        raise ValueError("Invoice emails are disabled (set ENABLE_INVOICE_EMAILS=true)")

    to_email = (to_email or "").strip()
    subject = (subject or "").strip()
    if not to_email:
        raise ValueError("Missing recipient email")
    if not subject:
        raise ValueError("Missing email subject")

    pdf_bytes = _decode_pdf_base64(pdf_base64)
    name = (filename or "invoice.pdf").strip() or "invoice.pdf"
    if not name.lower().endswith(".pdf"):
        name = f"{name}.pdf"

    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body or "")

    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=name)

    server = settings.SMTP_SERVER
    port = int(settings.SMTP_PORT)
    username = (settings.SMTP_USERNAME or "").strip()
    password = (settings.SMTP_PASSWORD or "").strip()

    with smtplib.SMTP(server, port, timeout=20) as smtp:
        smtp.ehlo()
        # Most SMTP providers require STARTTLS on 587.
        try:
            smtp.starttls()
            smtp.ehlo()
        except Exception:
            # If STARTTLS isn't supported, continue (some servers use implicit TLS elsewhere).
            pass

        if username and password:
            smtp.login(username, password)

        smtp.send_message(msg)


def send_invoice_notification_email(*, to_email: str, subject: str, body: str) -> None:
    """Send a lightweight invoice notification email (no attachment).

    This is used for payer portal notifications on invoice send.
    Best-effort: if ENABLE_INVOICE_EMAILS is disabled, it becomes a no-op.
    """
    if not _invoice_emails_enabled():
        return

    to_email = (to_email or "").strip()
    subject = (subject or "").strip()
    if not to_email or not subject:
        return

    # Dev-friendly behavior: if SMTP auth isn't configured, don't attempt network.
    username = (settings.SMTP_USERNAME or "").strip()
    password = (settings.SMTP_PASSWORD or "").strip()
    if not username or not password:
        print(f"[DEV] Invoice notification email would be sent to {to_email}")
        print(f"[DEV] Subject: {subject}")
        print(f"[DEV] Body: {body}")
        return

    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body or "")

    server = settings.SMTP_SERVER
    port = int(settings.SMTP_PORT)

    with smtplib.SMTP(server, port, timeout=20) as smtp:
        smtp.ehlo()
        try:
            smtp.starttls()
            smtp.ehlo()
        except Exception:
            pass

        smtp.login(username, password)
        smtp.send_message(msg)
