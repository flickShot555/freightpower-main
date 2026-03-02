# AI Hub Firestore Migration Notes

This migration note documents Firestore collections used by the role-based assistant endpoints.

## Collections

The assistant uses user-scoped subcollections under `users/{uid}`:

1. `assistant_conversations`
2. `assistant_preferences`
3. `assistant_analytics`

### 1) `users/{uid}/assistant_conversations/{conversation_id}`

Conversation metadata document.

Expected fields:

- `conversation_id` (string)
- `assistant_type` (string: `shipper|carrier|driver|admin`)
- `created_at` (number, unix seconds)
- `updated_at` (number, unix seconds)
- `title` (string)
- `message_count` (number)
- `last_message_preview` (string)

Nested messages:

- `users/{uid}/assistant_conversations/{conversation_id}/messages/{message_id}`

Message fields:

- `id` (string)
- `role` (`user|assistant`)
- `content` (string)
- `created_at` (number)
- `metadata` (object)

### 2) `users/{uid}/assistant_preferences/{role}`

Role-specific AI preferences.

Expected fields:

- `tone`
- `verbosity`
- `response_format`
- `auto_tool_inference_default`
- `history_window`
- `updated_at`

### 3) `users/{uid}/assistant_analytics/{event_id}`

Per-request analytics event.

Expected fields:

- `event_id`
- `uid`
- `role`
- `conversation_id`
- `status`
- `latency_ms`
- `tool_calls` (array)
- `tool_calls_count`
- `successful_tool_calls`
- `failed_tool_calls`
- `prompt_chars`
- `reply_chars`
- `prompt_token_estimate`
- `completion_token_estimate`
- `cost_estimate_usd`
- `created_at`

## Security Expectations

1. Users can only access their own `users/{uid}/assistant_*` subcollections.
2. Admin aggregate analytics endpoints use backend-only access with `require_admin`.
3. Do not expose raw assistant analytics collection-group reads directly to clients.

## Index Notes

Current assistant code relies on:

- direct document reads/writes,
- subcollection streams,
- collection-group stream for `assistant_analytics` in admin view.

No custom composite index is required for the current query pattern (single collection-group stream with in-app filtering).

If server-side filtered queries are introduced later (for role + created_at), add matching composite indexes.

## Backfill/Compatibility

No destructive migration is required.

- Existing users without `assistant_preferences` receive defaults at runtime.
- Existing conversation docs continue to work.
- Analytics is append-only and safe to start empty.

## Operational Checklist

1. Confirm Firestore rules allow authenticated access to user-owned `assistant_*` paths.
2. Confirm backend service account has access to collection-group read for admin analytics.
3. Confirm no credential files (`serviceAccountKey*.json`) are committed.
