from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Dict, Any

from .rag import build_document_chunks
from .settings import settings
from .storage import ResponseStore

KB_DIR = Path(settings.DATA_DIR) / "kb"

DEFAULT_DOCS = {
    "faqs.md": """# FreightPower Onboarding FAQs

## What paperwork do I need?
- Certificate of Insurance (COI) showing active coverage
- IRS Form W-9 with TIN and signature
- CDL for every active driver

## How fast do approvals happen?
Once we receive clean paperwork we update status within one business day.

## Who do I contact for help?
Use the FreightPower assistant or email ai-onboarding@freightpower.example""",
    "onboarding_playbook.md": """# Onboarding Coach Script

1. Welcome the carrier and explain the required documents.
2. Verify MC/DOT information and insurance expiration dates.
3. Confirm driver roster and CDL validity.
4. Share next best actions and timelines.
5. Offer chat assistant for follow-up questions.""",
}


def _ensure_default_docs():
    KB_DIR.mkdir(parents=True, exist_ok=True)
    for name, content in DEFAULT_DOCS.items():
        path = KB_DIR / name
        if not path.exists():
            path.write_text(content.strip() + "\n", encoding="utf-8")


def bootstrap_knowledge_base(store: ResponseStore):
    """Load FAQ/onboarding docs into the local vector index."""
    _ensure_default_docs()
    existing = {doc["id"]: doc for doc in store.list_documents()}

    for md_path in KB_DIR.glob("*.md"):
        doc_id = f"kb::{md_path.stem}"
        text = md_path.read_text(encoding="utf-8").strip()
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()

        existing_record = existing.get(doc_id)
        if existing_record:
            stored_digest = (existing_record.get("metadata") or {}).get("digest")
            if stored_digest == digest and existing_record.get("chunk_count"):
                continue

        chunks = build_document_chunks(doc_id, text, doc_type="KB")
        store.upsert_document_chunks(doc_id, chunks)
        record = {
            "id": doc_id,
            "filename": md_path.name,
            "doc_type": "KB",
            "source": "knowledge_base",
            "chunk_count": len(chunks),
            "metadata": {"digest": digest},
            "detection": {"document_type": "KB", "confidence": 1.0},
            "extraction": {"document_type": "KB", "text": text},
        }
        store.save_document(record)
