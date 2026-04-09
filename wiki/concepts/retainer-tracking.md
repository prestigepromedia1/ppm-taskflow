---
title: Retainer & Scope Tracking
type: concept
tags: [retainer, hours, utilization, billing]
audience: internal
sources: [raw/client-hub-design-spec.md, raw/taskflow-claude-md.md]
updated: 2026-04-07
confidence: high
---

# Retainer & Scope Tracking

How [[entities/taskflow|TaskFlow]] tracks client hours and retainer utilization, replacing Monday's Client Master Board mirror + formula columns.

## Data Model

**ppm_retainers:**
- client_id, period_start, period_end
- budgeted_hours, budgeted_amount
- Rollup: `SUM(actual_hours)` from `ppm_deliverables`, filtered by visibility rules

**ppm_deliverables fields:**
- estimated_hours, actual_hours (logged in 0.25hr / 15-min increments)
- month_completed (auto-set to "March 2026" format on client approval)

## Utilization View
`ppm_retainer_utilization` database view calculates:
- used_hours, remaining_hours, utilization_pct

## Dashboard Display
Master dashboard shows utilization % per client with color-coded tags:
- Green: <80%
- Orange/Yellow: 80-100%
- Red: >100%

## Visibility Rules ([[concepts/three-layer-visibility]])
- **Internal layer:** Raw hours + billable flags visible
- **Client layer:** Approved summaries only
- `month_completed` enables filtering hours by completion month for retainer period reporting

## Time Tracking
- Worklenz core stores time as seconds in `task_work_log.time_spent` (NUMERIC)
- PPM adds 15-minute increment enforcement (`time-rounding.ts`)
- Both timer-based (Socket.IO) and manual log entry supported
