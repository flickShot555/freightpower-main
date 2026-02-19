from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pytest

from apps.api.finance.models import InvoiceCreateRequest, InvoiceRecord, InvoiceStatus
from apps.api.finance import repo
from apps.api.storage import ResponseStore


@dataclass
class _Snap:
    id: str
    _data: Optional[Dict[str, Any]]

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> Dict[str, Any]:
        return dict(self._data or {})


class _DocRef:
    def __init__(self, col: "_Collection", doc_id: str):
        self._col = col
        self.id = doc_id

    def get(self, transaction=None):
        _ = transaction
        return _Snap(self.id, self._col._docs.get(self.id))

    def set(self, data: Dict[str, Any], merge: bool = False):
        if not merge or self.id not in self._col._docs:
            self._col._docs[self.id] = dict(data)
            return
        merged = dict(self._col._docs[self.id])
        merged.update(dict(data))
        self._col._docs[self.id] = merged


class _Query:
    def __init__(self, col: "_Collection", filters: List[Tuple[str, str, Any]]):
        self._col = col
        self._filters = filters
        self._limit: Optional[int] = None

    def where(self, field: str, op: str, value: Any):
        return _Query(self._col, [*self._filters, (field, op, value)])

    def limit(self, n: int):
        self._limit = int(n)
        return self

    def stream(self) -> Iterable[_Snap]:
        out: List[_Snap] = []
        for doc_id, data in self._col._docs.items():
            if self._matches(data):
                out.append(_Snap(doc_id, data))
        if self._limit is not None:
            out = out[: self._limit]
        return out

    def _matches(self, data: Dict[str, Any]) -> bool:
        for field, op, value in self._filters:
            if op != "==":
                raise AssertionError(f"Unsupported op in fake db: {op}")
            if data.get(field) != value:
                return False
        return True


class _Collection(_Query):
    def __init__(self, docs: Dict[str, Dict[str, Any]]):
        self._docs = docs
        super().__init__(self, [])

    def document(self, doc_id: str) -> _DocRef:
        return _DocRef(self, doc_id)


class _FakeDB:
    def __init__(self):
        self._collections: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def collection(self, name: str) -> _Collection:
        docs = self._collections.setdefault(name, {})
        return _Collection(docs)


@pytest.fixture()
def store(tmp_path):
    return ResponseStore(base_dir=str(tmp_path))


