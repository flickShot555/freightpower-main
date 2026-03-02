# Invoice Generation & Handling — Required Target Process (Per Your Spec)

## Purpose
This document captures the **desired/required** end-to-end process (Broker ↔ Carrier ↔ Driver) and the minimum system behaviors needed to meet the requirements you listed.

This is written as an implementation-ready workflow spec: states, data fields, constraints, and responsibilities.

---

## 0) Data Model + Constraints (Required)

### 0.1 Loads
Required fields (minimum):
- `load_id` (internal DB key)
- `load_number` (human-facing FreightPower Load Number)
  - Must have a **DB unique index**
- `broker_id` (or `shipper_id` depending on role; but your spec assumes broker)
- `carrier_id` (nullable until awarded/confirmed)
- `status`
- Pickup/delivery info
- Rate (plus accessorials)

### 0.2 Documents (Document Vault)
A real “Document Vault” must support:
- A document record with:
  - `document_id` (DB key)
  - `owner_uid` (who uploaded)
  - `load_id` (link to load)  ← critical
  - `kind` in {`RATE_CONFIRMATION`, `POD`, `BOL`, `INVOICE_PDF`, `OTHER`}
  - storage pointer (`storage_path` / `download_url`)
  - timestamps

### 0.3 Invoices
Required fields (minimum):
- `invoice_id` (DB key)
- `invoice_number` (human-facing FreightPower Invoice Number)
  - Must have a **DB unique index**
- `load_id` (exactly one per invoice)
- `broker_id` / `payer_id`
- `carrier_id`
- `status`
- `invoice_date`
- `terms` (Net 30/45/60 or broker default)
- `due_date = invoice_date + terms`
- `amount_total` (auto-filled from load: linehaul + accessorials)
- Attachments list (references to Document Vault records)

Constraint:
- Enforce **1 invoice per load** (either by unique index on `invoices.load_id` or a transaction check).

### 0.4 Factoring Submission + Payments
Required:
- `FactoringSubmission` linked to `invoice_id`.
- `PaymentTransaction` types:
  - `FACTOR_ADVANCE`
  - `RESERVE_RELEASE`
  - optional `FEE`

---

## 1) Core Workflow Logic (Broker ↔ Carrier ↔ Driver)

### A) Load creation + unique numbering
1. When broker creates a load:
- Generate `load_number` (FreightPower Load Number)
- Persist with a **unique DB constraint/index**
- Store load with:
  - `broker_id`
  - `carrier_id = null`
  - `status = CREATED`
  - pickup/delivery info
  - rate + accessorials

### B) Award / Acceptance → Rate Confirmation
2. When broker awards load OR carrier accepts bid:
- Set `carrier_id`
- Set `status = CONFIRMED`
- Auto-generate **Rate Confirmation PDF**
- Store Rate Confirmation in Document Vault with:
  - `load_id`
  - `kind=RATE_CONFIRMATION`
- Carrier + assigned driver can view/download Rate Confirmation from the load’s documents.

### C) In-transit visibility
3. When driver starts trip:
- Set load `status = IN_TRANSIT`
- Broker can view status + tracking (if enabled) and message in load thread.

### D) Delivery → POD required
4. Driver marks `DELIVERED` and uploads:
- Required: POD
- Optional: BOL

5. Document handling:
- Save POD (and BOL if provided) to Document Vault as documents linked to `load_id`.

6. Broker notification:
- Broker receives notification on POD upload.
- Broker can view/download POD immediately.

---

## 2) Invoicing Logic (POD-gated + unique invoice numbers)

### A) Invoice eligibility gate
7. Default rule: do not allow invoice submission/send unless POD exists.
- UI: “Create Invoice” visible only when `POD_uploaded = true` for that load.

### B) Create invoice
8. Carrier clicks “Create Invoice”:
- Generate unique `invoice_number` (FreightPower Invoice Number) with DB unique index.
- Create invoice linked to:
  - `load_id`
  - `broker_id` (payer)
  - `carrier_id` (issuer)
- Auto-fill invoice amounts from load:
  - base rate + accessorials
- Attach documents (by Document Vault IDs):
  - Rate Confirmation (required)
  - POD (required)
  - BOL (optional)

### C) One-click “Invoice Package”
9. Provide **one button**: “Generate Invoice Package”
- Produces a single downloadable/submittable artifact (zip or PDF portfolio) containing:
  - Invoice PDF
  - POD/BOL
  - Rate Confirmation
  - Optional: load summary page

