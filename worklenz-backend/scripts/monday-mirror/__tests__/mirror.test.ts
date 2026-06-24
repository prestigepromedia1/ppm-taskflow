/**
 * Tests for the Monday -> taskflow forward-mirror.
 *
 * Fully mocked: a fake Monday source, a fake taskflow bot client, and an
 * in-memory cursor store. NO live API calls, NO database access.
 *
 * Covers: mapping, idempotency (same item id -> no duplicate), one-way
 * (no write-back), cursor advance, and error handling (a failed POST does
 * not advance the cursor past the failing item).
 */

// These modules are pure (no DB / network at import time); unmock so the real
// mapping logic and config run under jest's automock setting.
jest.unmock("../mirror");
jest.unmock("../board-config");
jest.unmock("../cursor-store");
jest.unmock("../monday-client"); // mirror.ts uses columnText() from here

import { runMirror, mapItemToPayload, MirrorDeps } from "../mirror";
import { DEFAULT_BOARD_CONFIGS, mapStatusLabel } from "../board-config";
import { MirrorState } from "../cursor-store";
import { MondayItem } from "../monday-client";

const CREATIVE_BOARD = "18392999987";
const WEBOPS_BOARD = "18398088564";

function creativeItem(overrides: Partial<MondayItem> & { id: string }): MondayItem {
  return {
    id: overrides.id,
    name: overrides.name ?? "Test deliverable",
    created_at: overrides.created_at ?? "2026-06-17T12:00:00.000Z",
    group: overrides.group ?? { id: "topics", title: "Ready To Start" },
    column_values: overrides.column_values ?? [
      { id: "board_relation_mkyxy64w", type: "board_relation", text: "MDAiRE", value: null },
      { id: "status_16", type: "status", text: "Ad Creative", value: null },
      { id: "color_mkz44d8p", type: "status", text: "In Progress", value: null },
      { id: "long_text", type: "long_text", text: "Build the hero ad", value: null },
      { id: "date", type: "date", text: "2026-07-01", value: null },
    ],
  };
}

/** Build deps with injected fakes; returns the recording taskflow mock too. */
function makeDeps(opts: {
  itemsByBoard: Record<string, MondayItem[]>;
  state?: MirrorState;
  createImpl?: (payload: any) => Promise<any>;
  boards?: Record<string, any>;
}) {
  const saved: { state?: MirrorState } = {};
  const createCalls: any[] = [];
  // Default: server is idempotent — track seen monday ids, return already_exists on repeat.
  const seen = new Set<string>();

  const taskflow = {
    createDeliverable: jest.fn(async (payload: any) => {
      createCalls.push(payload);
      if (opts.createImpl) return opts.createImpl(payload);
      const mid = payload.external_ref.monday_item_id;
      const already = seen.has(mid);
      seen.add(mid);
      return {
        id: `deliv-${mid}`,
        worklenz_task_id: `task-${mid}`,
        status: payload.status,
        title: payload.title,
        monday_item_id: mid,
        already_exists: already,
      };
    }),
  };

  const deps: MirrorDeps = {
    monday: {
      getItemsCreatedSince: jest.fn(async (boardId: string, _since: string) => {
        return opts.itemsByBoard[boardId] ?? [];
      }),
    },
    taskflow,
    cursorStore: {
      load: jest.fn(async () => ({ ...(opts.state ?? {}) })),
      save: jest.fn(async (s: MirrorState) => {
        saved.state = s;
      }),
    },
    boards: opts.boards ?? { [CREATIVE_BOARD]: DEFAULT_BOARD_CONFIGS[CREATIVE_BOARD] },
  };

  return { deps, taskflow, createCalls, saved };
}

