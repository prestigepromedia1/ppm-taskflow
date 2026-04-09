---
title: LISTEN/NOTIFY Routing
type: concept
tags: [architecture, routing, postgresql, real-time]
audience: internal
sources: [raw/client-hub-design-spec.md, raw/taskflow-claude-md.md]
updated: 2026-04-07
confidence: high
---

# LISTEN/NOTIFY Routing

The mechanism [[entities/taskflow|TaskFlow]] uses to route status changes, notifications, and feedback between the [[concepts/three-layer-visibility|three visibility layers]]. Chosen over PG triggers on Worklenz tables to preserve the [[concepts/soft-fork-strategy|soft fork]].

## Architecture

```
PPM Route Handler (status change)
        │
        ├── Update ppm_deliverables.status
        ├── INSERT into ppm_routing_log (sequence_number, pending)
        └── NOTIFY ppm_routing, '{"deliverable_id": "...", "new_status": "...", "seq": N}'
                │
                ▼
PPM Routing Service (LISTEN ppm_routing)
        ├── Process in sequence_number order per deliverable
        ├── Apply routing rules
        ├── Update ppm_routing_log.status → completed/failed
        └── Log to ppm_audit_log
```

## Three Channels

The listener (`ppm-status-change-listener.ts`) connects to 3 PostgreSQL channels:

| Channel | Trigger | Handler |
|---------|---------|---------|
| `ppm_task_status_change` | Worklenz task status changes | Log (placeholder for webhook dispatch) |
| `ppm_status_change` | Deliverable status changes | Email client users when status → `client_review` |
| `ppm_task_created` | New portal task submissions | Email partner(s) linked to client |

## Routing Rules

| Event | Action | Notify |
|-------|--------|--------|
| Task submitted by client | Create in pending state | Admin notified |
| Admin approves | Status → queued | — |
| Admin assigns | Status → assigned | Employee notified |
| Employee starts | Status → in_progress | — |
| Employee submits for review | Status → client_review, visibility → client_visible | Client + admin |
| Client approves | Status → done, set month_completed | Employee + admin |
| Client rejects | Status → revision, attach feedback | Employee + admin |
| Comment posted | — | All other parties |
| Any status change | Audit log + master rollup | — |

## Why Not PG Triggers?
PG triggers on Worklenz tables would break the [[concepts/soft-fork-strategy|soft fork rule]] — those tables are owned by upstream. LISTEN/NOTIFY keeps all routing logic in PPM code, not in modified Worklenz schema.

## Resilience
- Auto-reconnect with exponential backoff (5s → 60s max)
- Sequence numbers on `ppm_routing_log` for ordered processing
- Rapid status changes (2 changes in <10s): process in order, last-write-wins if later sequence already processed
