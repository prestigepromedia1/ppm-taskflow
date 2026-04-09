---
title: "TaskFlow CLAUDE.md — Project Context File"
type: source
tags: [taskflow, claude-md, project-management]
audience: internal
sources: [raw/taskflow-claude-md.md]
updated: 2026-04-07
confidence: high
---

# Source: TaskFlow CLAUDE.md

The CLAUDE.md for [[entities/taskflow|PPM TaskFlow]] — the project's context file that guides AI agents working in the codebase.

## Key Facts

- **What:** Soft fork of [Worklenz](https://github.com/Worklenz/worklenz) for PPM's project management + client portal
- **Replaces:** Monday.com ($450/month)
- **Core value prop:** 3-layer visibility (Master → Internal → Client) + automated feedback routing
- **License:** AGPL-3.0 (must remain public on GitHub)

## Tech Stack
- Backend: Express.js (TypeScript), PostgreSQL (node-pg), Passport.js, Socket.IO
- Frontend: React 18 (TypeScript), Vite, Redux Toolkit, Ant Design
- Sessions: express-session + connect-pg-simple
- Real-time: Socket.IO

## Fork Strategy — [[concepts/soft-fork-strategy|Soft Fork Rules]]
All PPM customizations use `ppm_` prefix conventions:
- Database: `ppm_` prefixed tables, never modify Worklenz core tables
- Backend: new code in `worklenz-backend/src/ppm/`
- Frontend: new components in `worklenz-frontend/src/components/ppm/`
- Config: `PPM_` prefixed env vars
- Modified Worklenz code uses `// PPM-OVERRIDE: [reason]` pattern

## Build Status (as of 2026-04-07)

### Phase 1: Kill-Shot Spike — COMPLETE
All 8 items done: fork, RLS, LISTEN/NOTIFY, magic link auth, bot task API, 15-min time tracking, Monday migration script, security audit.

### Phase 2: 3-Layer Customization — ~75% COMPLETE
19 database migrations, admin dashboard, client portal, approval queue, team management, internal kanban, comment system, retainer rollups, per-client branding, file attachments, status sync triggers, LISTEN/NOTIFY email routing.

**Remaining:** calendar view (send date grid), `/ppm/health` endpoint, error rescue patterns.

### Phase 3: Ecosystem Wiring — NOT STARTED
CreativeHQ integration, Data Warehouse connection, beirut contract interfaces.

## Ecosystem Context
Part of the PPM Automation Tool Ecosystem alongside [[entities/creativehq|CreativeHQ]], Data Warehouse, and PPM Brain.
