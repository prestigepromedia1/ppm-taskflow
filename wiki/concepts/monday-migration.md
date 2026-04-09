---
title: Monday.com Migration Strategy
type: concept
tags: [migration, monday, pilot, maestro-media]
audience: internal
sources: [raw/client-hub-design-spec.md]
updated: 2026-04-07
confidence: high
---

# Monday.com Migration Strategy

How PPM transitions from Monday.com ($450/month) to [[entities/taskflow|TaskFlow]]. Parallel-run approach — Monday stays live until each client is fully migrated and verified.

## Current Monday Architecture
- 40+ boards across 4 categories: operational (7), consolidated cross-client (3), per-client (16 clients × 2-3 boards each), misc/templates (9)
- Two parallel systems running simultaneously — legacy per-client boards AND newer "All Clients" consolidated boards
- Creative Pipeline (270 items) is the busiest board
- Only 3 of 16 client workspaces have shareable boards — **13 clients have zero Monday access**
- Entire cross-board visibility relies on fragile manual board relations + mirror columns

## Migration Phases

1. **Kill-shot spike** (Phase 1): Validate architecture. Monday untouched.
2. **Build** (Phase 2): Build 3-layer model. Monday still primary.
3. **Pilot** (1 client): Maestro Media — most active, shareable boards, highest item volume
4. **Full migration**: Batches of 3-4 clients with per-client checklist
5. **Decommission**: Cancel Monday subscription

## Pilot Client: Maestro Media
Selected because: most active boards (shareable type already), form-based intake, highest item volume, best relationship, most to gain from portal. Their workflow becomes the test case for the [[concepts/three-layer-visibility|3-layer model]].

## Data Mapping

| Monday Board | Target in TaskFlow |
|---|---|
| Client Master Board | `ppm_clients` + Client Overview view |
| Creative Pipeline | Cross-client kanban view |
| Per-client Creative Requests | Tasks with type=creative |
| Per-client Website/Ops | Tasks with type=web_ops |
| CRM / Retention | Tasks with type=retention |
| Onboarding board | Tasks with type=general, tag=onboarding |
| Brand Guide boards | Deferred — knowledge-base, not task management |
| Template/inactive boards | Do not migrate |

## Migration Script
A Monday.com migration script with staging tables exists (commit `5976b4fc`). Migrates last 90 days of active items; older items archived from Monday export.

## Target
Fully off Monday within 60 days of successful pilot completion.
