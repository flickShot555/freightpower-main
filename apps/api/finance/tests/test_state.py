import pytest

from apps.api.finance.models import InvoiceStatus
from apps.api.finance.state import InvoiceRequirements, InvoiceStateError, assert_transition, required_docs_present


def test_invoice_state_allows_happy_path():
    assert_transition(InvoiceStatus.DRAFT, InvoiceStatus.ISSUED)
    assert_transition(InvoiceStatus.ISSUED, InvoiceStatus.SENT)
    assert_transition(InvoiceStatus.SENT, InvoiceStatus.FACTORING_SUBMITTED)
    assert_transition(InvoiceStatus.FACTORING_SUBMITTED, InvoiceStatus.FACTORING_ACCEPTED)
    assert_transition(InvoiceStatus.FACTORING_ACCEPTED, InvoiceStatus.PAID)


def test_invoice_state_rejects_invalid_transition():
    with pytest.raises(InvoiceStateError):
        assert_transition(InvoiceStatus.DRAFT, InvoiceStatus.PAID)


def test_required_docs_present_pod_required():
    req = InvoiceRequirements(require_pod=True, require_bol=False)
    assert required_docs_present([{"kind": "POD"}], req) is True
    assert required_docs_present([{"kind": "BOL"}], req) is False
