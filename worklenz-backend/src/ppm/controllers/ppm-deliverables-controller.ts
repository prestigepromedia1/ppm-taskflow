import { Response } from "express";
import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPpmRequest } from "../interfaces/ppm-request";
import { getPpmDbClient } from "../middleware/ppm-rls-context";

/** Status label mapping for client-facing views (3-tier visibility). */
const CLIENT_STATUS_LABELS: Record<string, string> = {
  queued: "Submitted",
  in_progress: "In Progress",
  internal_review: "In Progress",
  client_review: "Awaiting Review",
  revision: "Revision",
  approved: "Approved",
  done: "Done",
};

/** Valid status transitions. Key = current status, value = allowed next statuses. */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  queued: ["in_progress"],
  in_progress: ["internal_review", "client_review"],
  internal_review: ["in_progress", "client_review"],
  client_review: ["approved", "revision"],
  revision: ["in_progress"],
  approved: ["done"],
  done: [],
};

export default class PpmDeliverablesController {

  // ─── Internal routes (require Worklenz login via isLoggedIn) ───

  /**
   * GET /ppm/api/deliverables?client_id=...&status=...&page=...&size=...
   * Internal: list all deliverables, optionally filtered.
   */
  public static async list(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { client_id, status, assignee_id, page = "1", size = "20" } = req.query;
      const pageNum = Math.max(1, Number(page));
      const pageSize = Math.min(100, Math.max(1, Number(size)));
      const offset = (pageNum - 1) * pageSize;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (client_id) {
        conditions.push(`d.client_id = $${paramIdx++}`);
        params.push(client_id);
      }
      if (status) {
        conditions.push(`d.status = $${paramIdx++}`);
        params.push(status);
      }
      if (assignee_id) {
        conditions.push(`d.assignee_id = $${paramIdx++}`);
        params.push(assignee_id);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const countQ = `SELECT COUNT(*) FROM ppm_deliverables d ${where}`;
      const dataQ = `
        SELECT d.*,
               c.name AS client_name,
               u.name AS assignee_name,
               tp.label AS type_label, tp.color AS type_color,
               ch.label AS channel_label, ch.color AS channel_color,
               pr.label AS priority_label, pr.color AS priority_color
        FROM ppm_deliverables d
        LEFT JOIN ppm_clients c ON c.id = d.client_id
        LEFT JOIN users u ON u.id = d.assignee_id
        LEFT JOIN ppm_dropdown_options tp ON tp.id = d.type_id
        LEFT JOIN ppm_dropdown_options ch ON ch.id = d.channel_id
        LEFT JOIN ppm_dropdown_options pr ON pr.id = d.priority_id
        ${where}
        ORDER BY d.created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `;
      params.push(pageSize, offset);

      const [countResult, dataResult] = await Promise.all([
        db.query(countQ, params.slice(0, conditions.length)),
        db.query(dataQ, params),
      ]);

      return res.status(200).send(new ServerResponse(true, {
        total: Number(countResult.rows[0].count),
        data: dataResult.rows,
      }));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch deliverables"));
    }
  }

