from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import pytest

from apps.api import utils


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


class _Collection:
    def __init__(self, docs: Dict[str, Dict[str, Any]]):
        self._docs = docs

    def document(self, doc_id: str) -> _DocRef:
        return _DocRef(self, doc_id)


class _FakeDB:
    def __init__(self):
        self._collections: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def collection(self, name: str) -> _Collection:
        docs = self._collections.setdefault(name, {})
        return _Collection(docs)


@pytest.fixture()
def fake_db():
    return _FakeDB()


def test_generate_load_number_increments(fake_db):
    n1 = utils.generate_load_number(region="ATL", db_client=fake_db)
    n2 = utils.generate_load_number(region="ATL", db_client=fake_db)

    assert n1 != n2
    assert n1.startswith("FP-ATL-LD-")
    assert n2.startswith("FP-ATL-LD-")

    # sequential formatting
    assert n1.endswith("000001")
    assert n2.endswith("000002")
