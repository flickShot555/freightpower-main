from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional

from fastapi.testclient import TestClient
import pytest

pytest.importorskip("firebase_admin")


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

    def _split(self):
        parts = self._path.split("/")
        return "/".join(parts[:-1]), parts[-1]


class _Collection:
    def __init__(self, db: "_FakeDB", path: str):
        self._db = db
        self._path = path

    def document(self, doc_id: str) -> _DocRef:
        return _DocRef(self._db, f"{self._path}/{doc_id}")

    def stream(self) -> Iterable[_Snap]:
        docs = self._db._collections.get(self._path, {})
        return [_Snap(doc_id, data) for doc_id, data in docs.items()]


class _FakeDB:
    def __init__(self):
        self._collections: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def collection(self, name: str) -> _Collection:
        return _Collection(self, name)


@pytest.fixture()
def app_client(monkeypatch):
    from apps.api import main
    from apps.api import onboarding

    fake_db = _FakeDB()
    monkeypatch.setattr(main, "db", fake_db)

    # Force deterministic non-LLM path for fallback validation.
    monkeypatch.setattr(main.settings, "GROQ_API_KEY", "")

    async def _fake_required_docs(user: Dict[str, Any]):
        _ = user
        return {
            "required": [
                {"key": "medical_card", "kind": "document", "status": "Expiring Soon"},
                {"key": "cdl", "kind": "document", "status": "Valid"},
                {"key": "drug_test", "kind": "document", "status": "Missing"},
            ],
            "consent": {"eligible": False},
        }

    monkeypatch.setattr(onboarding, "get_driver_required_docs", _fake_required_docs)
    monkeypatch.setattr(
        main,
        "_driver_collect_assigned_loads",
        lambda uid: [
            {"load_id": "L1", "status": "in_transit", "assigned_driver": uid},
            {"load_id": "L2", "status": "completed", "assigned_driver": uid},
        ],
    )

    # Seed driver + providers.
    fake_db.collection("drivers").document("driver1").set(
        {"is_available": False, "marketplace_views_count": 3}
    )
    fake_db.collection("service_providers").document("p_legal").set(
        {"category": "legal", "name": "Legal Eagle", "rating": 4.9, "featured": True}
    )
    fake_db.collection("service_providers").document("p_roadside").set(
        {"category": "roadside", "name": "Road Rescue", "rating": 4.6}
    )
    fake_db.collection("service_providers").document("p_parking").set(
        {"category": "parking", "name": "Safe Park", "rating": 4.4}
    )
    fake_db.collection("service_providers").document("p_fuel").set(
        {"category": "fuel", "name": "Fuel Hub", "rating": 4.5}
    )

    client = TestClient(main.app)
    return client, main


def test_driver_dashboard_insights_returns_dynamic_payload(app_client):
    client, main = app_client
    main.app.dependency_overrides[main.get_current_user] = lambda: {"uid": "driver1", "role": "driver"}
    try:
        res = client.get("/driver/dashboard/insights")
        assert res.status_code == 200
        payload = res.json()

        assert payload["source"] == "rules"
        assert isinstance(payload.get("ai_suggestions"), list)
        assert len(payload["ai_suggestions"]) >= 1
        first = payload["ai_suggestions"][0]
        assert first.get("title")
        assert first.get("detail")
        assert first.get("action_type")
        assert first.get("action_target")

        active_trip = payload.get("active_trip") or {}
        assert "route" in active_trip
        assert isinstance(active_trip.get("trip_stats") or [], list)

        smart_alerts = payload.get("smart_alerts") or []
        assert isinstance(smart_alerts, list)
        assert len(smart_alerts) >= 1
        assert smart_alerts[0].get("title")
        assert smart_alerts[0].get("action_type")

        daily_insights = payload.get("daily_insights") or []
        assert isinstance(daily_insights, list)
        assert len(daily_insights) >= 2
        assert daily_insights[0].get("title")
        assert daily_insights[0].get("text")

        activity = payload.get("marketplace_activity") or {}
        assert activity.get("views_count") == 3
        assert activity.get("availability_on") is False

        providers = payload.get("service_providers") or []
        assert len(providers) == 4
        categories = {str(p.get("category")) for p in providers}
        assert {"legal", "roadside", "parking", "fuel"}.issubset(categories)

        quick_actions = payload.get("quick_actions") or []
        assert len(quick_actions) >= 1

        emergency_action = payload.get("emergency_action") or {}
        assert emergency_action.get("action_type") == "open_support"
    finally:
        main.app.dependency_overrides = {}


def test_driver_dashboard_insights_forbidden_for_non_driver(app_client):
    client, main = app_client
    main.app.dependency_overrides[main.get_current_user] = lambda: {"uid": "shipper1", "role": "shipper"}
    try:
        res = client.get("/driver/dashboard/insights")
        assert res.status_code == 403
    finally:
        main.app.dependency_overrides = {}


def test_driver_dashboard_insights_metrics_updates(app_client):
    client, main = app_client
    main._DRIVER_INSIGHTS_METRICS.update(
        {
            "rules_count": 0,
            "llm_count": 0,
            "errors_count": 0,
            "last_generated_at": 0.0,
            "last_source": None,
        }
    )

    main.app.dependency_overrides[main.get_current_user] = lambda: {"uid": "driver1", "role": "driver"}
    try:
        res = client.get("/driver/dashboard/insights")
        assert res.status_code == 200
    finally:
        main.app.dependency_overrides = {}

    main.app.dependency_overrides[main.require_admin] = lambda: {"uid": "admin1", "role": "admin"}
    try:
        metrics_res = client.get("/admin/driver-dashboard/insights-metrics")
        assert metrics_res.status_code == 200
        metrics = (metrics_res.json() or {}).get("metrics") or {}
        assert int(metrics.get("rules_count") or 0) >= 1
        assert metrics.get("last_source") in {"rules", "llm"}
    finally:
        main.app.dependency_overrides = {}
