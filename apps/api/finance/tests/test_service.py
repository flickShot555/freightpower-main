from apps.api.finance.models import InvoiceRecord, InvoiceStatus
from apps.api.finance.service import compute_forecast, compute_summary


def _inv(*, invoice_id: str, status: InvoiceStatus, amount_total: float, amount_paid: float = 0.0, due_date: float | None = None, factoring: bool = False):
    now = 1_700_000_000.0
    return InvoiceRecord(
        invoice_id=invoice_id,
        invoice_number=f"INV-{invoice_id}",
        load_id="LD-1",
        issuer_uid="u1",
        issuer_role="carrier",
        payer_uid="u2",
        payer_role="shipper",
        status=status,
        amount_total=amount_total,
        amount_paid=amount_paid,
        currency="USD",
        due_date=due_date,
        issued_at=now,
        sent_at=None,
        paid_at=None,
        overdue_at=None,
        voided_at=None,
        factoring_enabled=factoring,
        factoring_provider=None,
        factoring_submission_id=None,
        attachments=[],
        notes=None,
        created_at=now,
        updated_at=now,
        metadata={},
    )


def test_compute_summary_basic():
    now = 1_700_000_000.0
    invoices = [
        _inv(invoice_id="1", status=InvoiceStatus.SENT, amount_total=1000, amount_paid=0, due_date=now + 10, factoring=False),
        _inv(invoice_id="2", status=InvoiceStatus.OVERDUE, amount_total=500, amount_paid=0, due_date=now - 10, factoring=True),
        _inv(invoice_id="3", status=InvoiceStatus.PAID, amount_total=200, amount_paid=200, due_date=now - 20, factoring=False),
    ]
    s = compute_summary(invoices=invoices, role_scope="carrier", now=now)
    assert s.open_invoice_count == 2
    assert s.overdue_invoice_count == 1
    assert s.outstanding_amount == 1500.0
    assert s.overdue_amount == 500.0
    assert s.factoring_outstanding_amount == 500.0


def test_compute_forecast_basic():
    now = 1_700_000_000.0
    invoices = [
        _inv(invoice_id="1", status=InvoiceStatus.SENT, amount_total=1000, amount_paid=0, due_date=now + 5, factoring=False),
        _inv(invoice_id="2", status=InvoiceStatus.SENT, amount_total=1000, amount_paid=0, due_date=now + 5, factoring=True),
        _inv(invoice_id="3", status=InvoiceStatus.SENT, amount_total=1000, amount_paid=0, due_date=now - 5, factoring=False),
    ]
    f = compute_forecast(invoices=invoices, role_scope="carrier", range_days=30, now=now)
    assert f.expected_direct_payments == 1000.0
    assert f.expected_factoring_advances == 900.0
    assert f.overdue_collections == 1000.0
