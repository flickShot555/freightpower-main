from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from fastapi.testclient import TestClient
import pytest


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

    def update(self, data: Dict[str, Any]):
        self.set(data, merge=True)

    def collection(self, name: str) -> "_Collection":
        return _Collection(self._db, f"{self._path}/{name}")

    def _split(self):
        parts = self._path.split("/")
        col_path = "/".join(parts[:-1])
        doc_id = parts[-1]
        return col_path, doc_id


class _Collection:
    def __init__(self, db: "_FakeDB", path: str):
        self._db = db
        self._path = path

    def document(self, doc_id: Optional[str] = None) -> _DocRef:
        # If doc_id is omitted, create a deterministic-ish placeholder.
        doc_id = doc_id or f"auto_{len(self._db._collections.get(self._path, {})) + 1}"
        return _DocRef(self._db, f"{self._path}/{doc_id}")

    def stream(self):
        docs = self._db._collections.get(self._path, {})
        return [_Snap(doc_id, data) for doc_id, data in docs.items()]


class _FakeDB:
    def __init__(self):
        self._collections: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def collection(self, name: str) -> _Collection:
        return _Collection(self, name)


@pytest.fixture()
def app_client(monkeypatch):
    # Import inside fixture so monkeypatching applies before client is used.
    from apps.api import main

    fake_db = _FakeDB()
    monkeypatch.setattr(main, "db", fake_db)

    # Avoid touching filesystem ResponseStore in these tests.
    class _Store:
        def __init__(self):
            self.loads: Dict[str, Dict[str, Any]] = {}

        def save_load(self, load: Dict[str, Any]):
            lid = load.get("load_id") or load.get("id")
            self.loads[str(lid)] = dict(load)

        def get_load(self, load_id: str):
            return self.loads.get(str(load_id))

        def update_load(self, load_id: str, updates: Dict[str, Any]):
            cur = dict(self.loads.get(str(load_id)) or {})
            cur.update(dict(updates))
            self.loads[str(load_id)] = cur
            return cur

        def add_status_change_log(self, load_id: str, log_entry: Dict[str, Any]):
            _ = load_id
            _ = log_entry
            return

        def list_carriers(self):
            return []

    monkeypatch.setattr(main, "store", _Store())

    # Deterministic IDs.
    monkeypatch.setattr(main, "generate_load_id", lambda region="ATL", user_code=None: "L1")
    monkeypatch.setattr(main, "generate_load_number", lambda region="ATL", db_client=None: "FP-ATL-LD-000001")

    # Skip rate confirmation auto-generation side-effect during accept-carrier.
    monkeypatch.setattr(main, "ensure_rate_confirmation_document", lambda **kwargs: None)

    # Provide an app client we can override auth on.
    client = TestClient(main.app)
    return client, fake_db, main


def test_create_load_step1_as_broker_sets_payer_fields(app_client):
    client, fake_db, main = app_client

    main.app.dependency_overrides[main.get_current_user] = lambda: {"uid": "broker1", "role": "broker"}

    res = client.post(
        "/loads/step1",
        json={
            "origin": "ATL",
            "destination": "MIA",
            "pickup_date": "2026-01-01",
            "delivery_date": "2026-01-02",
            "equipment_type": "Dry Van",
            "weight": 1000,
            "pallet_count": 1,
        },
    )
    assert res.status_code == 200

    snap = fake_db.collection("loads").document("L1").get()
    assert snap.exists
    load = snap.to_dict()

    assert load["created_by"] == "broker1"
    assert load["creator_role"] == "broker"

    assert load["payer_uid"] == "broker1"
    assert load["payer_role"] == "broker"
    assert load["broker_id"] == "broker1"

    assert load["carrier_id"] is None
    assert load["carrier_uid"] is None


def test_accept_carrier_sets_carrier_id(app_client):
    client, fake_db, main = app_client

    # Seed a posted load with an offer.
    fake_db.collection("loads").document("L1").set(
        {
            "load_id": "L1",
            "load_number": "FP-ATL-LD-000001",
            "created_by": "broker1",
            "creator_role": "broker",
            "status": "posted",
            "offers": [
                {
                    "offer_id": "o1",
                    "carrier_id": "carrier1",
                    "carrier_name": "CarrierCo",
                    "rate": 1200.0,
                    "status": "pending",
                    "submitted_at": 1.0,
                }
            ],
        }
    )

    main.app.dependency_overrides[main.get_current_user] = lambda: {"uid": "broker1", "role": "broker"}

    res = client.post(
        "/loads/L1/accept-carrier",
        json={"offer_id": "o1", "carrier_id": "carrier1", "carrier_name": "CarrierCo"},
    )
    assert res.status_code == 200

    load = fake_db.collection("loads").document("L1").get().to_dict()
    assert load["assigned_carrier_id"] == "carrier1"
    assert load["carrier_id"] == "carrier1"
    assert load["carrier_uid"] == "carrier1"
