from __future__ import annotations

from typing import Dict, Any, List, Tuple
import uuid

from langchain_text_splitters import RecursiveCharacterTextSplitter

from .embeddings import embed_texts, embed_query, cosine_sim


def chunk_text(text: str, doc_type: str | None = None) -> List[Dict[str, Any]]:
    if not text:
        return []
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=120,
        separators=["\n\n", "\n", ". ", ".", " "]
    )
    chunks = splitter.split_text(text)
    out: List[Dict[str, Any]] = []
    for i, c in enumerate(chunks):
        out.append({
            "chunk_index": i,
            "content": c.strip(),
            "metadata": {"doc_type": (doc_type or "").upper()},
        })
    return out


def build_document_chunks(document_id: str, text: str, doc_type: str | None = None) -> List[Dict[str, Any]]:
    chunks = chunk_text(text, doc_type)
    texts = [c["content"] for c in chunks]
    vectors = embed_texts(texts) if texts else []
    out: List[Dict[str, Any]] = []
    for i, c in enumerate(chunks):
        out.append({
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "chunk_index": c["chunk_index"],
            "content": c["content"],
            "embedding": vectors[i] if i < len(vectors) else [],
            "metadata": c["metadata"],
        })
    return out


def retrieve(chunks: List[Dict[str, Any]], query: str, k: int = 5) -> List[Tuple[float, Dict[str, Any]]]:
    if not chunks:
        return []
    qv = embed_query(query)
    scored: List[Tuple[float, Dict[str, Any]]] = []
    for ch in chunks:
        emb = ch.get("embedding") or []
        if not emb:
            continue
        s = cosine_sim(qv, emb)
        scored.append((s, ch))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:k]

