---
title: Revision Loop
type: concept
tags: [workflow, feedback, client-portal, approval]
audience: internal
sources: [raw/client-hub-design-spec.md]
updated: 2026-04-07
confidence: high
---

# Revision Loop

The feedback cycle in [[entities/taskflow|TaskFlow]] when a client rejects work. Central to the [[concepts/three-layer-visibility|3-layer visibility]] model — structured feedback routes from client → employee with full audit trail.

## Flow

```
client_review → Client rejects → revision
    │                                │
    │                                ├── Structured feedback attached
    │                                ├── Employee + admin notified
    │                                └── Employee reworks
    │                                        │
    │                                        ▼
    └──────────────────────────── client_review (resubmit)
                                        │
                                   Client reviews again
                                   Loop until approved
```

## Structured Feedback

When rejecting, the client selects from predefined feedback reasons (admin-manageable):

| Reason | Description |
|--------|-------------|
| Missing items | Required form fields not filled out |
| Unclear scope | Description needs more detail |
| Wrong channel/type | Incorrect dropdown values |
| Duplicate request | Task already submitted |
| Out of scope | Not covered by retainer |
| Budget exceeded | Retainer hours depleted |
| Needs assets | Reference files or links missing |
| Other | See comment for details |

These reasons are seeded via migration `018_ppm_feedback_reasons_seed.sql` and stored in `ppm_dropdown_options` (category: `feedback_reason`).

## Audit Trail
Every revision cycle is logged in `ppm_audit_log` with feedback details, creating a complete history of client-employee interactions per deliverable.

## Admin Feedback Loop
Admins can also send tasks back to clients (from `queued` state) using the same structured feedback reasons — e.g., "needs assets" or "unclear scope" before assigning to an employee.
