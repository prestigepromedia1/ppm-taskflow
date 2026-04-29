import { Response } from "express";
import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * PPMBot integration endpoint.
 * Creates a Worklenz task + ppm_deliverable atomically in one transaction.
 * Designed for PPMBot (AI agent) to create tasks from meeting transcripts.
 */
export default class PpmBotController {

  /**
   * POST /ppm/api/bot/tasks
   * Atomic task creation: Worklenz task + ppm_deliverable in one transaction.
   *
   * Required body:
   * - title: string
   * - client_id: uuid (ppm_clients.id)
   * - project_id: uuid (Worklenz projects.id)
   *
   * Optional body:
   * - description, assignee_id, type_id, channel_id, priority_id,
   *   visibility, estimated_hours, submission_date, send_date, due_date
   */
  public static async createTask(req: IPpmRequest, res: Response): Promise<Response> {
    const pgClient = await db.pool.connect();
    try {
      const {
        title, description, client_id, project_id,
        assignee_id, type_id, channel_id, priority_id,
        visibility, estimated_hours,
        submission_date, revisions_deadline, send_date, due_date
      } = req.body;

      if (!title || !client_id || !project_id) {
        pgClient.release();
        return res.status(400).send(new ServerResponse(false, null,
          "title, client_id, and project_id are required"));
      }

      await pgClient.query("BEGIN");

      // 1. Get required defaults for Worklenz task
      const statusResult = await pgClient.query(
        `SELECT id FROM task_statuses WHERE project_id = $1 ORDER BY sort_order ASC LIMIT 1`,
        [project_id]
      );
      if (!statusResult.rows.length) {
        await pgClient.query("ROLLBACK");
        pgClient.release();
        return res.status(400).send(new ServerResponse(false, null,
          "Project has no task statuses. Create the project first."));
      }

      const priorityResult = await pgClient.query(
        `SELECT id FROM task_priorities ORDER BY value ASC LIMIT 1`
      );
      const taskNoResult = await pgClient.query(
        `SELECT COALESCE(MAX(task_no), 0) + 1 AS next_no FROM tasks WHERE project_id = $1`,
        [project_id]
      );

      // 2. Create Worklenz task
      const taskResult = await pgClient.query(
        `INSERT INTO tasks (name, description, project_id, status_id, priority_id, reporter_id, task_no, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          title,
          description || null,
          project_id,
          statusResult.rows[0].id,
          priorityResult.rows[0]?.id || statusResult.rows[0].id, // fallback
          req.user?.id || null,
          taskNoResult.rows[0].next_no,
          submission_date || null,
          due_date || null
        ]
      );
      const worklenzTaskId = taskResult.rows[0].id;

      // 3. Create ppm_deliverable linked to Worklenz task
      const deliverableResult = await pgClient.query(
        `INSERT INTO ppm_deliverables
          (worklenz_task_id, title, description, client_id, assignee_id,
           type_id, channel_id, priority_id, visibility, estimated_hours,
           submission_date, revisions_deadline, send_date, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          worklenzTaskId, title, description || null, client_id, assignee_id || null,
          type_id || null, channel_id || null, priority_id || null,
          visibility || "internal_only", estimated_hours || null,
          submission_date || null, revisions_deadline || null,
          send_date || null, due_date || null
        ]
      );

      // 4. Assign task to user if assignee_id provided
      if (assignee_id) {
        // Find team_member_id for this user in the project's team
        const tmResult = await pgClient.query(
          `SELECT tm.id FROM team_members tm
           JOIN projects p ON p.team_id = tm.team_id
           WHERE p.id = $1 AND tm.user_id = $2`,
          [project_id, assignee_id]
        );
        if (tmResult.rows.length) {
          await pgClient.query(
            `INSERT INTO tasks_assignees (task_id, team_member_id, project_id, assigned_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [worklenzTaskId, tmResult.rows[0].id, project_id, req.user?.id || null]
          );
        }
      }

      await pgClient.query("COMMIT");

      return res.status(201).send(new ServerResponse(true, {
        worklenz_task_id: worklenzTaskId,
        deliverable: deliverableResult.rows[0]
      }));
    } catch (error: any) {
      await pgClient.query("ROLLBACK");
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to create task"));
    } finally {
      pgClient.release();
    }
  }
}