describe("status label bridge", () => {
  it("maps creative + webops labels to the PPM enum", () => {
    expect(mapStatusLabel("Not Started Yet")).toBe("queued");
    expect(mapStatusLabel("In Progress")).toBe("in_progress");
    expect(mapStatusLabel("On Hold / Stuck")).toBe("in_progress");
    expect(mapStatusLabel("Pending Review")).toBe("internal_review");
    expect(mapStatusLabel("QC Review")).toBe("internal_review");
    expect(mapStatusLabel("Revisions Needed")).toBe("revision");
    expect(mapStatusLabel("Asset Approved")).toBe("approved");
    expect(mapStatusLabel("New / Incoming")).toBe("incoming");
  });

  it("returns undefined (skip) for terminal labels", () => {
    expect(mapStatusLabel("Completed")).toBeUndefined();
    expect(mapStatusLabel("Live / Done")).toBeUndefined();
    expect(mapStatusLabel("Launched / Live")).toBeUndefined();
    expect(mapStatusLabel("Graveyard")).toBeUndefined();
  });

  it("defaults unknown / empty labels to queued", () => {
    expect(mapStatusLabel("Some Future Label")).toBe("queued");
    expect(mapStatusLabel("")).toBe("queued");
    expect(mapStatusLabel(null)).toBe("queued");
  });
});

describe("mapItemToPayload", () => {
  const cfg = DEFAULT_BOARD_CONFIGS[CREATIVE_BOARD];

  it("maps essentials: client, title, status, description, dates, external ref", () => {
    const payload = mapItemToPayload(creativeItem({ id: "111" }), cfg)!;
    expect(payload.client_name).toBe("MDAiRE");
    expect(payload.title).toBe("Test deliverable");
    expect(payload.status).toBe("in_progress");
    expect(payload.description).toBe("Build the hero ad");
    expect(payload.due_date).toBe("2026-07-01");
    expect(payload.external_ref).toEqual({ monday_item_id: "111" });
  });

  it("skips items in a skip-group (Graveyard / Completed)", () => {
    const item = creativeItem({ id: "222", group: { id: "group_mm2tbh5c", title: "Graveyard" } });
    expect(mapItemToPayload(item, cfg)).toBeNull();
  });

  it("skips items whose status is terminal", () => {
    const item = creativeItem({
      id: "333",
      column_values: [
        { id: "board_relation_mkyxy64w", type: "board_relation", text: "MDAiRE", value: null },
        { id: "color_mkz44d8p", type: "status", text: "Completed", value: null },
      ],
    });
    expect(mapItemToPayload(item, cfg)).toBeNull();
  });

  it("skips items with no title", () => {
    const item = creativeItem({ id: "444", name: "   " });
    expect(mapItemToPayload(item, cfg)).toBeNull();
  });
});

