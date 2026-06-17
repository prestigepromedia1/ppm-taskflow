# Monday → taskflow forward-mirror (Phase 1)

One-way poller that mirrors **newly-created** Monday.com items into taskflow as
PPM deliverables. Part of the Monday→taskflow migration.

**One-way only.** Monday → taskflow, create-mirror. No status write-back, no
bidirectional sync — that is explicitly out of scope for Phase 1.

## How it works

For each configured board, every run:

1. Reads items created since the stored per-board cursor (Monday GraphQL, read-only).
2. Skips items in skip-groups (e.g. Graveyard, Completed) or terminal statuses.
3. Maps essentials: client (Client column), title, type, status (via the
   label→PPM-enum bridge in `board-config.ts`).
4. POSTs each to the taskflow bot API `POST /ppm/api/bot/deliverables` using a
   short-lived **service JWT** (`{ service, team_id, user_id }`, signed with
   `JWT_SECRET` — same shape as `ppmbot.service.ts`).
5. The server records the **Monday item id** on `ppm_deliverables.monday_item_id`
   (UNIQUE) for **idempotency** — re-runs/retries never double-create.
6. Advances the per-board cursor **only** to the newest *fully-processed* item.
   A failed POST aborts that board's pass and leaves the cursor unmoved, so the
   item is retried next run (at-least-once delivery).

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Cron entrypoint; wires env → clients → `runMirror`. |
| `mirror.ts` | Core runner + `mapItemToPayload` (pure, testable). |
| `monday-client.ts` | Read-only Monday GraphQL client (since-filter + paging). |
| `taskflow-client.ts` | Bot API client; mints the service JWT. |
| `board-config.ts` | Per-board column ids + status-label→PPM-enum bridge. |
| `cursor-store.ts` | Per-board cursor persistence (JSON state file). |

## Run

```bash
# one-off
cd worklenz-backend && npx ts-node scripts/monday-mirror/index.ts

# cron (every 15 min)
*/15 * * * * cd /path/to/worklenz-backend && npx ts-node scripts/monday-mirror/index.ts >> /var/log/monday-mirror.log 2>&1
```

Exits non-zero if any item failed to mirror (cursors for successful boards are
still persisted).

## Env

See the "PPM MONDAY → TASKFLOW FORWARD-MIRROR" block in `.env.example`.
Required: `MONDAY_API_KEY`, `TASKFLOW_API_BASE_URL`, and either
`TASKFLOW_BOT_JWT` or (`JWT_SECRET` + `TASKFLOW_TEAM_ID` + `TASKFLOW_USER_ID`).

## Server side

`POST /ppm/api/bot/deliverables` (added to `bot-tasks-controller.ts`) creates the
deliverable + linked Worklenz task atomically, resolves `client_name` →
`ppm_clients.id`, and is idempotent on `external_ref.monday_item_id`. Migration
`020_ppm_deliverable_monday_ref.sql` adds the unique external-ref column.

## Tests

```bash
npx jest scripts/monday-mirror
```

Mocks Monday, the bot API, and JWT. Asserts mapping, idempotency, one-way,
cursor advance, and error handling. No live calls, no DB writes.
```
