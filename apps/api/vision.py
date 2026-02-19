import base64
import json
from typing import List, Dict, Any
from pathlib import Path
from groq import Groq

from .prompts import (
    CLASSIFICATION_PROMPT,
    render_classification_payload,
    render_extraction_prompt,
)
from .settings import settings


def _b64(img_bytes: bytes) -> str:
    return base64.b64encode(img_bytes).decode("ascii")


def _client() -> Groq:
    if not settings.GROQ_API_KEY:
        print("❌ ERROR: GROQ_API_KEY is missing in settings!")
        raise RuntimeError("GROQ_API_KEY is not set")
    return Groq(api_key=settings.GROQ_API_KEY)


def _vision_messages(instruction: str, body: str, images: List[bytes]) -> List[Dict[str, Any]]:
    content: List[Dict[str, Any]] = [{"type": "text", "text": f"{instruction}\n\n{body}"}]
    # Safety check: ensure images list isn't empty
    if not images:
        print("⚠️ WARNING: No images passed to vision API")
    
    for img in images[:3]:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{_b64(img)}"},
        })
    system_text = (
        "You are a precise document extraction agent. "
        "Respond ONLY with valid JSON matching the requested schema. "
        "If unsure, set fields to null and include a confidence between 0 and 1."
    )
    return [
        {"role": "system", "content": system_text},
        {"role": "user", "content": content},
    ]


def _parse_json(text: str) -> Dict[str, Any]:
    import json, re
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.strip()
    # Attempt to extract JSON even if trailing characters exist
    match = re.search(r"\{[\s\S]*\}", cleaned)
    raw = match.group(0) if match else cleaned
    return json.loads(raw)


def detect_document_type(images: List[bytes], text_snippet: str, signals: Dict[str, Any]) -> Dict[str, Any]:
    print(f"🔍 DETECTING... Signals found: {list(signals.keys())}")
    client = _client()
    body = render_classification_payload(signals, text_snippet)
    msgs: Any = _vision_messages(CLASSIFICATION_PROMPT, body, images)
    
    try:
        resp = client.chat.completions.create(
            model=settings.GROQ_VISION_MODEL,
            messages=msgs,
            temperature=0,
            max_tokens=256,
        )
        text = resp.choices[0].message.content or ""
        print(f"🤖 AI RAW CLASSIFICATION OUTPUT: {text}") # <--- DEBUG PRINT
        
        data = _parse_json(text)
        data.setdefault("reason", "")
        print(f"✅ DETECTED TYPE: {data.get('document_type')}")
        return data

    except Exception as e:
        print(f"❌ CLASSIFICATION FAILED: {e}") # <--- DEBUG PRINT
        return {"document_type": "OTHER", "confidence": 0.0, "raw": str(e)}


def extract_document(images: List[bytes], doc_type: str, plain_text: str, prefill: Dict[str, Any]) -> Dict[str, Any]:
    print(f"📄 EXTRACTING as {doc_type}...")
    client = _client()
    doc_type_upper = doc_type.upper()
    doc_prefill = prefill.get(doc_type_upper, {})
    prompt = render_extraction_prompt(doc_type_upper, doc_prefill)
    snippet = plain_text[:4000]
    body = f"Prefill JSON:\n{json.dumps(doc_prefill, ensure_ascii=False)}\n\nDocument text excerpt:\n{snippet}"
    msgs: Any = _vision_messages(prompt, body, images)
    
    try:
        resp = client.chat.completions.create(
            model=settings.GROQ_VISION_MODEL,
            messages=msgs,
            temperature=0,
            max_tokens=1200,
        )
        text = resp.choices[0].message.content or ""
        print(f"🤖 AI RAW EXTRACTION OUTPUT: {text}") # <--- DEBUG PRINT

        out = _parse_json(text)
        if "document_type" not in out:
            out["document_type"] = doc_type_upper
        return out
        
    except Exception as e:
        print(f"❌ EXTRACTION FAILED: {e}") # <--- DEBUG PRINT
        return {"document_type": doc_type_upper, "text": None, "raw": text if 'text' in locals() else str(e)}


def chat_answer(query: str, context: str) -> str:
    # ... existing chat_answer code ...
    client = _client()
    try:
        system = Path("data/kb/system_prompt.txt").read_text(encoding="utf-8").strip()
    except Exception:
        system = "You answer questions grounded in the provided context."
        
    user = f"Context:\n\n{context}\n\nQuestion: {query}"
    msgs: Any = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    resp = client.chat.completions.create(
        model=settings.GROQ_TEXT_MODEL,
        messages=msgs,
        temperature=0.2,
        max_tokens=512,
    )
    return resp.choices[0].message.content or ""