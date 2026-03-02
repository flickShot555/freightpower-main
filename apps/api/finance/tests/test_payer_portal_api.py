from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import importlib

from apps.api.auth import get_current_user, require_admin
from apps.api.finance import router as finance_router
from apps.api.finance.models import InvoiceRecord, InvoiceStatus


def _make_app(user_provider):
    app = FastAPI()
    app.include_router(finance_router)
    app.dependency_overrides[get_current_user] = user_provider
    app.dependency_overrides[require_admin] = lambda: {"uid": "admin", "role": "admin"}
    return app


def _invoice(invoice_id: str, *, payer_uid: str = "u2", status: InvoiceStatus = InvoiceStatus.ISSUED) -> InvoiceRecord:
    now = 1_700_000_000.0
    return InvoiceRecord(
        invoice_id=invoice_id,
        invoice_number=f"INV-{invoice_id}",
        load_id="LD-1",
        load_number="FP-ATL-LD-000001",
        issuer_uid="u1",
        issuer_role="carrier",
        payer_uid=payer_uid,
        payer_role="shipper",
        status=status,
        amount_total=100.0,
        amount_paid=0.0,
        currency="USD",
        due_date=now + 86400.0,
        issued_at=now,
        sent_at=(now + 10 if status == InvoiceStatus.SENT else None),
        disputed_at=None,
        disputed_by_uid=None,
        dispute_reason=None,
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
        metadata={"issuer_company_name": "Test Carrier LLC"},
    )


def test_carrier_send_then_payer_can_list(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    inv_state = {"inv": _invoice("i1", payer_uid="u2", status=InvoiceStatus.ISSUED)}

    def _send_invoice_with_store(**kwargs):
        assert kwargs["invoice_id"] == "i1"
        inv = inv_state["inv"]
        inv = inv.model_copy(update={"status": InvoiceStatus.SENT, "sent_at": 1_700_000_010.0})
        inv_state["inv"] = inv
        return inv

    def _list_invoices_for_payer(**kwargs):
        user = kwargs["user"]
        assert user["uid"]
        inv = inv_state["inv"]
        if inv.payer_uid != user["uid"]:
            return []
        return [inv]

    # Keep send deterministic: don't attempt any email notification.
    monkeypatch.setattr(r.settings, "ENABLE_INVOICE_EMAILS", False)
    monkeypatch.setattr(r, "send_invoice_with_store", _send_invoice_with_store)
    monkeypatch.setattr(r, "list_invoices_for_payer", _list_invoices_for_payer)

    carrier_client = TestClient(_make_app(lambda: {"uid": "u1", "role": "carrier"}))
    res = carrier_client.post("/invoices/i1/send", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["invoice_id"] == "i1"
    assert body["status"] == "sent"

    payer_client = TestClient(_make_app(lambda: {"uid": "u2", "role": "shipper"}))
    res2 = payer_client.get("/payer/invoices?limit=50")
    assert res2.status_code == 200
    body2 = res2.json()
    assert body2["total"] == 1
    assert body2["invoices"][0]["invoice_id"] == "i1"
    assert body2["invoices"][0]["status"] == "sent"


def test_payer_cannot_get_other_payer_invoice(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    monkeypatch.setattr(r, "get_invoice", lambda invoice_id: _invoice(invoice_id, payer_uid="someone_else", status=InvoiceStatus.SENT))

    payer_client = TestClient(_make_app(lambda: {"uid": "u2", "role": "shipper"}))
    res = payer_client.get("/payer/invoices/i1")
    assert res.status_code == 403


def test_payer_can_dispute_invoice(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    def _dispute_invoice(**kwargs):
        user = kwargs["user"]
        assert user["role"] in {"shipper", "broker", "admin", "super_admin"}
        assert kwargs["reason"]
        inv = _invoice(kwargs["invoice_id"], payer_uid=user["uid"], status=InvoiceStatus.SENT)
        return inv.model_copy(update={"status": InvoiceStatus.DISPUTED, "dispute_reason": kwargs["reason"]})

    monkeypatch.setattr(r, "dispute_invoice", _dispute_invoice)

    payer_client = TestClient(_make_app(lambda: {"uid": "u2", "role": "shipper"}))
    res = payer_client.post("/payer/invoices/i1/dispute", json={"reason": "Amount mismatch"})
    assert res.status_code == 200
    body = res.json()
    assert body["invoice_id"] == "i1"
    assert body["status"] == "disputed"


def test_payer_can_download_invoice_package_zip(monkeypatch):
    r = importlib.import_module("apps.api.finance.router")

    def _build_invoice_package_zip(**kwargs):
        # Must be callable for payer access.
        user = kwargs["user"]
        assert user["uid"] == "u2"
        return (b"ZIPBYTES", "pkg.zip")

    monkeypatch.setattr(r, "build_invoice_package_zip", _build_invoice_package_zip)

    payer_client = TestClient(_make_app(lambda: {"uid": "u2", "role": "shipper"}))
    res = payer_client.get("/invoices/i1/package.zip")
    assert res.status_code == 200
    assert res.headers.get("content-type", "").startswith("application/zip")
    assert res.content == b"ZIPBYTES"
