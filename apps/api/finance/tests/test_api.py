from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import importlib

from apps.api.auth import get_current_user, require_admin
from apps.api.finance import router as finance_router
from apps.api.finance.models import InvoiceRecord, InvoiceStatus, WebhookEventRecord


def _make_app():
    app = FastAPI()
    app.include_router(finance_router)

    app.dependency_overrides[get_current_user] = lambda: {"uid": "u1", "role": "carrier"}
    app.dependency_overrides[require_admin] = lambda: {"uid": "admin", "role": "admin"}
    return app


def _invoice(invoice_id: str, status: InvoiceStatus = InvoiceStatus.ISSUED) -> InvoiceRecord:
    now = 1_700_000_000.0
    return InvoiceRecord(
        invoice_id=invoice_id,
        invoice_number=f"INV-{invoice_id}",
        load_id="LD-1",
        issuer_uid="u1",
        issuer_role="carrier",
        payer_uid="u2",
        payer_role="shipper",
        status=status,
        amount_total=100.0,
        amount_paid=0.0,
        currency="USD",
        due_date=now + 86400.0,
        issued_at=now,
        sent_at=None,
        paid_at=None,
        overdue_at=None,
        voided_at=None,
        factoring_enabled=False,
        factoring_provider=None,
        factoring_submission_id=None,
        attachments=[],
        notes=None,
        created_at=now,
        updated_at=now,
        metadata={},
    )


def test_get_invoices_list(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    monkeypatch.setattr(r, "list_invoices_for_user", lambda **kwargs: [_invoice("i1"), _invoice("i2")])
    client = TestClient(_make_app())

    res = client.get("/invoices?limit=10")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert len(body["invoices"]) == 2


def test_send_invoice_action(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    monkeypatch.setattr(r, "send_invoice_with_store", lambda **kwargs: _invoice(kwargs["invoice_id"], status=InvoiceStatus.SENT))
    client = TestClient(_make_app())

    res = client.post("/invoices/inv123/send", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["invoice_id"] == "inv123"
    assert body["status"] == "sent"


def test_eligible_loads_endpoint(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    monkeypatch.setattr(
        r,
        "list_eligible_loads",
        lambda **kwargs: [
            {
                "load_id": "L1",
                "status": "delivered",
                "origin": "arizona",
                "destination": "manhattan",
                "payment_done": False,
            },
            {
                "load_id": "L2",
                "status": "completed",
                "origin": {"city": "Phoenix", "state": "AZ"},
                "destination": {"city": "New York", "state": "NY"},
                "payment_done": False,
            },
        ],
    )

    client = TestClient(_make_app())
    res = client.get("/finance/eligible-loads?limit=10")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert len(body["loads"]) == 2

    assert body["loads"][0]["origin"]["text"] == "arizona"
    assert body["loads"][0]["destination"]["text"] == "manhattan"


def test_create_invoice_denied_for_non_carrier(monkeypatch):
    app = FastAPI()
    app.include_router(finance_router)

    app.dependency_overrides[get_current_user] = lambda: {"uid": "u2", "role": "broker"}

    # create_invoice should not be called if RBAC rejects.
    r = importlib.import_module("apps.api.finance.router")
    monkeypatch.setattr(r, "create_invoice", lambda **kwargs: (_ for _ in ()).throw(AssertionError("should not call")))

    client = TestClient(app)
    res = client.post("/invoices", json={"load_id": "L1", "amount_total": 100.0, "currency": "USD"})
    assert res.status_code == 403


def test_webhook_secret_optional_when_unset(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    # Ensure webhook secret is not required.
    monkeypatch.setattr(r.settings, "FINANCE_WEBHOOK_SECRET", "")
    monkeypatch.setattr(
        r,
        "process_webhook_event",
        lambda provider, req: WebhookEventRecord(
            provider=provider,
            event_id=req["event_id"],
            event_type=req["event_type"],
            received_at=0.0,
            occurred_at=None,
            processed_at=0.0,
            processing_error=None,
            invoice_id=req.get("invoice_id"),
            submission_id=req.get("submission_id"),
            payload=req.get("payload") or {},
        ),
    )

    client = TestClient(_make_app())
    res = client.post("/factoring/webhooks/mock", json={"event_id": "e1", "event_type": "paid"})
    assert res.status_code == 200


def test_webhook_secret_required_when_set(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    monkeypatch.setattr(r.settings, "FINANCE_WEBHOOK_SECRET", "secret")
    monkeypatch.setattr(
        r,
        "process_webhook_event",
        lambda provider, req: WebhookEventRecord(
            provider=provider,
            event_id=req["event_id"],
            event_type=req["event_type"],
            received_at=0.0,
            occurred_at=None,
            processed_at=0.0,
            processing_error=None,
            invoice_id=req.get("invoice_id"),
            submission_id=req.get("submission_id"),
            payload=req.get("payload") or {},
        ),
    )

    client = TestClient(_make_app())

    res = client.post("/factoring/webhooks/mock", json={"event_id": "e1", "event_type": "paid"})
    assert res.status_code == 401

    res2 = client.post(
        "/factoring/webhooks/mock",
        json={"event_id": "e2", "event_type": "paid"},
        headers={"X-Webhook-Secret": "secret"},
    )
    assert res2.status_code == 200
