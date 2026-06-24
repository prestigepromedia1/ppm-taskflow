/**
 * Monday -> taskflow forward-mirror runner (Phase 1, ONE-WAY create-mirror).
 *
 * Flow per board:
 *   1. Read items created since the stored cursor (Monday, read-only).
 *   2. Skip items in skip-groups or terminal statuses.
 *   3. Map essentials (client name, title, type, status enum).
 *   4. POST to the taskflow bot API (Bearer service-JWT). The server records
 *      the Monday item id for idempotency, so re-runs never double-create.
 *   5. Advance the per-board cursor ONLY after the whole board pass succeeds.
 *      A failed POST aborts the board pass and leaves the cursor unmoved, so the
 *      item is retried next run.
 *
 * Strictly one-way: never writes back to Monday, never syncs status outward.
 */

import { MondayClient, MondayItem, columnText } from "./monday-client";
import { TaskflowClient, DeliverablePayload } from "./taskflow-client";
import { CursorStore, MirrorState } from "./cursor-store";
import { BoardConfig, mapStatusLabel } from "./board-config";

export interface MirrorDeps {
  monday: Pick<MondayClient, "getItemsCreatedSince">;
  taskflow: Pick<TaskflowClient, "createDeliverable">;
  cursorStore: Pick<CursorStore, "load" | "save">;
  boards: Record<string, BoardConfig>;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
}

export interface BoardSummary {
  boardId: string;
  board: string;
  fetched: number;
  created: number;
  skipped: number;
  alreadyExisted: number;
  failed: number;
  cursorAdvanced: boolean;
  error?: string;
}

const noopLogger = { info: () => {}, warn: () => {}, error: () => {} };

/** Build the deliverable payload for a Monday item, or null to skip it. */
export function mapItemToPayload(item: MondayItem, cfg: BoardConfig): DeliverablePayload | null {
  // Skip configured groups (Graveyard, completed-old).
  if (item.group && cfg.skipGroupIds.includes(item.group.id)) return null;

  const statusLabel = columnText(item, cfg.statusColumnId);
  const ppmStatus = mapStatusLabel(statusLabel);
  if (ppmStatus === undefined) return null; // terminal status -> skip

  const clientName = columnText(item, cfg.clientColumnId);
  const title = (item.name || "").trim();
  if (!title) return null;

  return {
    // client_id resolved server-side from client_name (mirror only knows the name).
    client_name: clientName || undefined,
    title,
    status: ppmStatus,
    description: columnText(item, cfg.descriptionColumnId),
    due_date: columnText(item, cfg.dueDateColumnId),
    send_date: columnText(item, cfg.sendDateColumnId),
    asset_review_link: columnText(item, cfg.reviewLinkColumnId),
    external_ref: { monday_item_id: item.id },
  };
}

export async function runMirror(deps: MirrorDeps): Promise<BoardSummary[]> {
  const logger = deps.logger ?? noopLogger;
  const state: MirrorState = await deps.cursorStore.load();
  const summaries: BoardSummary[] = [];

  for (const [boardId, cfg] of Object.entries(deps.boards)) {
    const since = state[boardId] ?? CursorStore.defaultCursor();
    const summary: BoardSummary = {
      boardId,
      board: cfg.name,
      fetched: 0,
      created: 0,
      skipped: 0,
      alreadyExisted: 0,
      failed: 0,
      cursorAdvanced: false,
    };

    try {
      const items = await deps.monday.getItemsCreatedSince(boardId, since);
      summary.fetched = items.length;

      // Track the newest created_at we have FULLY processed; only advance to that.
      let highWater = since;

      for (const item of items) {
        const payload = mapItemToPayload(item, cfg);
        if (!payload) {
          summary.skipped++;
          // Skipped items are intentionally not mirrored; still safe to advance
          // past them since they will keep being skipped on retry.
          highWater = maxIso(highWater, item.created_at);
          continue;
        }

        try {
          const result = await deps.taskflow.createDeliverable(payload);
          if (result.already_exists) summary.alreadyExisted++;
          else summary.created++;
          highWater = maxIso(highWater, item.created_at);
        } catch (err: any) {
          // A failed POST stops this board's pass; cursor stays at the last
          // successfully-processed item so this one retries next run.
          summary.failed++;
          summary.error = err?.message ?? String(err);
          logger.error(
            `[${cfg.name}] failed to mirror item ${item.id} ("${item.name}"): ${summary.error}`
          );
          break;
        }
      }

      // Advance cursor only to the high-water mark of fully-processed items.
      if (highWater !== since) {
        state[boardId] = highWater;
        summary.cursorAdvanced = true;
      }
    } catch (err: any) {
      summary.error = err?.message ?? String(err);
      logger.error(`[${cfg.name}] board pass failed: ${summary.error}`);
      // Do NOT advance cursor on a board-level read failure.
    }

    summaries.push(summary);
    logger.info(
      `[${cfg.name}] fetched=${summary.fetched} created=${summary.created} ` +
        `existed=${summary.alreadyExisted} skipped=${summary.skipped} ` +
        `failed=${summary.failed} cursorAdvanced=${summary.cursorAdvanced}`
    );
  }

  await deps.cursorStore.save(state);
  return summaries;
}

function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
