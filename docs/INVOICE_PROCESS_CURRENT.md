# Invoice Generation & Handling — Current Implementation (as of 2026-01-26)

## Scope
This document describes the **current** end-to-end process implemented in this repo for:
- Load creation → carrier assignment → driver status updates (incl. POD photo capture)
- Invoice creation/issuance/sending, PDF generation, emailing
- (Basic) factoring submission + webhook ingestion
- Payment recording

It also includes an **alignment/gap matrix** against your stated requirements.

---

## 1) Current Load Workflow

### 1.1 Load creation
There are two paths in the backend:

**A) “3-step load wizard” (primary newer flow)**
- `POST /loads/step1` creates a load using `generate_load_id(region="ATL")`.
  - Stores: `load_id`, `created_by`, `creator_role`, timestamps, `status=draft`, origin/destination as **strings**, pickup/delivery dates, equipment, weight, placeholders for later steps.
- `PATCH /loads/{load_id}/step2` updates pricing and calculates `total_rate`.
- `PATCH /loads/{load_id}/step3` sets `status` to:
  - `posted` if `status=ACTIVE`
  - `draft` if `status=DRAFT`
  - Also stores: visibility and “marketplace” preferences, plus convenience fields like `shipper_company_name`, `total_distance`, `total_price`.

**B) “Legacy load endpoint” (kept for backward compatibility)**
- `POST /loads` (legacy) saves the request payload into the JSON store and triggers AI matching alerts.

**Implemented:** loads now also have a **public, sequential `load_number`** (counter-based) in addition to `load_id`.

### 1.2 Marketplace bidding / award
- Carriers bid via `POST /loads/{load_id}/tender-offer` (exists in `apps/api/main.py`; not detailed here).
- Shipper/broker awards a carrier via:
  - `POST /loads/{load_id}/accept-carrier`
  - This transitions a load from `posted` → `covered` and sets:
    - `assigned_carrier` and `assigned_carrier_id`
    - `assigned_carrier_name`
    - `covered_at`
  - Also updates/re-writes offer statuses (`accepted` / `rejected`) and logs status changes.

**Implemented:** awarding a carrier now auto-generates a **Rate Confirmation PDF** and stores it as a **load-linked document** under `loads/{load_id}/documents/*`.

### 1.3 Driver assignment and in-transit / delivery status
- Driver assignment exists (endpoints exist such as `/loads/{load_id}/assign-driver` and `/loads/{load_id}/driver-accept-assignment`).
- Driver status updates:
  - `POST /loads/{load_id}/driver-update-status`
  - Valid transitions:
    - `covered` → `in_transit`
    - `in_transit` → `delivered`
  - Proof images:
    - If driver includes `photo_url`, backend sets:
      - `pickup_photo_url` when moving to `in_transit`
      - `delivery_photo_url` when moving to `delivered`

**Implemented:** driver photo URLs are now also mirrored into the **load-linked Document Vault** as `BOL` and `POD` entries (best-effort) to support invoicing/package assembly.

---

## 2) Current Invoicing Workflow

### 2.1 Eligibility
Eligibility is implemented server-side via:
- `GET /finance/eligible-loads`

Rules (current):
- Only **carriers** can list eligible loads.
- Load status must be **`delivered` or `completed`**.
- Load must be assigned to the carrier (`assigned_carrier` / `assigned_carrier_id`) OR created by carrier.
- There must be **no existing invoice** where `invoices.load_id == load_id` (Firestore query).

Response enrichment:
- Eligible loads now include `load_number` when available.

**Note:** eligibility does **not** explicitly require that a POD exists. (POD is enforced later when issuing/sending.)

### 2.2 Invoice creation (carrier only)
- `POST /invoices` (carrier-only)

Rules (current):
- Load must be `delivered/completed`.
- Load must be assigned to the carrier.
- Enforces **one invoice per load** by querying Firestore for `load_id`.
- `invoice_id` is a UUID.
- `invoice_number` is now **normalized + uniqueness enforced**, and auto-generated invoice numbers embed `load_number` (when available) plus issuer/payer tags and a sequence.
- If a custom `invoice_number` is provided and the load has a `load_number`, the `invoice_number` must include that `load_number`.

Payer resolution:
- If not provided, payer is derived from the load:
  - `payer_uid = load.created_by`
  - `payer_role = load.creator_role` (must be `shipper` or `broker`)

POD attachment behavior:
- Attachments can be provided explicitly (for non-core invoice documents).
- **POD/BOL/RATE_CONFIRMATION are sourced only from the load-linked Document Vault**: `loads/{load_id}/documents`.
- The backend does **not** attach POD/BOL from the user onboarding vault anymore.
- If the load has no linked POD document, the backend will block issue/send/package (and non-draft invoice creation).

