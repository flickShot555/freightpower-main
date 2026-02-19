from __future__ import annotations

from typing import List
import numpy as np


_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from fastembed import TextEmbedding
        except Exception as e:
            raise RuntimeError(
                "fastembed is not installed correctly. Run: pip install fastembed onnxruntime"
            ) from e
        # Use BGE small model; fast, CPU-friendly
        _embedder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _embedder


def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    embedder = _get_embedder()
    vectors = list(embedder.embed(texts))  # generator of lists/np arrays
    out: List[List[float]] = []
    for v in vectors:
        arr = np.asarray(v, dtype=float)
        # Normalize for cosine similarity consistency
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm
        out.append(arr.astype(float).tolist())
    return out


def embed_query(text: str) -> List[float]:
    [vec] = embed_texts([text])
    return vec


def cosine_sim(a: List[float], b: List[float]) -> float:
    # Embeddings are normalized; cosine ~ dot
    va = np.asarray(a, dtype=float)
    vb = np.asarray(b, dtype=float)
    denom = (np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)
