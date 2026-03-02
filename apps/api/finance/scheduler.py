from __future__ import annotations

from .repo import mark_overdue_invoices
from ..scheduler import SchedulerWrapper


def init_finance_scheduler(scheduler: SchedulerWrapper):
    # Every 30 minutes, best-effort.
    scheduler.add_interval_job(mark_overdue_invoices, minutes=30, id="invoice_overdue_marker")
