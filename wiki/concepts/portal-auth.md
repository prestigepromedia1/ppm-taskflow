---
title: Portal Authentication (Magic Link)
type: concept
tags: [auth, magic-link, client-portal, passport, rls]
audience: internal
sources: [raw/client-hub-design-spec.md, raw/taskflow-claude-md.md]
updated: 2026-04-07
confidence: high
---

# Portal Authentication

How client users authenticate to [[entities/taskflow|TaskFlow]]'s portal. Uses magic links sent via Resend email, with optional password setup for returning users.

## Flow

1. Admin invites client user by email → magic link sent (via Resend)
2. Client clicks magic link → session created via Passport.js
3. Middleware sets `SET LOCAL ppm.current_client_id = '<id>'` per request
4. PostgreSQL RLS enforces data isolation at database level
5. Optional: client can set a password for future logins

## Client User Roles

| Role | Permissions |
|------|-------------|
| viewer | See deliverables, view status |
| reviewer | Approve/reject, structured feedback |
| admin | Create tasks/requests, invite/remove users, update branding |

## Security Layers

- **Database:** RLS policies filter by `ppm.current_client_id` session variable — even a bug in application code can't leak cross-client data
- **Middleware:** `require-client-auth.ts` validates session and sets RLS context
- **CSRF:** `portal-csrf.ts` middleware for portal routes
- **Magic link:** Expiring tokens, rate-limited resend
- **Deactivation:** Admin sets `deactivated_at` → session rejected immediately

## Re-invite Handling
If a removed client user is re-invited, the system reactivates the existing record rather than creating a duplicate (commit `0f3fbb78`).