  /**
   * GET /ppm/api/deliverables/:id
   * Internal: get single deliverable with all joins.
   */
  public static async getById(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const result = await db.query(
        `SELECT d.*,
                c.name AS client_name,
                u.name AS assignee_name,
                tp.label AS type_label, tp.color AS type_color,
                ch.label AS channel_label, ch.color AS channel_color,
                pr.label AS priority_label, pr.color AS priority_color
         FROM ppm_deliverables d
         LEFT JOIN ppm_clients c ON c.id = d.client_id
         LEFT JOIN users u ON u.id = d.assignee_id
         LEFT JOIN ppm_dropdown_options tp ON tp.id = d.type_id
         LEFT JOIN ppm_dropdown_options ch ON ch.id = d.channel_id
         LEFT JOIN ppm_dropdown_options pr ON pr.id = d.priority_id
         WHERE d.id = $1`,
        [req.params.id]
      );
      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Deliverable not found"));
      }
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch deliverable"));
    }
  }

  /**
   * POST /ppm/api/deliverables
   * Internal: create a new deliverable.
   */
  public static async create(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const {
        title, description, client_id, assignee_id,
        type_id, channel_id, priority_id, visibility,
        submission_date, revisions_deadline, send_date, due_date,
        asset_review_link, estimated_hours
      } = req.body;

      if (!title || !client_id) {
        return res.status(400).send(new ServerResponse(false, null, "title and client_id are required"));
      }

      const result = await db.query(
        `INSERT INTO ppm_deliverables
          (title, description, client_id, assignee_id, type_id, channel_id, priority_id,
           visibility, submission_date, revisions_deadline, send_date, due_date,
           asset_review_link, estimated_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [title, description || null, client_id, assignee_id || null,
         type_id || null, channel_id || null, priority_id || null,
         visibility || "internal_only",
         submission_date || null, revisions_deadline || null,
         send_date || null, due_date || null,
         asset_review_link || null, estimated_hours || null]
      );

      return res.status(201).send(new ServerResponse(true, result.rows[0]));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to create deliverable"));
    }
  }

  /**
   * PUT /ppm/api/deliverables/:id
   * Internal: update deliverable fields (not status — use PATCH for transitions).
   */
  public static async update(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const fields = [
        "title", "description", "assignee_id", "type_id", "channel_id", "priority_id",
        "visibility", "submission_date", "revisions_deadline", "send_date", "due_date",
        "asset_review_link", "estimated_hours", "actual_hours"
      ];
      const setClauses: string[] = [];
      const params: any[] = [];
      let idx = 1;

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          setClauses.push(`${field} = $${idx++}`);
          params.push(req.body[field]);
        }
      }

      if (!setClauses.length) {
        return res.status(400).send(new ServerResponse(false, null, "No fields to update"));
      }

      params.push(req.params.id);
      const result = await db.query(
        `UPDATE ppm_deliverables SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        params
      );

      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Deliverable not found"));
      }
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to update deliverable"));
    }
  }

  /**
   * PATCH /ppm/api/deliverables/:id/status
   * Status transition with validation. Works for both internal and client users.
   * Body: { status: "approved" }
   */
  public static async updateStatus(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { status: newStatus } = req.body;
      if (!newStatus) {
        return res.status(400).send(new ServerResponse(false, null, "status is required"));
      }

      // Get current status
      const current = await db.query(
        "SELECT id, status, client_id FROM ppm_deliverables WHERE id = $1",
        [req.params.id]
      );
      const [deliverable] = current.rows;
      if (!deliverable) {
        return res.status(404).send(new ServerResponse(false, null, "Deliverable not found"));
      }

      // Validate transition
      const allowed = STATUS_TRANSITIONS[deliverable.status] || [];
      if (!allowed.includes(newStatus)) {
        return res.status(400).send(new ServerResponse(false, null,
          `Cannot transition from '${deliverable.status}' to '${newStatus}'. Allowed: ${allowed.join(", ") || "none"}`
        ));
      }

      // Client users can only approve or request revision
      if (req.ppmClient) {
        const clientAllowed = ["approved", "revision"];
        if (!clientAllowed.includes(newStatus)) {
          return res.status(403).send(new ServerResponse(false, null,
            "Client users can only approve or request revision"
          ));
        }
      }

      // Perform update (triggers LISTEN/NOTIFY via ppm_notify_status_change)
      const result = await db.query(
        "UPDATE ppm_deliverables SET status = $1 WHERE id = $2 RETURNING *",
        [newStatus, req.params.id]
      );

      // Log to audit
      const actorId = req.ppmClient?.client_user_id || req.user?.id;
      const actorType = req.ppmClient ? "client_user" : "internal_user";
      await db.query(
        `INSERT INTO ppm_audit_log (entity_type, entity_id, action, actor_id, actor_type, details)
         VALUES ('deliverable', $1, $2, $3, $4, $5)`,
        [
          req.params.id,
          `status_change:${deliverable.status}->${newStatus}`,
          actorId || null,
          actorType,
          JSON.stringify({ old_status: deliverable.status, new_status: newStatus, ...(req.body.feedback ? { feedback: req.body.feedback } : {}) })
        ]
      );

      return res.status(200).send(new ServerResponse(true, result.rows[0]));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to update status"));
    }
  }

  /**
   * DELETE /ppm/api/deliverables/:id
   * Internal: soft-delete by setting status to 'done' or hard delete.
   */
  public static async deleteById(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const result = await db.query(
        "DELETE FROM ppm_deliverables WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!result.rows.length) {
        return res.status(404).send(new ServerResponse(false, null, "Deliverable not found"));
      }
      return res.status(200).send(new ServerResponse(true, null, "Deleted"));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to delete deliverable"));
    }
  }

  // ─── Client portal routes (require ppmClientAuth + RLS) ───

  /**
   * GET /ppm/api/portal/deliverables
   * Client: list deliverables visible to this client (RLS-scoped + visibility filter).
   */
  public static async clientList(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const dbClient = getPpmDbClient(req);
      const { status, page = "1", size = "20" } = req.query;
      const pageNum = Math.max(1, Number(page));
      const pageSize = Math.min(100, Math.max(1, Number(size)));
      const offset = (pageNum - 1) * pageSize;

      const conditions = ["d.visibility = 'client_visible'"];
      const params: any[] = [];
      let paramIdx = 1;

      if (status) {
        conditions.push(`d.status = $${paramIdx++}`);
        params.push(status);
      }

      const where = `WHERE ${conditions.join(" AND ")}`;

      const countQ = `SELECT COUNT(*) FROM ppm_deliverables d ${where}`;
      const dataQ = `
        SELECT d.id, d.title, d.description, d.status, d.send_date, d.due_date,
               d.asset_review_link, d.estimated_hours, d.actual_hours, d.month_completed,
               d.created_at, d.updated_at,
               tp.label AS type_label, tp.color AS type_color,
               ch.label AS channel_label, ch.color AS channel_color,
               pr.label AS priority_label, pr.color AS priority_color
        FROM ppm_deliverables d
        LEFT JOIN ppm_dropdown_options tp ON tp.id = d.type_id
        LEFT JOIN ppm_dropdown_options ch ON ch.id = d.channel_id
        LEFT JOIN ppm_dropdown_options pr ON pr.id = d.priority_id
        ${where}
        ORDER BY d.created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `;
      params.push(pageSize, offset);

      const [countResult, dataResult] = await Promise.all([
        dbClient.query(countQ, params.slice(0, status ? 1 : 0)),
        dbClient.query(dataQ, params),
      ]);

      // Map statuses to client-facing labels
      const data = dataResult.rows.map((row: any) => ({
        ...row,
        status_label: CLIENT_STATUS_LABELS[row.status] || row.status,
      }));

      return res.status(200).send(new ServerResponse(true, {
        total: Number(countResult.rows[0].count),
        data,
      }));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch deliverables"));
    }
  }

  /**
   * GET /ppm/api/portal/deliverables/:id
   * Client: get single deliverable (RLS-scoped).
   */
  public static async clientGetById(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const dbClient = getPpmDbClient(req);
      const result = await dbClient.query(
        `SELECT d.id, d.title, d.description, d.status, d.send_date, d.due_date,
                d.asset_review_link, d.estimated_hours, d.actual_hours, d.month_completed,
                d.created_at, d.updated_at,
                tp.label AS type_label, tp.color AS type_color,
                ch.label AS channel_label, ch.color AS channel_color,
                pr.label AS priority_label, pr.color AS priority_color
         FROM ppm_deliverables d
         LEFT JOIN ppm_dropdown_options tp ON tp.id = d.type_id
         LEFT JOIN ppm_dropdown_options ch ON ch.id = d.channel_id
         LEFT JOIN ppm_dropdown_options pr ON pr.id = d.priority_id
         WHERE d.id = $1 AND d.visibility = 'client_visible'`,
        [req.params.id]
      );
      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Deliverable not found"));
      }
      data.status_label = CLIENT_STATUS_LABELS[data.status] || data.status;
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch deliverable"));
    }
  }
}