describe("runMirror", () => {
  it("creates a deliverable per new item and advances the cursor", async () => {
    const items = [
      creativeItem({ id: "1", created_at: "2026-06-17T10:00:00.000Z" }),
      creativeItem({ id: "2", created_at: "2026-06-17T11:00:00.000Z" }),
    ];
    const { deps, taskflow, saved } = makeDeps({
      itemsByBoard: { [CREATIVE_BOARD]: items },
      state: { [CREATIVE_BOARD]: "2026-06-17T09:00:00.000Z" },
    });

    const summaries = await runMirror(deps);

    expect(taskflow.createDeliverable).toHaveBeenCalledTimes(2);
    expect(summaries[0].created).toBe(2);
    expect(summaries[0].failed).toBe(0);
    // Cursor advanced to the newest processed item.
    expect(saved.state![CREATIVE_BOARD]).toBe("2026-06-17T11:00:00.000Z");
    expect(summaries[0].cursorAdvanced).toBe(true);
  });

  it("is idempotent: re-running the same items does not double-create", async () => {
    const items = [creativeItem({ id: "1", created_at: "2026-06-17T10:00:00.000Z" })];

    // Shared server state across two runs: a persistent 'seen' set.
    const seen = new Set<string>();
    const createImpl = async (payload: any) => {
      const mid = payload.external_ref.monday_item_id;
      const already = seen.has(mid);
      seen.add(mid);
      return { id: `d-${mid}`, worklenz_task_id: `t-${mid}`, status: payload.status, title: payload.title, already_exists: already };
    };

    const run1 = makeDeps({ itemsByBoard: { [CREATIVE_BOARD]: items }, createImpl });
    const s1 = await runMirror(run1.deps);
    expect(s1[0].created).toBe(1);
    expect(s1[0].alreadyExisted).toBe(0);

    // Second run: same item id is re-fetched (e.g. cursor not yet past it), server says already_exists.
    const run2 = makeDeps({ itemsByBoard: { [CREATIVE_BOARD]: items }, createImpl });
    const s2 = await runMirror(run2.deps);
    expect(s2[0].created).toBe(0);
    expect(s2[0].alreadyExisted).toBe(1);
  });

  it("is ONE-WAY: the mirror never calls any write-back / Monday mutation", async () => {
    const items = [creativeItem({ id: "1" })];
    const { deps, taskflow } = makeDeps({ itemsByBoard: { [CREATIVE_BOARD]: items } });
    await runMirror(deps);

    // The only outbound call is createDeliverable. The injected Monday client
    // exposes ONLY a read method; there is no mutate method to call.
    expect(Object.keys(deps.monday)).toEqual(["getItemsCreatedSince"]);
    expect(taskflow.createDeliverable).toHaveBeenCalledTimes(1);
    // Taskflow client surface is create-only (no status write-back).
    expect(Object.keys(deps.taskflow)).toEqual(["createDeliverable"]);
  });

  it("does NOT advance the cursor past a failing item (error handling)", async () => {
    const items = [
      creativeItem({ id: "ok1", created_at: "2026-06-17T10:00:00.000Z" }),
      creativeItem({ id: "boom", created_at: "2026-06-17T11:00:00.000Z" }),
      creativeItem({ id: "ok2", created_at: "2026-06-17T12:00:00.000Z" }),
    ];
    const createImpl = async (payload: any) => {
      if (payload.external_ref.monday_item_id === "boom") {
        throw new Error("taskflow 500");
      }
      return { id: "x", worklenz_task_id: "t", status: payload.status, title: payload.title, already_exists: false };
    };
    const { deps, taskflow, saved } = makeDeps({
      itemsByBoard: { [CREATIVE_BOARD]: items },
      state: { [CREATIVE_BOARD]: "2026-06-17T09:00:00.000Z" },
      createImpl,
    });

    const summaries = await runMirror(deps);

    // First item succeeded; the failing item aborted the pass before ok2.
    expect(summaries[0].created).toBe(1);
    expect(summaries[0].failed).toBe(1);
    expect(taskflow.createDeliverable).toHaveBeenCalledTimes(2); // ok1, boom (not ok2)
    // Cursor advanced only to the last SUCCESSFUL item (ok1), so boom retries next run.
    expect(saved.state![CREATIVE_BOARD]).toBe("2026-06-17T10:00:00.000Z");
  });

  it("never advances the cursor when the Monday read itself fails", async () => {
    const { deps, saved } = makeDeps({
      itemsByBoard: {},
      state: { [CREATIVE_BOARD]: "2026-06-17T09:00:00.000Z" },
    });
    (deps.monday.getItemsCreatedSince as jest.Mock).mockRejectedValueOnce(new Error("monday down"));

    const summaries = await runMirror(deps);
    expect(summaries[0].error).toContain("monday down");
    // Cursor unchanged.
    expect(saved.state![CREATIVE_BOARD]).toBe("2026-06-17T09:00:00.000Z");
  });

  it("advances cursor past skipped items (they stay skipped on retry)", async () => {
    const items = [
      creativeItem({ id: "skip", created_at: "2026-06-17T10:00:00.000Z", group: { id: "group_mm2tbh5c", title: "Graveyard" } }),
      creativeItem({ id: "keep", created_at: "2026-06-17T11:00:00.000Z" }),
    ];
    const { deps, saved, taskflow } = makeDeps({
      itemsByBoard: { [CREATIVE_BOARD]: items },
      state: { [CREATIVE_BOARD]: "2026-06-17T09:00:00.000Z" },
    });
    const summaries = await runMirror(deps);
    expect(summaries[0].skipped).toBe(1);
    expect(summaries[0].created).toBe(1);
    expect(taskflow.createDeliverable).toHaveBeenCalledTimes(1);
    expect(saved.state![CREATIVE_BOARD]).toBe("2026-06-17T11:00:00.000Z");
  });
});