This same package is used for:
- Broker AP processing
- Factoring submission

---

## 3) Payment Path Logic (Wait Terms vs Factoring)

### Option A — Wait broker terms
10. Carrier selects terms:
- Net 30/45/60 OR broker default.

11. Carrier sends invoice to broker portal:
- Set `invoice.status = SENT`
- Set `due_date = invoice_date + terms`

12. Broker portal actions:
- Broker can view/download the invoice package
- Broker can:
  - DISPUTE → `invoice.status = DISPUTED`
  - (Optional) APPROVE state if you want a separate step

13. MVP payment:
- Broker pays outside the app.
- Carrier records payment (manual) OR future reconciliation.
- When payment recorded: `invoice.status = PAID`.

### Option B — Factoring (inside FreightPower)
14. Carrier selects Factoring = YES and chooses factor.

15. System creates a `FactoringSubmission` linked to `invoice_id`:
- `status = SUBMITTED`

16. FreightPower submits the Invoice Package:
- MVP: upload/email submission + store provider reference
- Phase 2: factor API + webhooks/polling

17. On factor approve/fund:
- Submission status: `APPROVED → FUNDED`
- Record `PaymentTransaction(FACTOR_ADVANCE)`

18. Remit-To auto switch (critical):
- If invoice is factored, broker portal must show **Pay To = Factor**
- Broker sees remittance instructions referencing:
  - invoice number
  - load number

19. Settlement:
- When broker pays factor and settlement happens:
  - Record `RESERVE_RELEASE` (and optional `FEE`)
  - Invoice transitions to `PAID` (or `SETTLED` if you introduce it).

---

## 4) Subscription Logic (Driver, Carrier, Broker, Service Providers)

### Subscription states (common)
`TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELLED`

### A) Carrier subscription (payer)
Gate when not `ACTIVE/TRIAL`:
- add trucks/drivers
- create/send invoices
- submit factoring
- enable advanced tracking/verification features

Always allow even if `PAST_DUE/SUSPENDED`:
- login/view
- delivery completion
- POD upload
- view/download existing documents

### B) Broker subscription (payer)
Gate when not `ACTIVE/TRIAL`:
- create/award new loads
- enable tracking/advanced tools
- invoice AP actions beyond view (optional)

Always allow:
- view existing loads/invoices read-only

### C) Driver (not a payer)
Driver is included under carrier subscription.
Even if carrier is `PAST_DUE/SUSPENDED`, driver must still be able to:
- mark delivered
- upload POD

### D) Service Providers subscription
If not `ACTIVE/TRIAL`:
- listing hidden
- cannot receive leads/orders
- verified badge removed

---

## 5) Required Minimum Status Sets

### Loads
- `CREATED`
- `CONFIRMED`
- `IN_TRANSIT`
- `DELIVERED`
- `CLOSED`

### Invoices
- `DRAFT`
- `SENT`
- `DISPUTED`
- `FACTOR_SUBMITTED`
- `FUNDED`
- `PAID`

---

## 6) Suggested API Surface (Implementation Guidance)
(Names are suggestions; align to your backend conventions.)

### Loads
- `POST /loads` → creates load, returns `load_id` + `load_number`
- `POST /loads/{load_id}/award` or `/accept-carrier` → sets `carrier_id`, status `CONFIRMED`, generates Rate Confirmation and stores as Document Vault doc
- `POST /loads/{load_id}/status` (driver) → moves to `IN_TRANSIT` or `DELIVERED` and uploads POD/BOL to vault

### Documents
- `POST /loads/{load_id}/documents` → upload doc with `kind`
- `GET /loads/{load_id}/documents` → list docs for load

### Invoices
- `POST /loads/{load_id}/invoices` → create invoice with auto-fill + required attachments
- `POST /invoices/{invoice_id}/send` → broker portal submission
- `POST /invoices/{invoice_id}/dispute` → broker disputes
- `POST /invoices/{invoice_id}/payments` → record payments
- `POST /invoices/{invoice_id}/factoring/submit` → create factoring submission + submit invoice package

### Invoice Package
- `GET /invoices/{invoice_id}/package` → returns a zip/pdf portfolio containing Invoice PDF + POD/BOL + Rate Confirmation + summary

---

## 7) MVP vs Phase 2 Notes
- MVP can treat broker payment as off-platform while still supporting:
  - correct due dates
  - dispute state
  - invoice package downloads
- Phase 2 introduces:
  - factor API integration
  - webhook-driven state updates
  - automated settlement accounting
