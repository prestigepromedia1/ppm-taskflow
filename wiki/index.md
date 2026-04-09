# Wiki Index

## Entities
- [[entities/taskflow]] — PPM TaskFlow project management + client hub (3 sources)

## Concepts
- [[concepts/soft-fork-strategy]] — How PPM extends Worklenz without breaking upstream merges
- [[concepts/three-layer-visibility]] — Master → Internal → Client visibility tiers
- [[concepts/listen-notify-routing]] — PostgreSQL LISTEN/NOTIFY for status routing between layers
- [[concepts/revision-loop]] — Client reject → structured feedback → employee rework → resubmit cycle
- [[concepts/monday-migration]] — Parallel-run migration strategy from Monday.com, pilot with Maestro Media
- [[concepts/portal-auth]] — Magic link authentication, client user roles, RLS enforcement
- [[concepts/retainer-tracking]] — Hours utilization, 15-min increments, retainer period rollups

## Sources
- [[sources/taskflow-claude-md]] — TaskFlow CLAUDE.md project context file (2026-04-07)
- [[sources/client-hub-design-spec]] — Full architecture and design document (2026-04-07)
- [[sources/client-hub-test-plan]] — Test strategy, E2E paths, edge cases (2026-04-07)

## Synthesis

## Docs
- [[docs/taskflow/admin-api-reference]] — Admin API endpoints: dashboard, approvals, clients, team
- [[docs/taskflow/portal-api-reference]] — Portal API endpoints: auth, deliverables, tasks, attachments
- [[docs/taskflow/frontend-components]] — Component guide: admin dashboard, portal views, shared UI
- [[docs/taskflow/backend-architecture]] — Backend structure: controllers, middleware, listeners, utilities
- [[docs/taskflow/database-migrations]] — 19 PPM migrations: tables, triggers, seeds, RLS policies
