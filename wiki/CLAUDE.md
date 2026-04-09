# PPM Wiki

## What This Is
A persistent, compounding knowledge base for PPM's automation tool ecosystem. The LLM writes and maintains all wiki content. Humans curate sources, ask questions, and review.

Based on the LLM Wiki pattern (Karpathy, 2026).

## Directory Structure

```
wiki/
├── CLAUDE.md          # This file — schema and conventions
├── index.md           # Content catalog (LLM reads this first)
├── log.md             # Chronological activity log
├── raw/               # Immutable source documents (LLM never modifies)
│   └── assets/        # Downloaded images from sources
├── entities/          # Pages for specific things (tools, clients, people)
├── concepts/          # Strategy patterns, channel playbooks, technical concepts
├── sources/           # LLM-generated summaries of raw documents
├── synthesis/         # Cross-cutting analyses, comparisons, decisions
└── docs/              # Public-facing documentation (generated from wiki content)
    └── taskflow/      # Per-tool doc sections
```

## Page Format

Every wiki page uses this frontmatter:

```yaml
---
title: Page Title
type: entity | concept | source | synthesis | doc
tags: [relevant, tags]
audience: internal | public | both
sources: [raw/filename.md]  # What raw sources informed this page
updated: 2026-04-07
confidence: high | medium | low  # How well-supported by sources
---
```

Followed by markdown content with `[[wikilinks]]` for cross-references.

## Wikilink Conventions
- Entity pages: `[[entities/creativehq]]`, `[[entities/taskflow]]`
- Concept pages: `[[concepts/soft-fork-strategy]]`, `[[concepts/three-layer-visibility]]`
- Source summaries: `[[sources/2026-03-23-office-hours]]`
- Use display text when helpful: `[[entities/taskflow|TaskFlow]]`

## Operations

### Ingest
When told to ingest a source:
1. Save the raw document to `raw/` (never modify after saving)
2. Create a source summary page in `sources/`
3. Update or create relevant entity and concept pages
4. Update `index.md` with new/changed pages
5. Append entry to `log.md`
6. If any updated page has `audience: public` or `audience: both`, also update the corresponding page in `docs/`

### Query
When answering a question:
1. Read `index.md` to find relevant pages
2. Read those pages for context
3. Synthesize an answer with `[[wikilinks]]` to sources
4. If the answer is reusable, offer to save it as a synthesis page

### Lint
When asked to lint or health-check:
- Find contradictions between pages
- Find stale claims superseded by newer sources
- Find orphan pages with no inbound links
- Find concepts mentioned but lacking their own page
- Find `audience: both` or `audience: public` pages where wiki content has diverged from `docs/`
- Suggest new sources to look for

### Docs
When asked to generate or update docs:
1. Read the relevant entity/concept pages (the wiki is the source of truth)
2. Filter out internal-only content
3. Write clean, user-facing documentation to `docs/`
4. Docs pages link back to wiki pages via comments (not visible to end users) so lint can detect drift

Doc pages use this frontmatter:
```yaml
---
title: User-Facing Title
tool: taskflow | creativehq | etc
section: getting-started | features | api | faq
wiki_source: entities/taskflow  # Which wiki page this derives from
updated: 2026-04-07
---
```

## Index Format

`index.md` is organized by section:

```markdown
# Wiki Index

## Entities
- [[entities/taskflow]] — PPM TaskFlow project management tool (8 sources)
- [[entities/creativehq]] — Ad creative pipeline (3 sources)

## Concepts
- [[concepts/soft-fork-strategy]] — How PPM extends Worklenz without breaking upstream

## Sources
- [[sources/2026-03-23-office-hours]] — Ecosystem architecture decisions

## Synthesis
- [[synthesis/ecosystem-gaps]] — Three critical gaps in the current architecture

## Docs
- [[docs/taskflow/getting-started]] — TaskFlow setup guide (public)
```

## Log Format

`log.md` entries use this format for parseability:

```markdown
## [2026-04-07] ingest | Source Title
- Summary of what was ingested
- Pages created: [[page1]], [[page2]]
- Pages updated: [[page3]]

## [2026-04-07] query | Question asked
- Answer summary
- Filed as: [[synthesis/answer-page]] (if saved)

## [2026-04-07] lint | Health check
- Issues found and fixed
```

## Rules
- NEVER modify files in `raw/` — they are immutable source documents
- ALWAYS update `index.md` and `log.md` when making changes
- ALWAYS use `[[wikilinks]]` for cross-references, never bare text references
- When a wiki page with `audience: both` changes, flag that `docs/` needs updating
- Keep source summaries factual — opinions and analysis go in synthesis pages
- When sources contradict each other, note the contradiction explicitly, don't silently pick one