POD gating:
- If `save_as_draft=false` (default), POD is **required**.
- If `save_as_draft=true`, invoice can be created without POD.

### 2.3 Issuing and sending
- `POST /invoices/{invoice_id}/issue`
  - Only allowed from `draft` → `issued`.
  - Re-checks and auto-attaches POD/BOL/RATE_CONFIRMATION from the load-linked Document Vault.
  - Requires POD.

- `POST /invoices/{invoice_id}/send`
  - Transitions `issued` → `sent`.
  - Requires POD.

**Implemented:** “send” remains a state transition, but is now **store-aware** and will auto-attach relevant documents (POD/BOL/RATE_CONFIRMATION) from the load-linked Document Vault when possible.

**Implemented:** A one-click invoice package endpoint exists:
- `GET /invoices/{invoice_id}/package.zip` returns a ZIP containing `invoice.json`, `load.json`, `manifest.json`, and the collected documents.

Package document rules:
- Collected documents come **only** from `loads/{load_id}/documents` for POD/BOL/RATE_CONFIRMATION.
- Package generation is blocked if load-linked POD is missing.

### 2.3.1 Payer portal (broker/shipper invoice receipt)
Payers (brokers/shippers) can now receive and manage invoices **inside the app**.

Backend endpoints:
- `GET /payer/invoices`
  - Returns invoices where `payer_uid == current_user.uid`.
  - Supports optional filters:
    - `status` (exact match)
    - `date_from` / `date_to` (filters by `sent_at` fallback to `issued_at`/`created_at`)
    - `overdue_only=true` (computed based on `due_date < now`, excluding `paid`/`void`)
- `GET /payer/invoices/{invoice_id}`
  - Returns invoice only if `invoice.payer_uid == current_user.uid` (admins can override).
- `POST /payer/invoices/{invoice_id}/dispute`
  - Payer-only action.
  - Stores dispute reason/message and sets `status = disputed`.

Package access:
- `GET /invoices/{invoice_id}/package.zip` is RBAC-safe and is accessible to both:
  - the issuer (carrier)
  - the payer (shipper/broker)

Frontend UI entry point:
- Shipper/Broker dashboard includes a new navigation item: **Invoices Received / Bills**.
- Deep links are supported via:
  - `/shipper-dashboard?nav=bills&invoice_id=<invoice_id>`

### 2.4 Payment recording
- `POST /invoices/{invoice_id}/payments`

Rules (current):
- Issuer (carrier) and payer (shipper/broker) can record a payment.
- Payment is written to `payment_transactions/{payment_id}`.
- Invoice is set to:
  - `paid` if `amount_paid >= amount_total`
  - else `partially_paid`

### 2.5 Overdue
- `POST /finance/overdue/run` (admin)
- `mark_overdue_invoices()` sets `overdue` when `due_date < now` for certain statuses.

### 2.6 Factoring (current MVP)
- `POST /invoices/{invoice_id}/submit-factoring`

Rules (current):
- Invoice must have `factoring_enabled=true`.
- Requires POD.
- Creates a record in `factoring_submissions/{submission_id}`.
- Calls a provider (includes a “mock” provider).
- Updates invoice status to `factoring_submitted` → (`factoring_accepted` or `factoring_rejected`).

Webhook ingestion:
- `POST /factoring/webhooks/{provider}` with optional `X-Webhook-Secret`.
- Supports minimal event types like `factoring.accepted`, `factoring.rejected`, `paid`.

**Important:** there is no “FUNDED” state or explicit creation of `FACTOR_ADVANCE` / `RESERVE_RELEASE` transactions today (beyond generic payments).

---

## 3) Current PDF Generation + Email

### 3.1 PDF generation
- PDF is generated client-side using `jsPDF`.
- Preferred flow now fetches authoritative Firestore context:
  - `GET /invoices/{invoice_id}/pdf-context` → `{ invoice, carrier, shipper, load, driver }`
  - The PDF intentionally does **not** show invoice status.

### 3.2 Emailing
- `POST /invoices/{invoice_id}/email`
- Sends an email with a PDF attachment via SMTP.
- Feature-flagged with `ENABLE_INVOICE_EMAILS`.

**Note:** `POST /invoices/{invoice_id}/send` always transitions the invoice to `sent` (if allowed) and makes it visible in the payer portal immediately. If `ENABLE_INVOICE_EMAILS=true`, the backend may also send a lightweight payer notification email (best-effort, non-blocking).

---

## 4) Alignment / Gaps vs Your Requirements

Legend: ✅ Implemented | 🟨 Partial | ❌ Missing

