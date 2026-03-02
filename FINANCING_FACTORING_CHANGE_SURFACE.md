# Financing & Factoring — Change Surface Map (Prep)

Date: 2026-01-22

This doc is a working map of the current frontend + backend “finance / invoice / factoring / payout” surface area, so we can implement larger financing/factoring changes without missing cross-role impacts.

## 1) User types / roles (source of truth)

**Backend role enum**: `carrier`, `driver`, `shipper`, `broker`, `admin`, `super_admin`
- Defined in [apps/api/models.py](apps/api/models.py)

**Frontend route guards**: `carrier`, `driver`, `shipper`, `admin`, `super_admin`
- Enforced by [src/components/ProtectedRoute.jsx](src/components/ProtectedRoute.jsx)

**Note**: Backend has helper normalization that recognizes `service_provider` in role filters, but it is **not** part of the `Role` enum.
- See role normalization in [apps/api/main.py](apps/api/main.py)

## 2) Current finance/factoring features by area

### A) Loads: payment terms (real backend + real frontend)

**Backend model**
- `LoadStep2Update.payment_terms` uses `PaymentTerms` enum (Quick Pay / 7 / 15 / 30 / Custom)
- Defined in [apps/api/models.py](apps/api/models.py)

**Backend endpoints (load wizard + listing)**
- `POST /loads/step1` create draft load
- `PATCH /loads/{load_id}/step2` writes pricing + `payment_terms`
- `PATCH /loads/{load_id}/step3?status=ACTIVE|DRAFT` posts load
- `GET /loads?exclude_drafts=...` lists loads with role filtering
- Implemented in [apps/api/main.py](apps/api/main.py)

**Frontend load wizard**
- Uses `paymentTerms` string and sends it to backend as `payment_terms`.
- UI includes “Factoring Available” but maps it to value `Custom`.
- Implemented in [src/components/carrier/AddLoads.jsx](src/components/carrier/AddLoads.jsx)

**Important mismatch**
- Frontend treats “Factoring Available” as a payment term option (value `Custom`).
- Docs mention `FACTORING` as a term in places, but backend `PaymentTerms` does **not** have a dedicated `FACTORING` enum value.

### B) Invoices / factoring operations (currently **UI-mock**, not backed by APIs)

These screens render finance/factoring workflows but do not currently call backend invoice/factoring endpoints.

**Shipper**
- Finance hub with tabs: Overview / Invoices / Payments / Factoring / Banking
  - [src/components/shipper/Finance.jsx](src/components/shipper/Finance.jsx)
- Create invoice modal (mock fields, no persistence)
  - [src/components/shipper/CreateInvoice.jsx](src/components/shipper/CreateInvoice.jsx)
- Invoice preview / timeline (mock)
  - [src/components/shipper/InvoicePreview.jsx](src/components/shipper/InvoicePreview.jsx)
- Rate confirmation panel includes a “Factoring: …” line (mock)
  - [src/components/shipper/RateConfirmationPanel.jsx](src/components/shipper/RateConfirmationPanel.jsx)

**Carrier**
- Factoring & invoicing screen (mock invoice table)
  - [src/components/carrier/FactoringInvoicing.jsx](src/components/carrier/FactoringInvoicing.jsx)
- Entry point is carrier dashboard nav (FINANCE group)
  - [src/components/carrier/CarrierDashboard.jsx](src/components/carrier/CarrierDashboard.jsx)

**Super Admin**
- Finance & Billing (mock “integrations health” + transaction management table)
  - [src/components/super_admin/FinanceBilling.jsx](src/components/super_admin/FinanceBilling.jsx)

### C) Banking / payout proof (document processing: real backend)

Backend has document definitions and validation that support banking proof documents used for payouts.

**Document types**
- `VOIDED_CHECK_CARRIER` (carrier payouts)
- `BROKER_BANKING` (broker payouts)
- Defined in [apps/api/documents.py](apps/api/documents.py)

**Validation rules**
- Routing number must be 9 digits
- Implemented in [apps/api/validation.py](apps/api/validation.py)

**Prefill extraction (routing/account numbers)**
- Implemented in [apps/api/preextract.py](apps/api/preextract.py)

### D) Carrier onboarding factoring info (frontend capture; backend stores mostly as onboarding blob)

**Frontend captures**
- `factoringCompany` field
- Upload slot labeled “Factoring Agreement or Notice of Assignment”
- Implemented in [src/components/onboarding/CarrierOnboarding.jsx](src/components/onboarding/CarrierOnboarding.jsx)

