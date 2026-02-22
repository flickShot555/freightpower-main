# AI Assistant (AI Hub) — Architecture Proposal

## Goals
- Provide a single AI assistant experience across **all user roles** (Driver, Carrier, Shipper, Admin), while staying **role-aware**.
- Reuse the existing Groq-based backend utilities (already present in `apps/api`).
- Keep data access safe: least privilege, auditable, and deterministic fallbacks when LLM is unavailable.

## Centralized vs per-user model
### Centralized model (recommended)
- **One orchestration layer** in the backend that:
  - Selects the LLM provider/model (Groq first, future providers later).
  - Applies role-based system prompts and policies.
  - Performs tool/function calling against approved backend “tools”.
  - Logs every request/response with metadata.
- Users get different behavior via **policy + context**, not separate models.

Why this fits FreightPower:
- You already centralize auth + role in the API, and Groq config lives in env (`GROQ_API_KEY`, model names).
- You can enforce consistent guardrails (PII handling, refusal rules, rate limits) once.
- Cheaper + simpler operations than “per-user model fine-tuning”.

### Per-user model
- Each user has personalized weights/prompts.
- Operationally heavy (training, evaluation, drift, abuse), and hard to secure.
- Usually unnecessary unless you need strong personalization beyond preferences.

Recommendation: **Centralized orchestration + per-user memory/preferences**.

## Proposed backend shape
### 1) API endpoints
Add a small, explicit API surface (FastAPI router), for example:
- `POST /ai/chat`
  - Input: `{ messages: [...], mode: "driver"|"carrier"|..., context: {...} }`
  - Output: `{ message, tool_calls?, citations?, usage? }`
- `POST /ai/summarize`
- `POST /ai/extract` (structured extraction for forms)

Important: keep endpoints **role-aware** using `get_current_user`.

### 2) Orchestrator
A single module (e.g. `apps/api/ai/orchestrator.py`) that:
- Builds a **system prompt** per role.
- Injects allowed tools per role.
- Applies hard limits:
  - max tokens
  - max tool calls
  - timeouts
  - content filtering rules

### 3) Tools (function calling)
Expose “capabilities” as backend functions, not direct DB access from the LLM.
Examples:
- `get_onboarding_status(uid)`
- `list_required_docs(uid)`
- `get_load_status(load_id)`
- `search_kb(query)` (static docs / curated KB)

The orchestrator chooses tools; tools enforce auth/role and return structured JSON.

### 4) Memory (optional, incremental)
Do **not** start with long-term memory for everything.
Start with:
- Per-user preferences: language, timezone, role goals.
- Short-term conversation history stored by conversation id.

If/when adding longer-term memory:
- Store only explicit, user-confirmed facts.
- Provide “forget” controls.

## Data access + safety
- Enforce **least privilege**: the assistant can only access data via approved tools.
- Log:
  - request id, uid, role
  - tool calls made
  - latency + token usage
- Add rate limits per uid.
- Provide deterministic fallback for critical flows (e.g., onboarding checklist) when LLM fails.

## Frontend (AI Hub)
AI Hub should be a thin UI shell:
- Chat UI + message history
- Optional quick actions (buttons that hit non-LLM endpoints)
- Role-aware suggestions (driver: compliance/docs, carrier: load ops)

Avoid embedding secrets or provider keys in the frontend.

## Migration path
1. Ship a **minimal** `/ai/chat` that wraps the current Groq client utilities.
2. Add tool calling for 2–3 “high value” tools (onboarding status, load status).
3. Add retrieval (KB search) once prompts are stable.
4. Add memory controls if needed.

## Notes on current repo alignment
- Existing Groq usage in backend suggests Groq is already the first provider.
- The Driver UI already has an `AiHub` component; it can call the new endpoints when you’re ready.
