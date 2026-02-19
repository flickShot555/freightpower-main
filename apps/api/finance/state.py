from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .models import InvoiceStatus


class InvoiceStateError(ValueError):
    pass


@dataclass(frozen=True)
class InvoiceRequirements:
    require_pod: bool = True
    require_bol: bool = False


def can_transition(current: InvoiceStatus, new: InvoiceStatus) -> bool:
    allowed: dict[InvoiceStatus, set[InvoiceStatus]] = {
        InvoiceStatus.DRAFT: {InvoiceStatus.ISSUED, InvoiceStatus.VOID},
        InvoiceStatus.ISSUED: {InvoiceStatus.SENT, InvoiceStatus.DISPUTED, InvoiceStatus.VOID},
        InvoiceStatus.SENT: {InvoiceStatus.DISPUTED, InvoiceStatus.FACTORING_SUBMITTED, InvoiceStatus.OVERDUE, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID},
        InvoiceStatus.DISPUTED: {InvoiceStatus.SENT, InvoiceStatus.VOID},
        InvoiceStatus.FACTORING_SUBMITTED: {InvoiceStatus.FACTORING_ACCEPTED, InvoiceStatus.FACTORING_REJECTED, InvoiceStatus.OVERDUE},
        InvoiceStatus.FACTORING_ACCEPTED: {InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE},
        InvoiceStatus.FACTORING_REJECTED: {InvoiceStatus.SENT, InvoiceStatus.OVERDUE},
        InvoiceStatus.PARTIALLY_PAID: {InvoiceStatus.PAID, InvoiceStatus.OVERDUE},
        InvoiceStatus.OVERDUE: {InvoiceStatus.DISPUTED, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID},
        InvoiceStatus.PAID: set(),
        InvoiceStatus.VOID: set(),
    }
    return new in allowed.get(current, set())


def assert_transition(current: InvoiceStatus, new: InvoiceStatus) -> None:
    if current == new:
        return
    if not can_transition(current, new):
        raise InvoiceStateError(f"Invalid invoice transition: {current.value} -> {new.value}")


def required_docs_present(attachments: Iterable[dict], requirements: InvoiceRequirements) -> bool:
    kinds = {str(a.get('kind', '')).strip().upper() for a in attachments if isinstance(a, dict)}
    if requirements.require_pod and "POD" not in kinds:
        return False
    if requirements.require_bol and "BOL" not in kinds:
        return False
    return True