**Backend onboarding persistence**
- Onboarding save endpoint merges `onboarding_data` but only promotes a limited set of fields to top-level `users/{uid}`.
- Implemented in [apps/api/onboarding.py](apps/api/onboarding.py)

**Important gap**
- Backend document definitions do **not** include a factoring agreement / notice of assignment doc type.
- Result: factoring agreement uploads likely end up as generic/untyped documents unless handled elsewhere.

## 3) Current data sources / persistence reality check

- Loads are persisted to Firestore collection `loads` (and also JSON store fallback).
- There is **no dedicated backend API** for:
  - invoices
  - invoice line items
  - payment records
  - factoring advances/reserves/fees
  - settlements
  - bank account linking (beyond document OCR/validation)

Finance/factoring screens are therefore currently **presentation prototypes**.

## 4) Key integration seams (where big changes will land)

### Backend seams
- Load lifecycle + `payment_terms`: [apps/api/main.py](apps/api/main.py), [apps/api/models.py](apps/api/models.py)
- User role/permissions: [apps/api/models.py](apps/api/models.py), [apps/api/auth.py](apps/api/auth.py)
- Document ingestion + OCR + validation (banking proofs): [apps/api/documents.py](apps/api/documents.py), [apps/api/validation.py](apps/api/validation.py)

### Frontend seams
- Shipper finance UI: [src/components/shipper/Finance.jsx](src/components/shipper/Finance.jsx)
- Shipper invoice creation/preview: [src/components/shipper/CreateInvoice.jsx](src/components/shipper/CreateInvoice.jsx), [src/components/shipper/InvoicePreview.jsx](src/components/shipper/InvoicePreview.jsx)
- Carrier factoring UI: [src/components/carrier/FactoringInvoicing.jsx](src/components/carrier/FactoringInvoicing.jsx)
- Carrier load wizard payment term mapping: [src/components/carrier/AddLoads.jsx](src/components/carrier/AddLoads.jsx)
- Route-level access control: [src/components/ProtectedRoute.jsx](src/components/ProtectedRoute.jsx)

## 5) Gaps / inconsistencies to resolve early

1) **Payment terms vocabulary drift**
- Backend `PaymentTerms` = Quick Pay / 7 / 15 / 30 / Custom.
- Frontend presents “Factoring Available” as `Custom`.
- Some docs/screens refer to `FACTORING` explicitly.

2) **No invoice/payment backend**
- UI implies invoices, payments, factoring events, funding timelines.
- Backend currently has none of these primitives.

3) **Factoring agreement doc type missing**
- Frontend onboarding asks for factoring agreement / NOA.
- Backend doc taxonomy does not define it.

4) **Service provider role ambiguity**
- Backend has role normalization for `service_provider`.
- Role enum and frontend route guards do not.

## 6) Recommended “big change” design checkpoints (proposed)

If the goal is to support financing/factoring across multiple user types, expect to introduce:

- **Invoice model**: `invoice_id`, `load_id`, `bill_to`, `carrier_id`, `shipper_id`, `status`, `terms`, `due_date`, `total`, `line_items`, `documents[]`.
- **Payment model**: `payment_id`, `invoice_id`, `method`, `processor`, `amount`, `status`, `posted_at`, `reference`.
- **Factoring model**: `factoring_case_id`, `invoice_id`, `factor_company_id`, `advance_rate`, `fees`, `reserve`, `funding_status`, `events[]`.
- **Settlement model** (carrier/driver pay): `settlement_id`, `load_id`, `carrier_id`, `driver_id`, `gross`, `deductions`, `net`, `paid_at`.
- **Bank account / payout destination**: tie validated documents (voided check) to a vetted payout destination record.

Role expectations:
- **Shipper**: creates/approves invoices, sees payable ledger.
- **Carrier**: submits invoices, opts into factoring/quickpay, sees receivable ledger.
- **Driver**: sees settlements and payout status (if applicable).
- **Broker**: similar to shipper (payables) + broker banking.
- **Admin / Super admin**: reconciliation tools, integration health, disputes.

## 7) Next step (ready when you are)

Tell me the “big change” you’re aiming for, e.g.:
- Add full invoicing + factoring workflow (advance + reserve + fees)
- Add quick-pay/early-pay financed by platform
- Support multiple factoring partners per carrier
- Add broker payables + carrier receivables ledger

…and which user types are in scope first (shipper/carrier/broker/driver). We can then turn this map into an implementation plan + data model + endpoints + UI wiring.