@pytest.fixture()
def fake_db(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(repo, "db", db)
    return db


def _save_load(store: ResponseStore, load: Dict[str, Any]):
    store.save_load(load)


def test_create_invoice_requires_pod(fake_db, store, monkeypatch):
    # No load-linked POD documents available.
    # This enforces the new policy: POD must come from loads/{load_id}/documents.
    _save_load(
        store,
        {
            "load_id": "L1",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
        },
    )

    # Explicitly ensure the load has no linked documents.
    monkeypatch.setattr(repo, "_load_linked_document_vault_docs", lambda load_id: [])

    req = InvoiceCreateRequest(load_id="L1", amount_total=100.0)
    with pytest.raises(ValueError, match=r"POD"):
        repo.create_invoice(request=req, user={"uid": "carrier1", "role": "carrier"}, store=store)


def test_create_invoice_success_with_load_linked_pod(fake_db, store, monkeypatch):
    _save_load(
        store,
        {
            "load_id": "L2",
            "status": "completed",
            "creator_role": "broker",
            "created_by": "broker1",
            "assigned_carrier": "carrier1",
        },
    )

    monkeypatch.setattr(
        repo,
        "_load_linked_document_vault_docs",
        lambda load_id: [
            {
                "doc_id": "doc-pod-1",
                "kind": "POD",
                "url": "https://example.test/pod.jpg",
                "filename": "pod.jpg",
                "uploaded_at": 1.0,
            }
        ],
    )

    inv = repo.create_invoice(
        request=InvoiceCreateRequest(load_id="L2", amount_total=250.0),
        user={"uid": "carrier1", "role": "carrier"},
        store=store,
    )
    assert inv.load_id == "L2"
    assert inv.status == InvoiceStatus.ISSUED
    assert any((a.kind or "").upper() == "POD" for a in inv.attachments)


def test_create_invoice_prevents_duplicate_per_load(fake_db, store, monkeypatch):
    _save_load(
        store,
        {
            "load_id": "L3",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
        },
    )
    monkeypatch.setattr(
        repo,
        "_load_linked_document_vault_docs",
        lambda load_id: [
            {"doc_id": "doc-pod-3", "kind": "POD", "url": "https://example.test/pod.jpg", "filename": "pod.jpg", "uploaded_at": 1.0}
        ],
    )

    req = InvoiceCreateRequest(load_id="L3", amount_total=99.0)
    repo.create_invoice(request=req, user={"uid": "carrier1", "role": "carrier"}, store=store)

    with pytest.raises(ValueError, match=r"already exists"):
        repo.create_invoice(request=req, user={"uid": "carrier1", "role": "carrier"}, store=store)


def test_invoice_number_unique(fake_db, store, monkeypatch):
    _save_load(
        store,
        {
            "load_id": "LUNIQ",
            "load_number": "FP-ATL-LD-000123",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
        },
    )
    monkeypatch.setattr(
        repo,
        "_load_linked_document_vault_docs",
        lambda load_id: [
            {"doc_id": f"doc-pod-{load_id}", "kind": "POD", "url": "https://example.test/pod.jpg", "filename": "pod.jpg", "uploaded_at": 1.0}
        ],
    )

    inv1 = repo.create_invoice(
        request=InvoiceCreateRequest(load_id="LUNIQ", amount_total=100.0, invoice_number="FP-INV-FP-ATL-LD-000123-UCARR-USHIP-000001"),
        user={"uid": "carrier1", "role": "carrier"},
        store=store,
    )
    assert inv1.invoice_number

    _save_load(
        store,
        {
            "load_id": "LUNIQ2",
            # Intentionally duplicate load_number to validate invoice_number uniqueness enforcement.
            "load_number": "FP-ATL-LD-000123",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
        },
    )

    with pytest.raises(ValueError, match=r"invoice_number must be unique"):
        repo.create_invoice(
            request=InvoiceCreateRequest(load_id="LUNIQ2", amount_total=100.0, invoice_number=inv1.invoice_number),
            user={"uid": "carrier1", "role": "carrier"},
            store=store,
        )


def test_custom_invoice_number_must_include_load_number(fake_db, store, monkeypatch):
    _save_load(
        store,
        {
            "load_id": "LREQ",
            "load_number": "FP-ATL-LD-000200",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
        },
    )
    monkeypatch.setattr(
        repo,
        "_load_linked_document_vault_docs",
        lambda load_id: [
            {"doc_id": f"doc-pod-{load_id}", "kind": "POD", "url": "https://example.test/pod.jpg", "filename": "pod.jpg", "uploaded_at": 1.0}
        ],
    )

    with pytest.raises(ValueError, match=r"must include load_number"):
        repo.create_invoice(
            request=InvoiceCreateRequest(load_id="LREQ", amount_total=100.0, invoice_number="CUSTOM-INV-001"),
            user={"uid": "carrier1", "role": "carrier"},
            store=store,
        )


def test_list_eligible_loads_excludes_invoiced(fake_db, store, monkeypatch):
    _save_load(
        store,
        {
            "load_id": "L4",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
        },
    )
    _save_load(
        store,
        {
            "load_id": "L5",
            "status": "completed",
            "creator_role": "broker",
            "created_by": "broker1",
            "assigned_carrier": "carrier1",
        },
    )
    monkeypatch.setattr(
        repo,
        "_load_linked_document_vault_docs",
        lambda load_id: [
            {"doc_id": f"doc-pod-{load_id}", "kind": "POD", "url": "https://example.test/pod.jpg", "filename": "pod.jpg", "uploaded_at": 1.0}
        ],
    )

    repo.create_invoice(
        request=InvoiceCreateRequest(load_id="L4", amount_total=10.0),
        user={"uid": "carrier1", "role": "carrier"},
        store=store,
    )

    loads = repo.list_eligible_loads(user={"uid": "carrier1", "role": "carrier"}, store=store, limit=50)
    ids = {l["load_id"] for l in loads}
    assert "L4" not in ids
    assert "L5" in ids


def test_send_invoice_requires_pod(monkeypatch, store):
    inv = InvoiceRecord(
        invoice_id="i1",
        invoice_number="INV-1",
        load_id="L6",
        issuer_uid="carrier1",
        issuer_role="carrier",
        payer_uid="shipper1",
        payer_role="shipper",
        status=InvoiceStatus.ISSUED,
        amount_total=10.0,
        amount_paid=0.0,
        currency="USD",
        due_date=None,
        issued_at=0.0,
        sent_at=None,
        paid_at=None,
        overdue_at=None,
        voided_at=None,
        factoring_enabled=False,
        factoring_provider=None,
        factoring_submission_id=None,
        attachments=[],
        notes=None,
        created_at=0.0,
        updated_at=0.0,
        metadata={},
    )

    monkeypatch.setattr(repo, "get_invoice", lambda invoice_id: inv)
    monkeypatch.setattr(repo, "_update_invoice_status", lambda **kwargs: inv)

    # Ensure there are no load-linked docs.
    monkeypatch.setattr(repo, "_load_linked_document_vault_docs", lambda load_id: [])

    # Ensure no POD is available from load or vault.
    _save_load(
        store,
        {
            "load_id": "L6",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
        },
    )

    with pytest.raises(ValueError, match=r"POD"):
        repo.send_invoice_with_store(invoice_id="i1", user={"uid": "carrier1", "role": "carrier"}, store=store)


def test_send_invoice_success_with_load_linked_pod(monkeypatch, store):
    inv = InvoiceRecord(
        invoice_id="i2",
        invoice_number="INV-2",
        load_id="L7",
        issuer_uid="carrier1",
        issuer_role="carrier",
        payer_uid="shipper1",
        payer_role="shipper",
        status=InvoiceStatus.ISSUED,
        amount_total=10.0,
        amount_paid=0.0,
        currency="USD",
        due_date=None,
        issued_at=0.0,
        sent_at=None,
        paid_at=None,
        overdue_at=None,
        voided_at=None,
        factoring_enabled=False,
        factoring_provider=None,
        factoring_submission_id=None,
        attachments=[],
        notes=None,
        created_at=0.0,
        updated_at=0.0,
        metadata={},
    )

    monkeypatch.setattr(repo, "get_invoice", lambda invoice_id: inv)

    updated: Dict[str, Any] = {}

    def _update(**kwargs):
        updated.update(kwargs)
        return inv

    monkeypatch.setattr(repo, "_update_invoice_status", _update)
    monkeypatch.setattr(
        repo,
        "_load_linked_document_vault_docs",
        lambda load_id: [
            {
                "doc_id": "doc-pod-7",
                "kind": "POD",
                "url": "https://example.test/pod.jpg",
                "filename": "pod.jpg",
                "uploaded_at": 1.0,
            }
        ],
    )

    _save_load(
        store,
        {
            "load_id": "L7",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
            "payment_terms": "NET45",
        },
    )

    monkeypatch.setattr(repo, "_now", lambda: 1000.0)

    repo.send_invoice_with_store(invoice_id="i2", user={"uid": "carrier1", "role": "carrier"}, store=store)
    assert updated.get("new_status") == InvoiceStatus.SENT
    atts = updated.get("extra", {}).get("attachments") or []
    assert any(str(a.get("kind") or "").upper() == "POD" for a in atts)

    extra = updated.get("extra", {}) or {}
    assert extra.get("due_date") == pytest.approx(1000.0 + 45 * 86400.0)
    md = extra.get("metadata", {}) or {}
    assert md.get("terms_days") == 45


def test_invoice_creation_uses_normalized_payer_fields(fake_db, store, monkeypatch):
    # Creator is a carrier (legacy payer resolution would fail), but normalized payer fields exist.
    _save_load(
        store,
        {
            "load_id": "LN1",
            "status": "delivered",
            "creator_role": "carrier",
            "created_by": "carrier_creator",
            "assigned_carrier": "carrier1",
            "payer_uid": "shipper1",
            "payer_role": "shipper",
        },
    )

    monkeypatch.setattr(
        repo,
        "_load_linked_document_vault_docs",
        lambda load_id: [
            {"doc_id": "pod1", "kind": "POD", "url": "https://example.test/pod.jpg", "filename": "pod.jpg", "uploaded_at": 1.0}
        ],
    )

    inv = repo.create_invoice(
        request=InvoiceCreateRequest(load_id="LN1", amount_total=100.0),
        user={"uid": "carrier1", "role": "carrier"},
        store=store,
    )
    assert inv.payer_uid == "shipper1"
    assert inv.payer_role == "shipper"


def test_send_invoice_rejects_invalid_terms(monkeypatch, store):
    inv = InvoiceRecord(
        invoice_id="i3",
        invoice_number="INV-3",
        load_id="L8",
        issuer_uid="carrier1",
        issuer_role="carrier",
        payer_uid="shipper1",
        payer_role="shipper",
        status=InvoiceStatus.ISSUED,
        amount_total=10.0,
        amount_paid=0.0,
        currency="USD",
        due_date=None,
        issued_at=0.0,
        sent_at=None,
        paid_at=None,
        overdue_at=None,
        voided_at=None,
        factoring_enabled=False,
        factoring_provider=None,
        factoring_submission_id=None,
        attachments=[],
        notes=None,
        created_at=0.0,
        updated_at=0.0,
        metadata={},
    )

    monkeypatch.setattr(repo, "get_invoice", lambda invoice_id: inv)
    monkeypatch.setattr(repo, "_update_invoice_status", lambda **kwargs: inv)
    monkeypatch.setattr(
        repo,
        "_load_linked_document_vault_docs",
        lambda load_id: [
            {
                "doc_id": "doc-pod-8",
                "kind": "POD",
                "url": "https://example.test/pod.jpg",
                "filename": "pod.jpg",
                "uploaded_at": 1.0,
            }
        ],
    )

    _save_load(
        store,
        {
            "load_id": "L8",
            "status": "delivered",
            "creator_role": "shipper",
            "created_by": "shipper1",
            "assigned_carrier": "carrier1",
            "payment_terms": "NET0",
        },
    )

    with pytest.raises(ValueError, match=r"between 1 and 120"):
        repo.send_invoice_with_store(invoice_id="i3", user={"uid": "carrier1", "role": "carrier"}, store=store)
