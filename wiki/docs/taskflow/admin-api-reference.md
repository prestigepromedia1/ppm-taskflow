---
title: Admin API Reference
tool: taskflow
section: api
wiki_source: entities/taskflow
updated: 2026-04-07
---

# Admin API Reference

Internal admin endpoints for [[entities/taskflow|TaskFlow]]. All endpoints prefixed with `/ppm/api/admin/`. Requires authenticated Worklenz session with partner role.

## Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Dashboard stats: total_clients, active_deliverables, pending_approvals, overdue_items |
| GET | `/dashboard/clients` | Client health: per-client task count + utilization % |
| GET | `/pipeline` | Pipeline tasks. Params: `client_id?`, `assignee_id?`, `type_id?` |

## Approval Queue

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/approval-queue` | List pending approvals |
| GET | `/approval-queue/count` | Count of pending approvals |
| POST | `/approval-queue/:id/approve` | Approve and queue task |
| POST | `/approval-queue/:id/return` | Return to client. Body: `{reason_id, comment?}` |
| GET | `/feedback-reasons` | List feedback reason options |

## Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients` | List all clients |
| GET | `/clients/:id` | Single client detail |
| POST | `/clients` | Create client. Body: `{name, branding_config?}` |

## Client Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients/:id/users` | List client users |
| POST | `/clients/:id/users` | Add client user. Body: `{email, display_name, role}` |
| PUT | `/clients/:id/users/:userId` | Update user (role, etc.) |
| DELETE | `/clients/:id/users/:userId` | Remove/deactivate client user |

## Client Partners

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients/:id/partners` | List partners assigned to client |
| POST | `/clients/:id/partners` | Add partner. Body: `{partner_id}` |
| DELETE | `/clients/:id/partners/:partnerId` | Remove partner |

## Client Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients/:id/projects` | List linked Worklenz projects |
| POST | `/clients/:id/projects` | Link project. Body: `{project_id}` |
| DELETE | `/clients/:id/projects/:projectId` | Unlink project |
| PUT | `/clients/:id/projects/:projectId/primary` | Set as primary project |

## Team

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/team` | List all team members with PPM roles |
| PUT | `/team/:userId/role` | Set role. Body: `{ppm_role: 'partner' \| 'employee'}` |
| DELETE | `/team/:userId/role` | Remove PPM role (unassigned) |

## CSRF

Admin API auto-fetches CSRF token from `GET /ppm/api/admin/csrf-token` on first write request. Auto-retries on 403 by refreshing the token.
