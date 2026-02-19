from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    SENT = "sent"
    DISPUTED = "disputed"
    FACTORING_SUBMITTED = "factoring_submitted"
    FACTORING_ACCEPTED = "factoring_accepted"
    FACTORING_REJECTED = "factoring_rejected"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    VOID = "void"


class FactoringSubmissionStatus(str, Enum):
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    FUNDED = "funded"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    ACH = "ach"
    WIRE = "wire"
    CHECK = "check"
    CARD = "card"
    FACTORING_ADVANCE = "factoring_advance"
    FACTORING_RESERVE_RELEASE = "factoring_reserve_release"
    OTHER = "other"


class InvoiceAttachment(BaseModel):
    kind: str  # e.g. POD, BOL, RATE_CONFIRMATION, OTHER
    url: Optional[str] = None
    document_id: Optional[str] = None
    filename: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class InvoiceCreateRequest(BaseModel):
    load_id: str
    amount_total: float
    currency: str = "USD"

    # Allow creating a draft invoice (no POD required until issuance/sending).
    save_as_draft: bool = False

    # Optional overrides
    invoice_number: Optional[str] = None
    due_date: Optional[float] = None
    due_in_days: Optional[int] = None

    # If omitted, derived from load.
    payer_uid: Optional[str] = None
    payer_role: Optional[str] = None

    # Factoring intent
    factoring_enabled: bool = False
    factoring_provider: Optional[str] = None

    attachments: List[InvoiceAttachment] = Field(default_factory=list)
    notes: Optional[str] = None

    # Freeform extensibility for UI-collected fields (line items, billing info, references, etc).
    metadata: Dict[str, Any] = Field(default_factory=dict)


class InvoiceActionResponse(BaseModel):
    ok: bool = True
    invoice_id: str
    status: InvoiceStatus
    message: str


class InvoiceRecord(BaseModel):
    invoice_id: str
    invoice_number: str

    load_id: str
    load_number: Optional[str] = None

    issuer_uid: str
    issuer_role: str

    payer_uid: str
    payer_role: str

    status: InvoiceStatus

    amount_total: float
    amount_paid: float = 0.0
    currency: str = "USD"

    due_date: Optional[float] = None
    issued_at: Optional[float] = None
    sent_at: Optional[float] = None
    disputed_at: Optional[float] = None
    disputed_by_uid: Optional[str] = None
    dispute_reason: Optional[str] = None
    paid_at: Optional[float] = None
    overdue_at: Optional[float] = None
    voided_at: Optional[float] = None

    factoring_enabled: bool = False
    factoring_provider: Optional[str] = None
    factoring_submission_id: Optional[str] = None

    attachments: List[InvoiceAttachment] = Field(default_factory=list)
    notes: Optional[str] = None

    created_at: float
    updated_at: float

    # Freeform extensibility.
    metadata: Dict[str, Any] = Field(default_factory=dict)


class InvoiceListResponse(BaseModel):
    invoices: List[InvoiceRecord]
    total: int


class FactoringSubmitRequest(BaseModel):
    provider: str


class FactoringSubmissionRecord(BaseModel):
    submission_id: str
    invoice_id: str
    provider: str
    status: FactoringSubmissionStatus

    provider_reference: Optional[str] = None

    submitted_at: float
    updated_at: float

    advance_amount: Optional[float] = None
    fee_amount: Optional[float] = None
    funded_at: Optional[float] = None

    metadata: Dict[str, Any] = Field(default_factory=dict)


class FactoringWebhookRequest(BaseModel):
    event_id: str
    event_type: str
    occurred_at: Optional[float] = None

    invoice_id: Optional[str] = None
    submission_id: Optional[str] = None

    payload: Dict[str, Any] = Field(default_factory=dict)


class WebhookEventRecord(BaseModel):
    provider: str
    event_id: str
    event_type: str
    received_at: float
    occurred_at: Optional[float] = None

    processed_at: Optional[float] = None
    processing_error: Optional[str] = None

    invoice_id: Optional[str] = None
    submission_id: Optional[str] = None

    payload: Dict[str, Any] = Field(default_factory=dict)


class PaymentCreateRequest(BaseModel):
    amount: float
    currency: str = "USD"
    method: PaymentMethod = PaymentMethod.OTHER
    received_at: Optional[float] = None
    external_id: Optional[str] = None
    notes: Optional[str] = None


class PaymentTransactionRecord(BaseModel):
    payment_id: str
    invoice_id: str

    amount: float
    currency: str = "USD"
    method: PaymentMethod

    received_at: float
    created_at: float

    external_id: Optional[str] = None
    notes: Optional[str] = None

    metadata: Dict[str, Any] = Field(default_factory=dict)


class InvoiceEmailRequest(BaseModel):
    to: str
    subject: str
    body: str

    # Base64-encoded PDF bytes. Accepts either raw base64 or a data URI.
    pdf_base64: str
    filename: Optional[str] = None


class InvoiceDisputeRequest(BaseModel):
    reason: str

    # Optional message/context for the issuer.
    message: Optional[str] = None


class FinanceSummaryResponse(BaseModel):
    role_scope: str

    outstanding_amount: float
    overdue_amount: float
    paid_amount_30d: float

    open_invoice_count: int
    overdue_invoice_count: int

    factoring_outstanding_amount: float


class FinanceForecastResponse(BaseModel):
    role_scope: str
    range_days: int

    expected_direct_payments: float
    expected_factoring_advances: float
    overdue_collections: float


class EligibleLoadRecord(BaseModel):
    load_id: str
    load_number: Optional[str] = None
    status: str

    # Used for UI gating (issue/send requires POD).
    has_pod: bool = False

    creator_role: Optional[str] = None
    created_by: Optional[str] = None

    origin: Optional[Dict[str, Any]] = None
    destination: Optional[Dict[str, Any]] = None
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None

    # Payment terms (from load) for UI display.
    payment_terms: Optional[str] = None
    terms_days: Optional[int] = None

    payment_done: bool = False

    @field_validator("origin", "destination", mode="before")
    @classmethod
    def _coerce_location(cls, value: Any) -> Optional[Dict[str, Any]]:
        if value is None:
            return None
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            text = value.strip()
            return {"text": text} if text else None
        return {"text": str(value)}


class EligibleLoadsResponse(BaseModel):
    loads: List[EligibleLoadRecord]
    total: int
