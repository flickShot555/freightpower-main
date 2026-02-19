from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional

import pytest

from apps.api import load_documents


@dataclass
class _Snap:
    id: str
    _data: Optional[Dict[str, Any]]

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> Dict[str, Any]:
        return dict(self._data or {})


class _Collection:
    def __init__(self, db: "_FakeDB", path: str):
        self._db = db
        self._path = path

    def document(self, doc_id: str) -> "_DocRef":
        return _DocRef(self._db, f"{self._path}/{doc_id}")

    def stream(self) -> Iterable[_Snap]:
        docs = self._db._collections.get(self._path, {})
        return [_Snap(doc_id, data) for doc_id, data in docs.items()]


class _DocRef:
    def __init__(self, db: "_FakeDB", path: str):
        self._db = db
        self._path = path

    @property
    def id(self) -> str:
        return self._path.split("/")[-1]

    def get(self, transaction=None):
        _ = transaction
        col_path, doc_id = self._split()
        return _Snap(doc_id, self._db._collections.get(col_path, {}).get(doc_id))

    def set(self, data: Dict[str, Any], merge: bool = False):
        col_path, doc_id = self._split()
        col = self._db._collections.setdefault(col_path, {})
        if not merge or doc_id not in col:
            col[doc_id] = dict(data)
            return
        merged = dict(col[doc_id])
        merged.update(dict(data))
        col[doc_id] = merged

    def collection(self, name: str) -> _Collection:
        return _Collection(self._db, f"{self._path}/{name}")

    def _split(self):
        parts = self._path.split("/")
        col_path = "/".join(parts[:-1])
        doc_id = parts[-1]
        return col_path, doc_id


class _FakeDB:
    def __init__(self):
        # map collection_path -> {doc_id -> doc_data}
        self._collections: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def collection(self, name: str) -> _Collection:
        return _Collection(self, name)


class _Blob:
    def __init__(self, bucket: "_FakeBucket", path: str):
        self._bucket = bucket
        self._path = path
        self.public_url = f"https://storage.test/{path}"

    def upload_from_string(self, data: bytes, content_type: str = "application/octet-stream"):
        self._bucket._objects[self._path] = {"data": data, "content_type": content_type}

    def make_public(self):
        return


class _FakeBucket:
    def __init__(self):
        self._objects: Dict[str, Dict[str, Any]] = {}

    def blob(self, path: str) -> _Blob:
        return _Blob(self, path)


@pytest.fixture()
def fake_db(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(load_documents, "db", db)
    return db


@pytest.fixture()
def fake_bucket(monkeypatch):
    b = _FakeBucket()
    monkeypatch.setattr(load_documents, "bucket", b)
    return b


def test_generate_rate_confirmation_pdf_bytes():
    pytest.importorskip("fitz")

    pdf = load_documents.generate_rate_confirmation_pdf_bytes(
        load={"load_id": "L1", "load_number": "FP-ATL-LD-000001", "origin": "ATL", "destination": "MIA"},
        accepted_offer={"carrier_name": "CarrierCo", "carrier_id": "c1", "rate": 1234.56},
        shipper={"uid": "s1", "role": "shipper", "email": "shipper@test", "company_name": "Shipper Inc"},
    )
    assert isinstance(pdf, (bytes, bytearray))
    assert bytes(pdf).startswith(b"%PDF")


def test_ensure_rate_confirmation_document_creates_doc(fake_db, fake_bucket):
    pytest.importorskip("fitz")

    # seed load
    fake_db.collection("loads").document("L1").set(
        {
            "load_id": "L1",
            "load_number": "FP-ATL-LD-000001",
            "origin": "ATL",
            "destination": "MIA",
            "offers": [{"offer_id": "o1", "status": "accepted", "carrier_id": "c1", "carrier_name": "CarrierCo", "rate": 1000.0}],
        }
    )

    rc = load_documents.ensure_rate_confirmation_document(load_id="L1", shipper={"uid": "s1", "role": "shipper", "email": "s@test"})
    assert rc is not None
    assert rc["kind"] == "RATE_CONFIRMATION"

    # should have created a Firestore subcollection doc
    docs = load_documents.list_load_documents("L1")
    assert any(d.get("kind") == "RATE_CONFIRMATION" for d in docs)

    # should have uploaded a PDF to the bucket
    assert any(obj["content_type"] == "application/pdf" for obj in fake_bucket._objects.values())


def test_create_load_document_from_url_dedupes(fake_db, fake_bucket):
    _ = fake_bucket
    fake_db.collection("loads").document("L2").set({"load_id": "L2", "load_number": "FP-ATL-LD-000002"})
    load = load_documents._get_load("L2")
    assert load

    d1 = load_documents.create_load_document_from_url(
        load=load,
        kind="POD",
        url="https://example.test/pod.jpg",
        actor={"uid": "driver1", "role": "driver"},
        source="driver_status_photo",
    )
    d2 = load_documents.create_load_document_from_url(
        load=load,
        kind="POD",
        url="https://example.test/pod.jpg",
        actor={"uid": "driver1", "role": "driver"},
        source="driver_status_photo",
    )

    assert d1["doc_id"] == d2["doc_id"]
    docs = load_documents.list_load_documents("L2")
    assert len([d for d in docs if d.get("kind") == "POD"]) == 1


def test_pod_upload_creates_payer_notification(fake_db, fake_bucket):
    _ = fake_bucket

    fake_db.collection("loads").document("L3").set(
        {
            "load_id": "L3",
            "load_number": "FP-ATL-LD-000003",
            "status": "delivered",
            "payer_uid": "shipper1",
            "payer_role": "shipper",
            "created_by": "shipper1",
            "creator_role": "shipper",
        }
    )

    load = load_documents._get_load("L3")
    assert load

    load_documents.upload_load_document_bytes(
        load=load,
        kind="POD",
        filename="pod.jpg",
        data=b"fake-image-bytes",
        actor={"uid": "driver1", "role": "driver"},
        source="upload",
    )

    notifs = fake_db._collections.get("notifications", {})
    assert len(notifs) == 1
    notif = next(iter(notifs.values()))
    assert notif.get("user_id") == "shipper1"
    assert notif.get("notification_type") == "pod_uploaded"
    assert "FP-ATL-LD-000003" in str(notif.get("title") or "")
    assert "shipper-dashboard" in str(notif.get("action_url") or "")
