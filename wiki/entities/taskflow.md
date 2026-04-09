---
title: PPM TaskFlow
type: entity
tags: [taskflow, project-management, worklenz, client-portal]
audience: both
sources: [raw/taskflow-claude-md.md, raw/client-hub-design-spec.md, raw/client-hub-test-plan.md]
updated: 2026-04-07
confidence: high
---

# PPM TaskFlow

PPM's project management and client hub. A [[concepts/soft-fork-strategy|soft fork]] of [Worklenz](https://github.com/Worklenz/worklenz) that replaces Monday.com ($450/month) with a self-hosted solution adding [[concepts/three-layer-visibility|3-layer visibility]] and automated feedback routing via [[concepts/listen-notify-routing|LISTEN/NOTIFY]].

## Why It Exists

Monday.com lacks client portals, automated feedback routing, and cross-board visibility without enterprise pricing. 13 of 16 PPM clients have zero Monday access. The core pain: missed deadlines because status doesn't route to the right person, and client feedback gets lost between boards.

**Narrowest wedge:** One canonical `deliverable` model with three synced views (Master, Internal, Client) and guaranteed feedback routing.

## Architecture

- **Repo:** `prestigepromedia1/ppm-taskflow` (public, AGPL-3.0)
- **Stack:** Express.js + React 18 + PostgreSQL + Ant Design
- **Deployment:** Railway (Docker)
- **Fork strategy:** [[concepts/soft-fork-strategy|Soft fork]] — all PPM code uses `ppm_` prefix conventions
- **Auth:** Passport.js sessions (internal), [[concepts/portal-auth|magic links]] (clients)
- **Data isolation:** PostgreSQL RLS per client
- **Routing:** [[concepts/listen-notify-routing|LISTEN/NOTIFY]] (3-channel topology)

## Core Data Model

- `ppm_deliverables` — central entity: task + status + visibility + dates + hours
- `ppm_clients` — client records with branding config and retainer info
- `ppm_client_users` — portal users with magic link auth and role-based access
- `ppm_dropdown_options` — admin-managed values for priority, channel, type, feedback reasons
- `ppm_retainers` — budgeted hours/amount per client per period
- `ppm_comments` — threaded comments with author_type tracking
- `ppm_audit_log` — full activity trail
- `ppm_routing_log` — LISTEN/NOTIFY event tracking with sequence numbers
- `ppm_status_mapping` — project+status_id → PPM status enum

## Key Features

### Admin Layer (Master + Internal)
- Master dashboard with client health and [[concepts/retainer-tracking|retainer utilization]]
- Cross-client internal kanban (7-column pipeline replacing Monday's Creative Pipeline)
- Approval queue with [[concepts/revision-loop|structured feedback reasons]]
- Team management (partner/employee role assignments)
- Client list + settings (including branding config)

### Client Portal
- [[concepts/portal-auth|Magic link authentication]] (Resend email)
- Deliverables list, detail, and board views
- Task detail with comments and file attachments (S3 presigned URLs)
- Per-client branding config
- [[concepts/three-layer-visibility|Sanitized status labels]] (e.g., "queued" → "Submitted")

### Task Workflow
Client submits → Admin reviews (approve/reject with feedback) → Assign to employee → Employee works → Submit for client review → Client approves or triggers [[concepts/revision-loop|revision loop]] → Done (month_completed auto-set)

## Internal Views (replacing Monday boards)

| View | Replaces | Users |
|------|----------|-------|
| Creative Pipeline kanban | Creative Pipeline board (270 items) | Creative team |
| Web/Ops Pipeline kanban | Website/Ops Pipeline board | Dev team |
| Client Overview table | Client Master Board | Jon + account managers |
| Calendar (by send date) | No Monday equivalent | Account managers |
| My Tasks | Worklenz built-in | Individual team members |
| Client Portal | Shareable boards (3 of 16) | Clients |

## Build Status (2026-04-07)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Kill-Shot Spike | COMPLETE | RLS, LISTEN/NOTIFY, magic link, bot API, time tracking |
| Phase 2: 3-Layer Customization | ~75% | Missing: calendar view, health endpoint, error rescue |
| Phase 3: Ecosystem Wiring | NOT STARTED | CreativeHQ integration, Data Warehouse |

## Migration
[[concepts/monday-migration|Monday.com migration]] via parallel run approach. Pilot client: Maestro Media. Target: off Monday within 60 days of successful pilot.

## Key Paths
- Backend PPM code: `worklenz-backend/src/ppm/`
- Frontend PPM code: `worklenz-frontend/src/components/ppm/`
- Migrations: `worklenz-backend/database/migrations/ppm/` (19 migrations)
- Design spec: `beirut/docs/client-hub-design.md`
- Test plan: `beirut/docs/client-hub-test-plan.md`

## Success Criteria
1. Zero lost client feedback
2. Status visibility within seconds
3. At-a-glance scope tracking per client
4. Client portal adoption (replaces email/Slack)
5. [[concepts/monday-migration|Monday decommission]] within 60 days of pilot
6. Mirror column elimination
7. PPMBot API parity
8. [[concepts/revision-loop|Revision loop]] works end-to-end
