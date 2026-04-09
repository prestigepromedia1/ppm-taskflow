---
title: Frontend Component Guide
tool: taskflow
section: features
wiki_source: entities/taskflow
updated: 2026-04-07
---

# Frontend Component Guide

All PPM components live in `worklenz-frontend/src/components/ppm/`. Built with React 18 + Ant Design + TypeScript.

## Admin Components (`ppm/admin/`)

| Component | Route | Purpose |
|-----------|-------|---------|
| MasterDashboard | `/taskflow/ppm` | 4-stat KPI grid + client health table with utilization % |
| ApprovalQueue | `/taskflow/ppm/approvals` | Pending task review with approve/return + structured feedback modal |
| InternalKanban | `/taskflow/ppm/pipeline` | 7-column cross-client kanban (Incoming→Approved) with search + filters |
| ClientListPage | `/taskflow/ppm/clients` | Client CRUD with create modal |
| ClientSettingsPage | `/taskflow/ppm/clients/:id` | 3-tab interface: Users, Partners, Projects |
| TeamPage | `/taskflow/ppm/team` | Assign PPM roles (partner/employee) to team members |

## Portal Components (`ppm/portal/`)

| Component | Route | Purpose |
|-----------|-------|---------|
| PortalLoginPage | `/portal/login` | Magic link auth with auto-validate from URL token |
| PortalLayout | (wrapper) | Header (logo + user), content, footer. Reads branding from context. |
| PortalDeliverablesPage | `/portal/deliverables` | Card/list view toggle, search, status filter segments |
| PortalDeliverableDetailPage | `/portal/deliverables/:id` | Detail view with approve/reject actions + comment timeline |
| PortalBoardView | `/portal/tasks` | 5-column client kanban + new task modal |
| PortalTaskDetail | `/portal/tasks/:id` | Task detail with comments, attachments (S3), admin feedback display |

## Shared Components

| Component | Purpose |
|-----------|---------|
| StatusBadge | Reusable status tag using status-labels mapping |
| PPMLogo | Branded logo with size variants and dark mode support |

## State Management
- **Admin:** React local state only (no Redux for PPM features)
- **Portal:** `PortalProvider` context manages user session, branding, login/logout
- **Status labels:** `status-labels.ts` maps internal statuses → client-facing labels + colors

## Key UI Patterns
- Ant Design throughout (Table, Card, Modal, Form, Tag, Timeline, etc.)
- Dark mode via Redux `themeReducer.mode` + Ant ConfigProvider
- Role-based visibility: checks `user?.role !== 'viewer'` for write operations
- Kanban columns: horizontal flex scroll, minWidth per column
- Grid cards: CSS Grid `repeat(auto-fill, minmax(320px, 1fr))`
