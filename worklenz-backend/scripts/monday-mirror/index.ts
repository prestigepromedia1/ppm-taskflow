/**
 * Entrypoint for the Monday -> taskflow forward-mirror.
 *
 * Runnable as a cron, e.g.:
 *   *  /15 * * * *  cd worklenz-backend && npx ts-node scripts/monday-mirror/index.ts >> /var/log/monday-mirror.log 2>&1
 * Or compiled: node build/scripts/monday-mirror/index.js
 *
 * Required env:
 *   MONDAY_API_KEY          Monday personal/API token (read-only use).
 *   TASKFLOW_API_BASE_URL   Base URL of the taskflow backend, e.g. http://localhost:3000
 *   (one of)
 *     TASKFLOW_BOT_JWT      Pre-minted bot JWT, OR
 *     JWT_SECRET + TASKFLOW_TEAM_ID + TASKFLOW_USER_ID  to mint a short-lived JWT.
 * Optional env:
 *   MIRROR_BOARD_IDS        CSV of board ids to mirror. Default: the two PPM boards.
 *   MIRROR_STATE_FILE       Cursor/state file path. Default: ./.monday-mirror-state.json
 *   MONDAY_API_VERSION      Monday API version header. Default: 2024-01
 *
 * One-way only: this process never writes to Monday.
 */

import path from "path";
import { MondayClient } from "./monday-client";
import { TaskflowClient } from "./taskflow-client";
import { CursorStore } from "./cursor-store";
import { DEFAULT_BOARD_CONFIGS, BoardConfig } from "./board-config";
import { runMirror } from "./mirror";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function resolveBoards(): Record<string, BoardConfig> {
  const csv = process.env.MIRROR_BOARD_IDS;
  if (!csv || !csv.trim()) return DEFAULT_BOARD_CONFIGS;

  const ids = csv.split(",").map((s) => s.trim()).filter(Boolean);
  const out: Record<string, BoardConfig> = {};
  for (const id of ids) {
    const cfg = DEFAULT_BOARD_CONFIGS[id];
    if (!cfg) {
      throw new Error(
        `Board ${id} listed in MIRROR_BOARD_IDS has no column mapping in board-config.ts. ` +
          `Add a BoardConfig for it before mirroring.`
      );
    }
    out[id] = cfg;
  }
  return out;
}

export async function main(): Promise<void> {
  const monday = new MondayClient({
    apiKey: requireEnv("MONDAY_API_KEY"),
    apiVersion: process.env.MONDAY_API_VERSION,
  });

  const taskflow = new TaskflowClient({
    apiBaseUrl: requireEnv("TASKFLOW_API_BASE_URL"),
    botJwt: process.env.TASKFLOW_BOT_JWT,
    jwtSecret: process.env.JWT_SECRET,
    teamId: process.env.TASKFLOW_TEAM_ID,
    userId: process.env.TASKFLOW_USER_ID,
  });

  const stateFile =
    process.env.MIRROR_STATE_FILE ||
    path.join(process.cwd(), ".monday-mirror-state.json");
  const cursorStore = new CursorStore(stateFile);

  const boards = resolveBoards();

  const summaries = await runMirror({
    monday,
    taskflow,
    cursorStore,
    boards,
    logger: {
      info: (m) => console.log(`[mirror] ${m}`),
      warn: (m) => console.warn(`[mirror] ${m}`),
      error: (m) => console.error(`[mirror] ${m}`),
    },
  });

  const totalFailed = summaries.reduce((n, s) => n + s.failed, 0);
  if (totalFailed > 0) {
    // Non-zero exit so cron/monitoring notices, but cursors for successful
    // boards were already persisted.
    process.exitCode = 1;
  }
}

// Run when invoked directly (not when imported by tests).
if (require.main === module) {
  main().catch((err) => {
    console.error(`[mirror] fatal: ${err?.message ?? err}`);
    process.exit(1);
  });
}
