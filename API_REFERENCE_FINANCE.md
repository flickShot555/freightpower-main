# Finance / Invoicing / Factoring API

This module adds invoices, payments, factoring submissions, and idempotent webhook ingestion.

## Auth
All endpoints require `Authorization: Bearer <firebase_id_token>` unless otherwise noted.

## Endpoints

### `GET /invoices`
List invoices visible to the current user.

- Carrier/Driver: invoices where `issuer_uid == current_user.uid`
- Shipper: invoices where `payer_uid == current_user.uid`
- Broker: union of both
- Admin/Super Admin: returns latest invoices

Query params:
- `limit` (default `200`)

Response:
- `{ invoices: InvoiceRecord[], total: number }`

### `POST /invoices`
Create an invoice for a delivered/completed load.

Roles: `carrier`, `broker`, `admin`, `super_admin`

Body: `InvoiceCreateRequest`

Notes:
- `payer_uid` defaults to `load.created_by`
- `due_date` defaults to `load.payment_terms` when available
- If `load.delivery_photo_url` exists, a `POD` attachment is auto-added
- The load is updated best-effort with `invoice_id` and `invoice_number`

### `GET /invoices/{invoice_id}`
Get a single invoice.

### `POST /invoices/{invoice_id}/send`
State transition to `sent`.

### `POST /invoices/{invoice_id}/submit-factoring`
Create a factoring submission (provider-agnostic).

Body:
- `{ provider: string }`

Behavior:
- Enforces a minimal document requirement (`POD`) before submission
- Uses a mock provider for now (accepts invoices <= $10k)
- State progression:
	- Invoice transitions `sent -> factoring_submitted -> factoring_accepted|factoring_rejected`
	- Submission transitions `submitted -> accepted|rejected`

### `POST /invoices/{invoice_id}/payments`
Record a payment transaction and update invoice to `partially_paid` or `paid`.

Body: `PaymentCreateRequest`

### `POST /factoring/webhooks/{provider}`
Idempotent webhook ingestion.

Body: `FactoringWebhookRequest`

Idempotency:
- Unique key is `{provider}:{event_id}` stored in `factoring_webhook_events`
- If already processed, returns the existing record

Optional auth hardening:
- If `FINANCE_WEBHOOK_SECRET` is set in backend env, requests must include header `X-Webhook-Secret` with the same value.

### `GET /finance/summary`
Returns KPI totals for the current role scope.

### `GET /finance/forecast?range_days=30`
Returns a simple cash forecast for the next N days.

### `POST /finance/overdue/run`
Admin-only helper to run overdue marking immediately.

## Collections (Firestore)
- `invoices`
- `payment_transactions`
- `factoring_submissions`
- `factoring_webhook_events`
