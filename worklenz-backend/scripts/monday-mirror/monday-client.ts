/**
 * Minimal read-only Monday.com GraphQL client for the forward-mirror.
 *
 * Only reads: it queries items created since a cursor. It never mutates Monday.
 * The API key is read from the environment (MONDAY_API_KEY); never hardcoded.
 */

import axios, { AxiosInstance } from "axios";

const MONDAY_API_URL = "https://api.monday.com/v2";

export interface MondayColumnValue {
  id: string;
  type: string;
  text: string | null;
  value: string | null; // raw JSON string
}

export interface MondayItem {
  id: string;
  name: string;
  created_at: string; // ISO timestamp
  group: { id: string; title: string } | null;
  column_values: MondayColumnValue[];
}

export interface MondayClientOptions {
  apiKey: string;
  /** API version header. Monday pins behavior by date. */
  apiVersion?: string;
  /** Injected for tests. */
  http?: AxiosInstance;
}

export class MondayClient {
  private http: AxiosInstance;

  constructor(opts: MondayClientOptions) {
    if (!opts.apiKey || !opts.apiKey.trim()) {
      throw new Error("MONDAY_API_KEY is required");
    }
    this.http =
      opts.http ??
      axios.create({
        baseURL: MONDAY_API_URL,
        headers: {
          Authorization: opts.apiKey,
          "Content-Type": "application/json",
          "API-Version": opts.apiVersion ?? "2024-01",
        },
        timeout: 30000,
      });
  }

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await this.http.post("", { query, variables });
    if (res.data?.errors?.length) {
      throw new Error(`Monday API error: ${JSON.stringify(res.data.errors)}`);
    }
    return res.data?.data as T;
  }

  /**
   * Fetch items from a board, newest first, paging until items older than
   * `sinceIso` are reached. Returns only items with created_at > sinceIso.
   *
   * Uses items_page ordering by __creation_log DESC so we can stop early.
   */
  public async getItemsCreatedSince(boardId: string, sinceIso: string): Promise<MondayItem[]> {
    const sinceMs = new Date(sinceIso).getTime();
    const collected: MondayItem[] = [];
    let cursor: string | null = null;

    // Guard against runaway paging.
    for (let page = 0; page < 50; page++) {
      const data: any = await this.query(
        `query ($boardId: ID!, $cursor: String) {
           boards(ids: [$boardId]) {
             items_page(limit: 100, cursor: $cursor,
               query_params: { order_by: [{ column_id: "__creation_log__", direction: desc }] }) {
               cursor
               items {
                 id
                 name
                 created_at
                 group { id title }
                 column_values { id type text value }
               }
             }
           }
         }`,
        { boardId, cursor }
      );

      const itemsPage = data?.boards?.[0]?.items_page;
      const items: MondayItem[] = itemsPage?.items ?? [];
      if (items.length === 0) break;

      let reachedOld = false;
      for (const item of items) {
        const createdMs = new Date(item.created_at).getTime();
        if (createdMs > sinceMs) {
          collected.push(item);
        } else {
          // Items are newest-first, so once we hit an old one we can stop.
          reachedOld = true;
        }
      }

      cursor = itemsPage?.cursor ?? null;
      if (reachedOld || !cursor) break;
    }

    // Return oldest-first so the cursor advances monotonically as we process.
    return collected.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
}

/** Read a column's display text by id from a Monday item. */
export function columnText(item: MondayItem, columnId: string | undefined): string | null {
  if (!columnId) return null;
  const col = item.column_values.find((c) => c.id === columnId);
  return col?.text?.trim() || null;
}
