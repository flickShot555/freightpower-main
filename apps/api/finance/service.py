from __future__ import annotations

import time
from typing import Dict, List

from .models import FinanceForecastResponse, FinanceSummaryResponse, InvoiceRecord, InvoiceStatus


def _now() -> float:
    return float(time.time())


def compute_summary(*, invoices: List[InvoiceRecord], role_scope: str, now: float | None = None) -> FinanceSummaryResponse:
    now = float(_now() if now is None else now)
    outstanding_amount = 0.0
    overdue_amount = 0.0
    paid_amount_30d = 0.0

    open_invoice_count = 0
    overdue_invoice_count = 0

    factoring_outstanding_amount = 0.0

    for inv in invoices:
        amt_total = float(inv.amount_total or 0)
        amt_paid = float(inv.amount_paid or 0)
        remaining = max(0.0, amt_total - amt_paid)

        if inv.status in {InvoiceStatus.PAID, InvoiceStatus.VOID}:
            if inv.paid_at and float(inv.paid_at) >= now - 30.0 * 86400.0:
                paid_amount_30d += float(inv.amount_total or 0)
            continue

        # Open invoice
        open_invoice_count += 1
        outstanding_amount += remaining

        is_overdue = False
        if inv.status == InvoiceStatus.OVERDUE:
            is_overdue = True
        elif inv.due_date and float(inv.due_date) < now:
            is_overdue = True

        if is_overdue:
            overdue_invoice_count += 1
            overdue_amount += remaining

        if inv.factoring_enabled:
            factoring_outstanding_amount += remaining

    return FinanceSummaryResponse(
        role_scope=role_scope,
        outstanding_amount=round(outstanding_amount, 2),
        overdue_amount=round(overdue_amount, 2),
        paid_amount_30d=round(paid_amount_30d, 2),
        open_invoice_count=int(open_invoice_count),
        overdue_invoice_count=int(overdue_invoice_count),
        factoring_outstanding_amount=round(factoring_outstanding_amount, 2),
    )


def compute_forecast(*, invoices: List[InvoiceRecord], role_scope: str, range_days: int, now: float | None = None) -> FinanceForecastResponse:
    now = float(_now() if now is None else now)
    horizon = now + float(range_days) * 86400.0

    expected_direct_payments = 0.0
    expected_factoring_advances = 0.0
    overdue_collections = 0.0

    for inv in invoices:
        if inv.status in {InvoiceStatus.PAID, InvoiceStatus.VOID}:
            continue

        amt_total = float(inv.amount_total or 0)
        amt_paid = float(inv.amount_paid or 0)
        remaining = max(0.0, amt_total - amt_paid)

        if inv.due_date and float(inv.due_date) < now:
            overdue_collections += remaining
            continue

        if inv.factoring_enabled and inv.status in {InvoiceStatus.FACTORING_ACCEPTED, InvoiceStatus.FACTORING_SUBMITTED, InvoiceStatus.SENT, InvoiceStatus.ISSUED}:
            # Conservative: assume 90% advance within range window.
            expected_factoring_advances += remaining * 0.9
        else:
            # Direct payment expected if due within horizon.
            if inv.due_date and float(inv.due_date) <= horizon:
                expected_direct_payments += remaining

    return FinanceForecastResponse(
        role_scope=role_scope,
        range_days=int(range_days),
        expected_direct_payments=round(expected_direct_payments, 2),
        expected_factoring_advances=round(expected_factoring_advances, 2),
        overdue_collections=round(overdue_collections, 2),
    )
