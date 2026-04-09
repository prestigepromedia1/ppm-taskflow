---
title: Soft Fork Strategy
type: concept
tags: [architecture, fork, worklenz, upstream-merges]
audience: internal
sources: [raw/taskflow-claude-md.md]
updated: 2026-04-07
confidence: high
---

# Soft Fork Strategy

How PPM extends Worklenz without breaking upstream merges. All PPM customizations follow strict naming conventions to keep the fork "soft" — meaning upstream changes can be merged with minimal conflicts.

## Conventions

| Layer | Convention |
|-------|-----------|
| Database tables | `ppm_` prefix (e.g., `ppm_deliverables`, `ppm_clients`) |
| Database functions | `ppm_` prefix |
| Migrations | `worklenz-backend/database/migrations/ppm/` |
| Backend routes/controllers | `worklenz-backend/src/ppm/` |
| Backend middleware | `worklenz-backend/src/ppm/middleware/` |
| Frontend components | `worklenz-frontend/src/components/ppm/` |
| Config env vars | `PPM_` prefix |
| Modified Worklenz code | `// PPM-OVERRIDE: [reason]` comment pattern |

## Key Rules
- **NEVER modify existing Worklenz tables** — create `ppm_` extension tables with foreign keys
- **AVOID modifying Worklenz code** — when unavoidable, mark with PPM-OVERRIDE comment
- **New code goes in `ppm/` directories** — keeps diff surface minimal for upstream merges

## Why This Matters
Worklenz is AGPL-3.0, so [[entities/taskflow|TaskFlow]] must remain public. The soft fork strategy means PPM can pull upstream improvements (bug fixes, features) without painful merge conflicts, while maintaining all custom functionality in isolated directories.
