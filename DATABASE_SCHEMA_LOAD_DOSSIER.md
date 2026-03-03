# Load Dossier Firestore Schema (Admin-Viewable)

Goal: for each load, store (a) all operational documents, (b) all important timestamps, and (c) the related people details in a way that is **viewable to admins** but not accidentally exposed to non-admin users.

This repo uses Firestore. The schema below follows the existing `loads/{load_id}` + subcollections pattern.

## 1) Core Load Document

**Path:** `loads/{load_id}`

- **Public-ish load fields**: origin/destination, dates, equipment, commodity, etc.
- **Workflow fields**: `status`, `workflow_status`, `workflow_status_updated_at`.
- **Important timestamps** (examples; many are already present in code):
  - `created_at`, `updated_at`
  - `contract_accepted_at`
  - `at_pickup_at`, `picked_up_at`
  - `arrived_delivery_at`, `delivered_at`, `pod_submitted_at`
  - `bol_locked_at` (locks BOL after pickup)
- **Convenience pointers to latest operational docs**:
  - `rate_confirmation_doc_id`, `rate_confirmation_storage_path`
  - `bol_doc_id`, `bol_storage_path`, `bol_uploaded_at`
  - `pod_doc_id`, `pod_storage_path`, `pod_uploaded_at`

### Contract signature state

**Field:** `contract`

- `contract.rate_confirmation.{shipper_signed_at, carrier_signed_at, ...}`
- `contract.bol.{shipper_signed_at, driver_signed_at, ...}`

These are used to show signature status in the UI.

## 2) Load Operational Documents

**Path:** `loads/{load_id}/documents/{doc_id}`

One document record per upload/generation.

Recommended fields (already largely present):
- `doc_id`, `load_id`, `load_number`
- `kind` (e.g., `RATE_CONFIRMATION`, `BOL`, `POD`, `EPOD`, `BOL_SIGNATURE`, `POD_SIGNATURE`)
- `filename`, `content_type`, `size_bytes`, `sha256`
- `storage_path` (GCS path)
- `source` (`upload`, `generated`, `external_url`, `pickup`, `epod`, ...)
- `uploaded_by_uid`, `uploaded_by_role`
- `created_at`, `uploaded_at`, `updated_at`

Admins can query this subcollection directly for “all uploaded documents for a load”.

## 3) Workflow Timeline (Append-only)

**Path:** `loads/{load_id}/workflow_status_logs/{autoId}`

Each entry:
- `timestamp`
- `actor_uid`, `actor_role`
- `old_workflow_status`, `new_workflow_status`
- `notes`

## 4) Pickup / Delivery Event Records

- Pickup: `loads/{load_id}/pickup/{pickup_event_id}`
- Delivery / ePOD: `loads/{load_id}/epod/{epod_id}`

These store GPS, validations, timestamps, and signed receiver/shipper names.

## 5) Admin-Only Load Snapshot (People details + indexes)

To keep admin-only data out of normal load reads, store it under a subcollection.

**Path:** `loads/{load_id}/admin/snapshot`

Recommended fields:
- `participants.shipper` / `participants.carrier` / `participants.driver`
  - `{ uid, role, name, company_name, email, phone, updated_at }`
- `timestamps` (duplicated summary for quick admin views)
- `documents_index` (latest doc per `kind`, for quick lookup)
- `updated_at`

This doc is updated best-effort on:
- document upload/generation
- pickup completion
- other key milestones (as you expand coverage)

## 6) Admin-Only Event Log

**Path:** `loads/{load_id}/admin_events/{event_id}`

Fields:
- `event_id`, `load_id`, `event_type`, `created_at`
- actor info: `actor_uid`, `actor_role`, `actor_email`, `actor_name`
- `data` (event payload)

Useful for auditing “who did what” beyond workflow status changes.

## Admin Visibility API

This repo exposes a single admin-only endpoint that returns a complete “load dossier”:

- `GET /admin/loads/{load_id}/dossier`

It returns:
- `load` (core load doc)
- `documents` (with fresh signed URLs)
- `workflow_history`
- `pickup_events`, `epod_events`
- `admin_snapshot`, `admin_events`
