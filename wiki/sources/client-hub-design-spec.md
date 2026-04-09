---
title: "Client Hub Design Spec — Full Architecture Document"
type: source
tags: [taskflow, design, architecture, monday-replacement]
audience: internal
sources: [raw/client-hub-design-spec.md]
updated: 2026-04-07
confidence: high
---

# Source: Client Hub Design Spec

The primary design document for [[entities/taskflow|PPM TaskFlow]], generated 2026-03-24, approved 2026-03-25 after eng review, design review, CEO review, Monday audit, and TaskFlow brainstorm.

## Problem
Monday.com ($450/month) lacks client portals, automated feedback routing, and cross-board visibility without enterprise pricing. 13 of 16 clients have zero Monday access. "Things fall through the cracks regularly."

## Two core pain points:
1. Missed deliverable deadlines — internal status doesn't reach the right person
2. Client feedback lost between client boards and internal execution boards

## Solution: [[concepts/soft-fork-strategy|Soft fork]] of Worklenz with [[concepts/three-layer-visibility|3-layer visibility]] (Master → Internal → Client) and [[concepts/listen-notify-routing|LISTEN/NOTIFY routing]].

## Fork Target Selection
7 alternatives evaluated (Plane, Leantime, OpenProject, Taiga, Focalboard, Vikunja, Worklenz). Worklenz won on: PostgreSQL + TypeScript/React stack match, all PM table stakes included in AGPL version, manageable upstream pace.

## Phases
- **Phase 1:** Kill-shot spike — prove RLS, LISTEN/NOTIFY, magic link, API tasks, time tracking
- **Phase 2:** 3-layer customization — full data model, admin dashboard, client portal, approval queue, comments, retainers
- **Phase 3:** Ecosystem wiring — [[entities/creativehq|CreativeHQ]] integration, Data Warehouse, beirut contracts

## Key Architecture Decisions
- Single project per client (not 3 linked projects)
- Task types within project: creative, web_ops, retention, general
- Admin-managed dropdown options (not hardcoded enums)
- RLS at database level (not per-route filtering)
- LISTEN/NOTIFY routing (not PG triggers on Worklenz tables — preserves soft fork)
- Session auth via Passport.js (no JWT swap)

## Monday Migration
- Parallel run approach — Monday stays live until each client migrated
- Pilot: Maestro Media (most active, shareable boards, highest item volume)
- Migrate last 90 days active items, archive older
- Target: fully off Monday within 60 days of successful pilot

## Kill Criteria
- Phase 1: >5 Worklenz core file modifications → reassess
- Phase 2: >50% routes need modification, or exceeds 3 weeks CC → reassess
- Ongoing: upstream merges >4hr/month, or >50% core files have PPM overrides → reassess

## Success Criteria
1. Zero lost client feedback
2. Status visibility within seconds via LISTEN/NOTIFY
3. At-a-glance scope tracking per client
4. Client portal adoption (replaces email/Slack for feedback)
5. Monday decommission within 60 days of pilot
6. Mirror column elimination
7. PPMBot API parity
8. Revision loop works end-to-end

## AGPL-3.0 Compliance
Repo must remain public. "Source Code" link in portal footer. All ppm_ code is AGPL too. Proprietary code can live in separate service via REST API.
