import base64

from apps.api.finance.emailer import _decode_pdf_base64


def test_decode_pdf_base64_accepts_data_uri_with_filename_param():
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    b64 = base64.b64encode(pdf_bytes).decode("ascii")

    data_uri = f"data:application/pdf;filename=generated.pdf;base64,{b64}"
    out = _decode_pdf_base64(data_uri)
    assert out.startswith(b"%PDF")


def test_decode_pdf_base64_accepts_raw_base64():
    pdf_bytes = b"%PDF-1.4\n%%EOF\n"
    b64 = base64.b64encode(pdf_bytes).decode("ascii")

    out = _decode_pdf_base64(b64)
    assert out.startswith(b"%PDF")