### 4.1 Core workflow (Broker ↔ Carrier ↔ Driver)
1) Unique FreightPower Load Number (`load_number`, DB unique index)
- ✅ Loads now have a public, sequential `load_number` in addition to `load_id`.
  - Counter-based generation (e.g., `FP-ATL-LD-000001`) ensures uniqueness.

2) Load stores broker_id, carrier_id (nullable), status, pickup/delivery info, rate
- 🟨 Load stores `created_by` + `creator_role` (shipper/broker), assignment via `assigned_carrier`, and pricing fields.
- ❌ A dedicated `broker_id` field and a dedicated `carrier_id` field (nullable until awarded) are not consistently used.

3) Award/accept → set `carrier_id`, set status `CONFIRMED`, auto-generate Rate Confirmation PDF, save in load-linked Document Vault, carrier+driver can download
- 🟨 Award exists (`posted` → `covered`, assigns carrier).
- 🟨 Status name remains `covered` (not renamed to `confirmed`).
- ✅ Award now auto-generates a Rate Confirmation PDF and stores it in the load-linked Document Vault.

4–5) In-transit visibility and messaging
- 🟨 Driver transitions exist (`covered` → `in_transit` → `delivered`).
- 🟨 Messaging/tracking is outside this finance module; not part of invoice handling.

6–8) Delivery → POD required; POD saved in Document Vault linked to load; broker notified and can download
- 🟨 POD capture exists as `delivery_photo_url` on load when driver marks `delivered`.
- ✅ Driver photo URLs are mirrored into the load-linked Document Vault (best-effort) as `POD` and `BOL` entries.
- ❌ No dedicated broker notification flow tied specifically to POD upload.

### 4.2 Invoicing logic
9) Don’t allow invoice send/submission unless POD exists; UI Create Invoice only when POD_uploaded
- ✅ Backend enforces POD required to `issue`, `send`, and `submit-factoring`.
- ✅ UI now receives an explicit `has_pod` flag on eligible loads and disables Issue/Issue+Send until POD exists (Draft remains available).

10) Create invoice → unique `invoice_number` with DB unique index; links to load_id, broker_id, carrier_id; auto-fill from load; attach Rate Confirmation + POD
- 🟨 Invoice links to `load_id` and (derived) payer/issuer.
- ✅ One invoice per load is enforced.
- ✅ Invoice numbering is normalized and uniqueness enforced; auto-generated invoice numbers embed `load_number` when available.
- ✅ Send is store-aware and auto-attaches Rate Confirmation + POD/BOL from the load-linked Document Vault when available.
- 🟨 Auto-fill is partial: amount is provided by UI; due date can be derived from `payment_terms` but only supports 2/7/15/30.

11) One-click “Invoice Package” button (Invoice PDF + POD/BOL + Rate Confirmation + load summary)
- ✅ Implemented: `GET /invoices/{invoice_id}/package.zip` bundles invoice/load JSON plus available supporting docs (POD/BOL/Rate Confirmation) with a manifest.

### 4.3 Payment path logic
12–16) Wait broker terms, dispute/approve, broker pays outside, carrier marks paid
- 🟨 Terms: supported via `due_in_days` or limited mapping from load `payment_terms`.
- ✅ Dispute workflow implemented: invoices can move to `DISPUTED` and be resolved via API.
- ✅ Payment can be recorded; invoice becomes `paid`.

17–22) Factoring path, factoring submission, funded state, remit-to switch, reserve release/fee
- 🟨 Factoring submission exists (basic) + webhook ingestion.
- ❌ No “FUNDED” invoice state.
- ❌ No “Pay To = Factor” / remit-to switching in broker portal.
- ❌ No reserve/fee transaction modeling beyond generic payment records.

### 4.4 Subscription gating
- ❌ Subscription state machine and action gating (carrier/broker/service providers) is not implemented in the invoice/load flows reviewed.

### 4.5 Required uniqueness + DB constraints
- ✅ `load_number` is generated via a Firestore counter and persisted on loads.
- ✅ `invoice_number` uniqueness is enforced (transactional when possible; safe fallbacks for unit tests).
- ✅ Each invoice has exactly one `load_id`.

### 4.6 Status sets
Required minimum:
- Load: CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, CLOSED
- Invoice: DRAFT, SENT, DISPUTED, FACTOR_SUBMITTED, FUNDED, PAID

Current:
- Load: draft, posted, tendered, accepted, covered, in_transit, delivered, completed, cancelled
- Invoice: draft, issued, sent, disputed, factoring_submitted, factoring_accepted/rejected, partially_paid, paid, overdue, void

Result:
- 🟨 Conceptually similar in places, but does not match the required minimum set and is still missing FUNDED.
