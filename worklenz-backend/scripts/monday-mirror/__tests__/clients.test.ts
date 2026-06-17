/**
 * Tests for the Monday read client (since-filter + paging stop) and the
 * taskflow bot client (service-JWT minting + create call shape).
 * Fully mocked HTTP; NO live calls.
 */

jest.unmock("../monday-client");
jest.unmock("../taskflow-client");
jest.unmock("jsonwebtoken"); // taskflow-client mints + we verify real JWTs

import jwt from "jsonwebtoken";
import { MondayClient, columnText, MondayItem } from "../monday-client";
import { TaskflowClient } from "../taskflow-client";

function fakeHttp(responder: (body: any) => any) {
  return {
    post: jest.fn(async (_url: string, body: any) => ({ data: responder(body) })),
  } as any;
}

describe("MondayClient.getItemsCreatedSince", () => {
  it("returns only items newer than the cursor, oldest-first", async () => {
    const http = fakeHttp(() => ({
      data: {
        boards: [
          {
            items_page: {
              cursor: null,
              items: [
                { id: "3", name: "new b", created_at: "2026-06-17T12:00:00.000Z", group: null, column_values: [] },
                { id: "2", name: "new a", created_at: "2026-06-17T11:00:00.000Z", group: null, column_values: [] },
                { id: "1", name: "old", created_at: "2026-06-17T08:00:00.000Z", group: null, column_values: [] },
              ],
            },
          },
        ],
      },
    }));
    const client = new MondayClient({ apiKey: "x", http });
    const items = await client.getItemsCreatedSince("123", "2026-06-17T10:00:00.000Z");
    expect(items.map((i) => i.id)).toEqual(["2", "3"]); // sorted oldest-first, old excluded
  });

  it("surfaces Monday GraphQL errors", async () => {
    const http = fakeHttp(() => ({ errors: [{ message: "bad token" }] }));
    const client = new MondayClient({ apiKey: "x", http });
    await expect(client.getItemsCreatedSince("123", "2026-06-17T10:00:00.000Z")).rejects.toThrow(/Monday API error/);
  });

  it("requires an api key", () => {
    expect(() => new MondayClient({ apiKey: "" })).toThrow(/MONDAY_API_KEY/);
  });
});

describe("columnText", () => {
  const item: MondayItem = {
    id: "1", name: "n", created_at: "", group: null,
    column_values: [{ id: "col_a", type: "text", text: "  hi  ", value: null }],
  };
  it("reads + trims a column by id", () => expect(columnText(item, "col_a")).toBe("hi"));
  it("returns null for missing column / undefined id", () => {
    expect(columnText(item, "nope")).toBeNull();
    expect(columnText(item, undefined)).toBeNull();
  });
});

describe("TaskflowClient", () => {
  it("mints a 'monday-mirror' service JWT with the bot payload shape", async () => {
    let sentAuth = "";
    const http = {
      post: jest.fn(async (_url: string, _body: any, cfg: any) => {
        sentAuth = cfg.headers.Authorization;
        return { data: { done: true, body: { id: "d1", worklenz_task_id: "t1", status: "queued", title: "T", already_exists: false } } };
      }),
    } as any;

    const client = new TaskflowClient({
      apiBaseUrl: "http://localhost:3000",
      jwtSecret: "test-secret",
      teamId: "team-uuid",
      userId: "user-uuid",
      http,
    });

    const res = await client.createDeliverable({
      title: "T", client_name: "MDAiRE", status: "queued", external_ref: { monday_item_id: "55" },
    });

    expect(res.id).toBe("d1");
    expect(sentAuth.startsWith("Bearer ")).toBe(true);
    const decoded = jwt.verify(sentAuth.slice(7), "test-secret") as any;
    expect(decoded.service).toBe("monday-mirror");
    expect(decoded.team_id).toBe("team-uuid");
    expect(decoded.user_id).toBe("user-uuid");
    // POSTs to the bot deliverables endpoint.
    expect(http.post).toHaveBeenCalledWith(
      "/ppm/api/bot/deliverables",
      expect.objectContaining({ external_ref: { monday_item_id: "55" } }),
      expect.any(Object)
    );
  });

  it("uses a pre-minted JWT verbatim when provided", async () => {
    let sentAuth = "";
    const http = {
      post: jest.fn(async (_u: string, _b: any, cfg: any) => {
        sentAuth = cfg.headers.Authorization;
        return { data: { body: { id: "d", worklenz_task_id: null, status: "queued", title: "T", already_exists: true } } };
      }),
    } as any;
    const client = new TaskflowClient({ apiBaseUrl: "http://x", botJwt: "PREMINTED", http });
    await client.createDeliverable({ title: "T", external_ref: { monday_item_id: "1" } });
    expect(sentAuth).toBe("Bearer PREMINTED");
  });

  it("throws when neither a JWT nor minting material is provided", () => {
    expect(() => new TaskflowClient({ apiBaseUrl: "http://x" })).toThrow(/TASKFLOW_BOT_JWT/);
  });
});
