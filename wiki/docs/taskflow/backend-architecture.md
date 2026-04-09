---
title: Backend Architecture
tool: taskflow
section: features
wiki_source: entities/taskflow
updated: 2026-04-07
---

# Backend Architecture

All PPM backend code lives in `worklenz-backend/src/ppm/`. Built with Express.js + TypeScript + node-pg.

## Directory Structure

```
src/ppm/
├── controllers/
│   ├── admin-approval-controller.ts    — Approval queue (approve/return with feedback)
│   ├── admin-clients-controller.ts     — Client CRUD, users, partners, projects
│   ├── admin-dashboard-controller.ts   — Master dashboard stats, client health, pipeline
│   ├── admin-team-controller.ts        — PPM role assignments (partner/employee)
│   ├── portal-attachments-controller.ts — S3 file upload/download (50MB limit)
│   ├── portal-auth-controller.ts       — Magic link auth (request, validate, me, logout)
│   ├── portal-deliverables-controller.ts — Phase 1 deliverables (approve/reject/comment)
│   └── portal-tasks-controller.ts      — Phase 2 tasks (create, comment, list)
├── listeners/
│   └── ppm-status-change-listener.ts   — 3-channel LISTEN/NOTIFY with email routing
├── middleware/
│   ├── portal-csrf.ts                  — Double-submit CSRF (timing-safe compare)
│   ├── require-client-auth.ts          — Portal session enforcement + RLS context
│   └── require-ppm-partner.ts          — Admin route guard (partner role check, cached)
├── routes/
│   ├── admin-api-router.ts             — /ppm/api/admin/* (requires partner role)
│   └── portal-api-router.ts            — /ppm/api/portal/* (requires client auth)
└── utils/
    ├── ppm-db.ts                       — withClientScope (RLS), getPPMSystemUser, UUID_RE
    └── time-rounding.ts                — 15-min increment enforcement (PPM_TIME_INCREMENT)
```

## Key Patterns

### RLS Enforcement
Every portal query runs through `withClientScope(clientId, fn)`:
1. Acquires connection from pool
2. Sets `ppm.current_client_id` GUC + `SET ROLE ppm_client_role`
3. RLS policies automatically filter all queries by client_id
4. Resets role on completion (even on error)

### CSRF Protection
- **Admin:** Auto-fetched from `GET /csrf-token`, validated via `X-CSRF-Token` header
- **Portal:** Token returned in `getMe()` response, same header validation
- Both use `crypto.timingSafeEqual()` to prevent timing attacks

### Task Creation Flow (Portal → Worklenz)
1. INSERT into `ppm_deliverables` (status='incoming')
2. Call `create_quick_task()` (Worklenz stored proc)
3. UPDATE `ppm_deliverables.worklenz_task_id`
4. DB trigger fires `NOTIFY ppm_task_created`
5. Listener emails partners linked to client

### Status Sync (Worklenz → PPM)
1. Partner drags Worklenz task to new status
2. `ppm_sync_status_on_task_change` trigger fires
3. Looks up `ppm_status_mapping` (ID-based, not name-based)
4. Updates `ppm_deliverables.status`
5. `ppm_notify_status_change` trigger fires NOTIFY
6. Listener emails client if status = 'client_review'

## Open TODOs (from code comments)
1. Seed PPM statuses on project link (Stream A4)
2. Webhook dispatch on task status change (Phase 2 F2)
3. Integrate PPM_TIME_INCREMENT into time tracking endpoints
