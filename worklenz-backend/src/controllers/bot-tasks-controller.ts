import { Request, Response } from "express";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";
import { NotificationsService } from "../services/notifications/notifications.service";
import { getClientPrimaryProject, getPPMSystemUser } from "../ppm/utils/ppm-db";

// PPM status enum allowed on ppm_deliverables.status (migration 003 + 013).
const PPM_DELIVERABLE_STATUSES = new Set([
  "incoming", "queued", "in_progress", "internal_review",
  "client_review", "revision", "approved", "done",
]);

export default class BotTasksController {
  /**
   * POST /ppm/api/bot/tasks
   *
   * Creates one or more tasks from bot-extracted action items.
   * Expects req.body to contain either a single task or an array of tasks under `tasks`.
   *
   * Single task body:
   *   { name, project_id, description?, assignees?, labels?, priority_id?, start?, end? }
   *
   * Batch body:
   *   { tasks: [{ name, project_id, ... }, ...] }
   */
  private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  public static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as string;
      const teamId = (req as any).user?.team_id as string;

      if (!userId || !teamId || !BotTasksController.UUID_RE.test(userId) || !BotTasksController.UUID_RE.test(teamId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid user or team context"));
      }

      const tasks = Array.isArray(req.body.tasks) ? req.body.tasks : [req.body];
      const created = [];

      for (const task of tasks) {
        if (!task.name?.trim()) {
          continue; // skip tasks without a name
        }

        if (!task.project_id || !BotTasksController.UUID_RE.test(task.project_id)) {
          continue; // skip tasks without a valid project UUID
        }

        // Verify project belongs to the bot's team
        const projectCheck = await db.query(
          `SELECT id FROM projects WHERE id = $1 AND team_id = $2`,
          [task.project_id, teamId]
        );
        if (projectCheck.rows.length === 0) {
          continue; // skip tasks for projects outside the bot's team
        }

        const payload = {
          name: task.name.slice(0, 100),
          project_id: task.project_id,
          description: task.description?.slice(0, 4000) || null,
          assignees: Array.isArray(task.assignees) ? task.assignees : [],
          labels: Array.isArray(task.labels) ? task.labels.map((l: string) => ({ name: l, color: "#a1a1a1" })) : [],
          reporter_id: userId,
          team_id: teamId,
          total_minutes: 0,
          inline: false,
          priority_id: task.priority_id || null,
          start_date: task.start || null,
          end_date: task.end || null,
          status_id: task.status_id || null,
        };

        const q = `SELECT create_task($1) AS task;`;
        const result = await db.query(q, [JSON.stringify(payload)]);
        const [data] = result.rows;

        if (data?.task) {
          // Send assignment notifications
          for (const member of data.task.assignees || []) {
            NotificationsService.createTaskUpdate(
              "ASSIGN",
              userId,
              data.task.id,
              member.user_id,
              member.team_id
            );
          }
          created.push(data.task);
        }
      }

      return res.status(200).json(new ServerResponse(true, { created, count: created.length }));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to create tasks"));
    }
  }

  /**
   * POST /ppm/api/bot/deliverables
   *
   * One-way create-mirror entrypoint for external sources (e.g. the
   * Monday -> taskflow forward-mirror). Creates a ppm_deliverable AND its
   * linked Worklenz task atomically, mirroring the portal create flow.
   *
   * Body:
   *   {
   *     client_id: UUID,            // PPM client to attach the deliverable to
   *     title: string,
   *     status?: ppm-status enum,   // defaults to 'queued' (Worklenz task placed at incoming)
   *     description?: string,
   *     type_id?: UUID,             // ppm_dropdown_options (category='type')
   *     priority_id?: UUID,         // ppm_dropdown_options (category='priority')
   *     channel_id?: UUID,          // ppm_dropdown_options (category='channel')
   *     visibility?: 'internal_only' | 'client_visible',  // default internal_only
   *     due_date?: ISO date,
   *     send_date?: YYYY-MM-DD,
   *     submission_date?: YYYY-MM-DD,
   *     asset_review_link?: string,
   *     external_ref?: { monday_item_id?: number|string }  // idempotency key
   *   }
   *
   * Idempotency: if external_ref.monday_item_id is supplied and a deliverable
   * already carries it, the existing row is returned (HTTP 200) and nothing is
   * created. This makes mirror re-runs / retries safe.
   *
   * ONE-WAY ONLY: this endpoint never writes back to Monday and performs no
   * status sync to the external source — it only ingests creates.
   */
  public static async createDeliverable(req: Request, res: Response) {
    try {
      const body = req.body || {};
      let clientId: string | null =
        body.client_id && BotTasksController.UUID_RE.test(body.client_id) ? body.client_id : null;
      const title = typeof body.title === "string" ? body.title.trim() : "";

      // Allow resolution by client name (the mirror knows the Monday client name,
      // not the taskflow UUID). Case-insensitive exact match on ppm_clients.name.
      if (!clientId && typeof body.client_name === "string" && body.client_name.trim()) {
        const lookup = await db.query(
          `SELECT id FROM ppm_clients WHERE LOWER(name) = LOWER($1) LIMIT 1`,
          [body.client_name.trim()]
        );
        if (lookup.rows[0]) {
          clientId = lookup.rows[0].id;
        } else {
          return res.status(409).json(
            new ServerResponse(false, null, `No taskflow client matches name "${body.client_name.trim()}"`)
          );
        }
      }

      if (!clientId || !BotTasksController.UUID_RE.test(clientId)) {
        return res.status(400).json(new ServerResponse(false, null, "Valid client_id (UUID) or resolvable client_name is required"));
      }
      if (!title) {
        return res.status(400).json(new ServerResponse(false, null, "title is required"));
      }
      if (title.length > 500) {
        return res.status(400).json(new ServerResponse(false, null, "title exceeds 500 characters"));
      }

      const status = typeof body.status === "string" && PPM_DELIVERABLE_STATUSES.has(body.status)
        ? body.status
        : "queued";

      const visibility = body.visibility === "client_visible" ? "client_visible" : "internal_only";

      // Optional UUID-typed fields — validate or null out (never trust caller).
      const typeId = body.type_id && BotTasksController.UUID_RE.test(body.type_id) ? body.type_id : null;
      const priorityId = body.priority_id && BotTasksController.UUID_RE.test(body.priority_id) ? body.priority_id : null;
      const channelId = body.channel_id && BotTasksController.UUID_RE.test(body.channel_id) ? body.channel_id : null;

      // External-ref / idempotency key.
      const rawMondayId = body.external_ref?.monday_item_id ?? body.monday_item_id ?? null;
      let mondayItemId: string | null = null;
      if (rawMondayId !== null && rawMondayId !== undefined && `${rawMondayId}`.trim() !== "") {
        if (!/^\d+$/.test(`${rawMondayId}`)) {
          return res.status(400).json(new ServerResponse(false, null, "external_ref.monday_item_id must be a numeric id"));
        }
        mondayItemId = `${rawMondayId}`;
      }

      // Idempotency short-circuit BEFORE creating anything.
      if (mondayItemId) {
        const existing = await db.query(
          `SELECT id, worklenz_task_id, status, title
             FROM ppm_deliverables
            WHERE monday_item_id = $1
            LIMIT 1`,
          [mondayItemId]
        );
        if (existing.rows[0]) {
          return res.status(200).json(new ServerResponse(true, {
            id: existing.rows[0].id,
            worklenz_task_id: existing.rows[0].worklenz_task_id,
            status: existing.rows[0].status,
            title: existing.rows[0].title,
            already_exists: true,
          }, "Already mirrored"));
        }
      }

      const primaryProject = await getClientPrimaryProject(clientId);
      if (!primaryProject) {
        return res.status(409).json(new ServerResponse(false, null, "Client has no primary project configured"));
      }
      if (!primaryProject.incoming_status_id) {
        return res.status(409).json(new ServerResponse(false, null, "Client project missing incoming status — run PPM status seed"));
      }

      const systemUserId = await getPPMSystemUser();

      const conn = await db.pool.connect();
      try {
        await conn.query("BEGIN");

        // 1. Insert deliverable (source of truth) with the external ref.
        const deliverableResult = await conn.query(
          `INSERT INTO ppm_deliverables (
             title, description, status, visibility, client_id,
             priority_id, type_id, channel_id, due_date, send_date,
             submission_date, asset_review_link, monday_item_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id`,
          [
            title,
            body.description || null,
            status,
            visibility,
            clientId,
            priorityId,
            typeId,
            channelId,
            body.due_date || null,
            body.send_date || null,
            body.submission_date || null,
            body.asset_review_link || null,
            mondayItemId,
          ]
        );
        const deliverableId = deliverableResult.rows[0].id;

        // 2. Create the Worklenz task in the client's primary project.
        //    The status sync trigger (migration 016) keeps deliverable.status in
        //    lockstep with the task status going forward, but on create we place
        //    the task at the project's "Incoming" status and keep the deliverable
        //    at the mapped PPM status the mirror computed.
        const taskBody = JSON.stringify({
          project_id: primaryProject.project_id,
          reporter_id: systemUserId,
          name: title,
          status_id: primaryProject.incoming_status_id,
        });

        const taskResult = await conn.query(`SELECT create_quick_task($1) AS task_json`, [taskBody]);
        const taskJson = taskResult.rows[0]?.task_json;
        const worklenzTaskId = typeof taskJson === "string" ? JSON.parse(taskJson)?.id : taskJson?.id;

        // 3. Link deliverable -> task.
        if (worklenzTaskId) {
          await conn.query(
            `UPDATE ppm_deliverables SET worklenz_task_id = $1 WHERE id = $2`,
            [worklenzTaskId, deliverableId]
          );
        }

        // 4. Audit trail.
        await conn.query(
          `INSERT INTO ppm_audit_log (entity_type, entity_id, action, actor_id, actor_type, details)
           VALUES ('deliverable', $1, 'created', $2, 'system', $3)`,
          [deliverableId, systemUserId, JSON.stringify({
            source: "monday_forward_mirror",
            service: (req as any).bot?.service || "bot",
            monday_item_id: mondayItemId,
            worklenz_task_id: worklenzTaskId,
            status,
          })]
        );

        await conn.query("COMMIT");

        return res.status(201).json(new ServerResponse(true, {
          id: deliverableId,
          worklenz_task_id: worklenzTaskId,
          status,
          title,
          monday_item_id: mondayItemId,
          already_exists: false,
        }));
      } catch (txErr: any) {
        try { await conn.query("ROLLBACK"); } catch { /* connection may be dead */ }
        // Unique-violation on monday_item_id = a concurrent mirror won the race.
        // Treat as idempotent success: fetch and return the winning row.
        if (txErr?.code === "23505" && mondayItemId) {
          const race = await db.query(
            `SELECT id, worklenz_task_id, status, title FROM ppm_deliverables WHERE monday_item_id = $1 LIMIT 1`,
            [mondayItemId]
          );
          if (race.rows[0]) {
            return res.status(200).json(new ServerResponse(true, {
              ...race.rows[0],
              already_exists: true,
            }, "Already mirrored (race)"));
          }
        }
        throw txErr;
      } finally {
        conn.release();
      }
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to create deliverable"));
    }
  }
}
