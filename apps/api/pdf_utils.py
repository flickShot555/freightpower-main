import io
from typing import List, Any
import fitz  # PyMuPDF
from PIL import Image


def _pixmap_to_jpeg_bytes(pix: fitz.Pixmap) -> bytes:
    # Pillow expects a tuple for size
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    # Resize longest side to 1024 to control payload size
    max_side = max(img.width, img.height)
    if max_side > 1024:
        scale = 1024 / max_side
        new_size = (int(img.width * scale), int(img.height * scale))
        # Pillow >=9 uses Image.Resampling; fall back for older versions
        try:
            resample = Image.Resampling.LANCZOS  # type: ignore[attr-defined]
        except AttributeError:  # Pillow < 9
            resample = Image.LANCZOS  # type: ignore[attr-defined]
        img = img.resize(new_size, resample)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()


def pdf_to_images(pdf_bytes: bytes) -> List[bytes]:
    """Render each page of the PDF to JPEG bytes."""
    images: List[bytes] = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            # Zoom to improve quality slightly before downscale
            mat = fitz.Matrix(1.5, 1.5)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            images.append(_pixmap_to_jpeg_bytes(pix))
    return images


def pdf_to_text(pdf_bytes: bytes) -> str:
    """Extract selectable text from PDF pages as a fallback (non-OCR)."""
    texts: List[str] = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for i in range(doc.page_count):
            page = doc.load_page(i)
            try:
                raw: Any = page.get_text("text")
            except Exception:
                raw = ""
            # Ensure we have a string for downstream use
            t = raw if isinstance(raw, str) else str(raw) if raw is not None else ""
            t = t.strip()
            if t:
                texts.append(t)
    return "\n\n".join(texts)
