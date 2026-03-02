# AI Hub Telemetry Monitoring Runbook

This runbook covers monitoring and triage for AI Hub assistant telemetry.

## Data Source

Telemetry events are written to:

- `users/{uid}/assistant_analytics/{event_id}`

Aggregated views are exposed by API endpoints:

- `GET /chat/assistant/analytics`
- `GET /chat/assistant/admin/analytics` (admin only)

## Key Metrics

Track these metrics daily:

1. `total_events` / `total_requests`
2. success rate = `successful / total`
3. failure rate = `failed / total`
4. average latency (`avg_latency_ms`)
5. total tool calls and top tools
6. estimated token and cost totals

## Suggested Alert Thresholds

Use these initial thresholds and tune after baseline:

1. failure rate > 5% over 15 minutes
2. avg latency > 12000 ms over 15 minutes
3. sudden drop in total events by > 50% vs previous hour
4. sudden cost spike > 2x vs 7-day hourly baseline

## Triage Playbook

When failure rate spikes:

1. Check API logs for `/chat/assistant` errors and tool execution errors.
2. Check for auth failures (`401/403`) and role mismatch issues.
3. Check upstream LLM transient errors (`429/5xx/timeouts`).
4. Verify retry path is active (look for delayed but successful replies).
5. Validate Firestore availability and write success for analytics events.

When latency spikes:

1. Inspect LLM request time and timeout behavior.
2. Inspect tool execution path for slow queries (loads, services).
3. Confirm no unexpected repeated frontend polling loops.
4. Verify host/network health.

When cost spikes:

1. Check token estimate increase from unusually long prompts/history.
2. Confirm `history_window` defaults and per-user overrides.
3. Check for rapid repeated requests from a single user/session.

## Daily Checks

1. Pull admin analytics for last 1 day and 7 days.
2. Compare by-role usage (`driver`, `carrier`, `shipper`, `admin`).
3. Review top tools and failing tool names.
4. Sample 5 failed events and classify root cause.

## Incident Severity Guide

1. Sev-1: assistant unavailable for all roles.
2. Sev-2: high failure rate or severe latency affecting active users.
3. Sev-3: single-role degradation or non-critical analytics ingestion issues.

## Local Smoke Commands

Run local validation before deployment:

```powershell
# Backend assistant tests
.\.venv\Scripts\python.exe -m pytest apps/api/tests/test_role_chat_assistant.py -q

# Frontend production build
npm run build
```

## Rollback Guidance

If a release introduces assistant instability:

1. Disable new frontend AI Hub actions behind feature flag if available.
2. Revert backend assistant module to last known stable commit.
3. Keep analytics logging best-effort (must never block chat response path).
4. Re-run smoke commands above before re-enable.
