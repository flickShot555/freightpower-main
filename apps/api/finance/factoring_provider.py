from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Protocol


@dataclass(frozen=True)
class ProviderSubmissionResult:
    provider_reference: str
    accepted: bool
    message: str
    metadata: Dict[str, Any]


class FactoringProvider(Protocol):
    name: str

    def submit_invoice(self, *, invoice: Dict[str, Any]) -> ProviderSubmissionResult:
        ...


class MockFactoringProvider:
    name = "mock"

    def submit_invoice(self, *, invoice: Dict[str, Any]) -> ProviderSubmissionResult:
        # Deterministic behavior: accept if amount <= 10k, otherwise reject.
        amount = float(invoice.get("amount_total") or 0)
        if amount <= 10_000:
            return ProviderSubmissionResult(
                provider_reference=f"MOCK-{invoice.get('invoice_id')}",
                accepted=True,
                message="Accepted by Mock provider",
                metadata={"advance_rate": 0.9},
            )
        return ProviderSubmissionResult(
            provider_reference=f"MOCK-{invoice.get('invoice_id')}",
            accepted=False,
            message="Rejected by Mock provider (amount too large)",
            metadata={"reason": "amount_limit"},
        )


def get_provider(name: str) -> FactoringProvider:
    n = (name or "").strip().lower()
    if not n or n == "mock":
        return MockFactoringProvider()
    # For now, all unknown provider names are treated as mock to avoid assumptions.
    return MockFactoringProvider()
