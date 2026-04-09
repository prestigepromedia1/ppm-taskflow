---
title: Portal API Reference
tool: taskflow
section: api
wiki_source: entities/taskflow
updated: 2026-04-07
---

# Portal API Reference

Client-facing API endpoints for the [[entities/taskflow|TaskFlow]] portal. All endpoints prefixed with `/ppm/api/portal/`.

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/magic-link` | Request magic link email. Body: `{email}` |
| POST | `/auth/validate` | Validate magic link token. Body: `{token}` |
| GET | `/auth/me` | Get current user + CSRF token |
| POST | `/auth/logout` | End session |

## Branding

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/branding` | Get client name + branding config (logo, colors, font) |

## Deliverables (Phase 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deliverables` | List all deliverables for client |
| GET | `/deliverables/:id` | Single deliverable detail |
| POST | `/deliverables/:id/approve` | Approve deliverable (reviewer/admin) |
| POST | `/deliverables/:id/reject` | Reject with comment (reviewer/admin) |
| POST | `/deliverables/:id/comment` | Add comment |
| GET | `/deliverables/:id/comments` | List comments |

## Tasks (Phase 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List all tasks for client |
| GET | `/tasks/:id` | Task detail + comments + feedback |
| POST | `/tasks` | Create new task. Body: `{title, description?, priority?}` |
| GET | `/tasks/:id/comments` | List task comments |
| POST | `/tasks/:id/comments` | Add comment. Body: `{content}` |

## Attachments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attachments/tasks` | Upload file (base64, 50MB limit) |
| GET | `/attachments/tasks/:taskId` | List attachments for task |
| GET | `/attachments/download?id=` | Get presigned download URL |

## CSRF

Portal uses manual CSRF: `getMe()` returns `csrf_token` in response body, which must be sent as `X-CSRF-Token` header on all write requests.

## Client User Roles

| Role | Can View | Can Comment | Can Approve/Reject | Can Create Tasks |
|------|----------|-------------|-------------------|-----------------|
| viewer | Yes | No | No | No |
| reviewer | Yes | Yes | Yes | No |
| admin | Yes | Yes | Yes | Yes |
