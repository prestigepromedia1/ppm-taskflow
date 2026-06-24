/**
 * Thin client for the taskflow bot API (POST /ppm/api/bot/deliverables).
 *
 * Auth: a short-lived service JWT signed with JWT_SECRET, exactly how the
 * codebase signs bot tokens (see ppmbot.service.ts / bot-auth-middleware.ts:
 * payload { service, team_id, user_id }). A pre-minted TASKFLOW_BOT_JWT may be
 * supplied instead, in which case JWT_SECRET is not needed.
 *
 * One-way only: this client only creates deliverables. It never reads or writes
 * status back to Monday.
 */

import axios, { AxiosInstance } from "axios";
import jwt from "jsonwebtoken";

export interface DeliverablePayload {
  /** Either client_id (UUID) or client_name (resolved server-side) is required. */
  client_id?: string;
  client_name?: string;
  title: string;
  status?: string;
  description?: string | null;
  type_id?: string | null;
  priority_id?: string | null;
  channel_id?: string | null;
  visibility?: "internal_only" | "client_visible";
  due_date?: string | null;
  send_date?: string | null;
  submission_date?: string | null;
  asset_review_link?: string | null;
  external_ref: { monday_item_id: string };
}

export interface DeliverableResult {
  id: string;
  worklenz_task_id: string | null;
  status: string;
  title: string;
  monday_item_id?: string | null;
  already_exists: boolean;
}

export interface TaskflowClientOptions {
  apiBaseUrl: string;
  /** Pre-minted JWT. If absent, one is minted from jwtSecret + team/user. */
  botJwt?: string;
  jwtSecret?: string;
  teamId?: string;
  userId?: string;
  /** Injected for tests. */
  http?: AxiosInstance;
}

export class TaskflowClient {
  private http: AxiosInstance;
  private opts: TaskflowClientOptions;

  constructor(opts: TaskflowClientOptions) {
    if (!opts.apiBaseUrl) throw new Error("TASKFLOW_API_BASE_URL is required");
    if (!opts.botJwt && !(opts.jwtSecret && opts.teamId && opts.userId)) {
      throw new Error(
        "Provide TASKFLOW_BOT_JWT, or JWT_SECRET + TASKFLOW_TEAM_ID + TASKFLOW_USER_ID to mint one"
      );
    }
    this.opts = opts;
    this.http =
      opts.http ??
      axios.create({ baseURL: opts.apiBaseUrl, timeout: 30000 });
  }

  /** Mint a short-lived service JWT identical in shape to ppmbot.service.ts. */
  private token(): string {
    if (this.opts.botJwt) return this.opts.botJwt;
    return jwt.sign(
      { service: "monday-mirror", team_id: this.opts.teamId, user_id: this.opts.userId },
      this.opts.jwtSecret as string,
      { expiresIn: "5m" }
    );
  }

  /** Create (or no-op-return) a deliverable. Idempotent on monday_item_id server-side. */
  public async createDeliverable(payload: DeliverablePayload): Promise<DeliverableResult> {
    const res = await this.http.post("/ppm/api/bot/deliverables", payload, {
      headers: {
        Authorization: `Bearer ${this.token()}`,
        "Content-Type": "application/json",
      },
    });
    // ServerResponse shape: { done, body, ... }
    const body = res.data?.body ?? res.data;
    return body as DeliverableResult;
  }
}
