---
title: Database Migrations Reference
tool: taskflow
section: api
wiki_source: entities/taskflow
updated: 2026-04-07
---

# Database Migrations

All PPM migrations in `worklenz-backend/database/migrations/ppm/`. Run via `000_run_all.sql`.

| # | File | Creates | Purpose |
|---|------|---------|---------|
| 001 | ppm_clients | TABLE | Client records (name, status, contact, branding_config JSONB) |
| 002 | ppm_dropdown_options | TABLE + seed | Admin-managed dropdowns (priority, channel, type) |
| 003 | ppm_deliverables | TABLE + RLS + triggers | Core deliverable entity (8 statuses), auto-update timestamps |
| 004 | ppm_client_users | TABLE + functions | Portal users, magic link generate/validate functions |
| 005 | ppm_retainers | TABLE + VIEW | Retainer periods, `ppm_retainer_utilization` rollup view |
| 006 | ppm_audit_log | TABLE | Immutable audit trail (append-only) |
| 007 | ppm_routing_log | TABLE | LISTEN/NOTIFY event tracking with sequence numbers |
| 008 | ppm_notify_trigger | FUNCTION + TRIGGER | NOTIFY on deliverable status changes |
| 009 | ppm_rls_client_role | ROLE + RLS + GRANTS | Creates `ppm_client_role`, enables RLS on all PPM tables |
| 010 | ppm_fix_magic_link_rls | ALTER FUNCTION | Fixes: set RLS context before UPDATE in magic link functions |
| 011 | ppm_status_change_notify | FUNCTION + TRIGGER | NOTIFY on Worklenz task status_id changes |
| 012 | ppm_code_review_fixes | ALTER + renames | Magic link returns NULL (not dummy), separate trigger names |
| 013 | ppm_phase2_tables | 5 TABLES | ppm_internal_users, ppm_client_partners, ppm_client_projects, ppm_comments, ppm_status_mapping |
| 014 | ppm_system_user | SEED | Creates system@ppm-portal.internal (reporter for portal tasks) |
| 015 | ppm_incoming_status | SEED | Seeds 8 PPM statuses per project + populates status mapping |
| 016 | ppm_status_sync_trigger | FUNCTION + TRIGGER | Syncs deliverable status from Worklenz task via ppm_status_mapping |
| 017 | ppm_task_created_notify | FUNCTION + TRIGGER | NOTIFY on portal task creation (INSERT/UPDATE of worklenz_task_id) |
| 018 | ppm_feedback_reasons_seed | SEED + ALTER | 8 feedback reasons (Missing Items, Unclear Scope, etc.) |
| 019 | ppm_migrate_comments | MIGRATE | Moves Phase 1 audit_log comments → Phase 2 ppm_comments table |

## Key Tables

- `ppm_deliverables` — Central entity linking to Worklenz tasks via `worklenz_task_id` FK
- `ppm_clients` — Client metadata + `branding_config` JSONB
- `ppm_client_users` — Portal users with magic link token + role (viewer/reviewer/admin)
- `ppm_status_mapping` — Bidirectional ID lookup: project + task_status_id ↔ ppm_status enum
- `ppm_comments` — Threaded comments with `author_type` (client/partner/system)
- `ppm_audit_log` — Immutable append-only event log
- `ppm_retainers` — Budgeted hours per client per period
- `ppm_retainer_utilization` — VIEW calculating used/remaining hours + utilization %
