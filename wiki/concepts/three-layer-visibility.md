---
title: Three-Layer Visibility Model
type: concept
tags: [architecture, visibility, client-portal, rbac]
audience: internal
sources: [raw/taskflow-claude-md.md]
updated: 2026-04-07
confidence: high
---

# Three-Layer Visibility Model

The core architectural pattern of [[entities/taskflow|TaskFlow]]: Master → Internal → Client visibility tiers that control what each user type sees.

## The Three Layers

| Layer | Who Sees It | Purpose |
|-------|-------------|---------|
| **Master** | Jon (owner) | Cross-client dashboard, retainer utilization, all data |
| **Internal** | PPM team (partners + employees) | Task execution, internal status, raw hours |
| **Client** | Client users (via portal) | Their deliverables only, sanitized status labels |

## Status Visibility

Statuses have three visibility tiers — client-facing labels are sanitized:

| Status | Visibility | Client Sees |
|--------|-----------|-------------|
| `queued` | Internal | "Submitted" |
| `in_progress` | Internal | "In Progress" |
| `internal_review` | Internal | "In Progress" |
| `client_review` | Client | "Awaiting Review" |
| `revision` | Shared | "Revision" |
| `approved` | Client | "Approved" |
| `done` | Client | "Done" |

## Enforcement

- **Database level:** PostgreSQL RLS policies filter by `ppm.current_client_id` session variable
- **Middleware level:** `require-client-auth` sets RLS context per request
- **Frontend level:** Portal components only render client-visible fields; admin components show everything

## Why Not Per-Route Filtering?
RLS at the database level means even a bug in application code can't leak data across clients. The middleware sets `SET LOCAL ppm.current_client_id = '<id>'` on each request — every query is automatically scoped.
