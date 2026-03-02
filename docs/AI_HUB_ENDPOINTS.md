# AI Hub Role Assistant Endpoints

This document covers the role-based assistant endpoints implemented in `apps/api/role_chat.py`.

## Authentication

All endpoints require a valid Firebase bearer token:

```http
Authorization: Bearer <firebase_id_token>
```

Supported assistant roles are:

- `shipper`
- `carrier`
- `driver`
- `admin`

## Core Chat

### POST `/chat/assistant`

Send one assistant turn and receive the assistant response plus executed tool metadata.

Request body:

```json
{
  "message": "Summarize my current load status",
  "conversation_id": "driver_abc123",
  "tool_name": "get_load_summary",
  "tool_args": {},
  "include_history": true,
  "max_history_messages": 30,
  "auto_tool_inference": true
}
```

Response body:

```json
{
  "conversation_id": "driver_abc123",
  "role": "driver",
  "reply": "Load summary: in_transit=1. Pending offers: 0.",
  "tools_executed": [
    {
      "name": "get_load_summary",
      "ok": true,
      "result": {
        "total_loads": 1
      },
      "error": null
    }
  ],
  "created_at": 1772542200.0,
  "message_id": "f14f8ccf-87e1-4f19-9b29-cd405f88ea2f"
}
```

Notes:

- `message_id` is returned for the assistant message to support frontend de-duplication.
- If a tool is denied for the current role, the request still returns `200` with `tools_executed[].ok=false`.
- LLM retries use bounded exponential backoff for transient failures.

## Conversation Management

### GET `/chat/assistant/conversations?limit=30`

List assistant conversations for the current user and role scope.

Response fields:

- `conversations[]`
- `total`

### GET `/chat/assistant/conversations/{conversation_id}?limit=100`

Get messages for one conversation (role-scoped).

Response fields:

- `conversation_id`
- `messages[]`
- `total`

### DELETE `/chat/assistant/conversations/{conversation_id}`

Delete a conversation and its messages.

Response:

```json
{
  "ok": true,
  "conversation_id": "driver_abc123",
  "deleted_messages": 12
}
```

### GET `/chat/assistant/conversations/{conversation_id}/export?format=markdown|json&limit=1000`

Export one conversation.

- `format=markdown`: plain text download response.
- `format=json`: JSON payload with conversation metadata and messages.

## Preferences

### GET `/chat/assistant/preferences`

Read assistant preferences for the current role scope.

Response fields:

- `tone`: `balanced|professional|supportive|direct`
- `verbosity`: `short|medium|long`
- `response_format`: `plain|bullets|structured`
- `auto_tool_inference_default`: boolean
- `history_window`: `1..100`
- `updated_at`

### PATCH `/chat/assistant/preferences`

Update one or more preference fields for the current role scope.

Request example:

```json
{
  "tone": "direct",
  "verbosity": "short",
  "response_format": "bullets",
  "auto_tool_inference_default": false,
  "history_window": 45
}
```

Validation:

- Invalid enum values return `400`.
- `history_window` must be between `1` and `100`.

## Analytics

### GET `/chat/assistant/analytics?days=30&limit=2000`

Role-scoped user analytics summary.

Response fields:

- `total_requests`
- `successful_requests`
- `failed_requests`
- `total_tool_calls`
- `avg_latency_ms`
- `estimated_prompt_tokens`
- `estimated_completion_tokens`
- `estimated_cost_usd`

### GET `/chat/assistant/admin/analytics?days=30&limit=8000&role=driver`

Admin-only aggregated analytics across users.

Response fields:

- `total_events`
- `successful_events`
- `failed_events`
- `avg_latency_ms`
- `estimated_cost_usd`
- `by_role`
- `top_tools[]`

Validation:

- `role` filter must be one of `shipper|carrier|driver|admin` when provided.

## Tools

Explicit and inferred tool names:

- `list_my_loads`
- `get_load_summary`
- `get_load_details`
- `get_load_offers`
- `accept_offer`
- `reject_offer`
- `get_required_documents`
- `get_compliance_tasks`
- `get_earnings_snapshot`
- `get_marketplace_loads`
- `get_nearby_services`

Tool access is role-constrained in `_ROLE_TOOL_ACCESS`.
