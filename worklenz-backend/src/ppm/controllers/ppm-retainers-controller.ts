import { Response } from "express";
import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * Retainer management + utilization rollup. Internal only.
 */
export default class PpmRetainersController {

  /**
   * GET /ppm/api/retainers?client_id=...
   */
  public static async list(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { client_id } = req.query;

      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (client_id) {
        conditions.push(`r.client_id = $${idx++}`);
        params.push(client_id);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const result = await db.query(
        `SELECT r.*, c.name AS client_name
         FROM ppm_retainer_utilization r
         JOIN ppm_clients c ON c.id = r.client_id
         ${where}
         ORDER BY r.period_start DESC`,
        params
      );

      return res.status(200).send(new ServerResponse(true, result.rows));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch retainers"));
    }
  }

  /**
   * GET /ppm/api/retainers/:id
   */
  public static async getById(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const result = await db.query(
        `SELECT r.*, c.name AS client_name
         FROM ppm_retainer_utilization r
         JOIN ppm_clients c ON c.id = r.client_id
         WHERE r.retainer_id = $1`,
        [req.params.id]
      );
      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Retainer not found"));
      }
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch retainer"));
    }
  }

  /**
   * POST /ppm/api/retainers
   */
  public static async create(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { client_id, period_start, period_end, budgeted_hours, budgeted_amount, notes } = req.body;

      if (!client_id || !period_start || !period_end || !budgeted_hours) {
        return res.status(400).send(new ServerResponse(false, null,
          "client_id, period_start, period_end, and budgeted_hours are required"));
      }

      const result = await db.query(
        `INSERT INTO ppm_retainers (client_id, period_start, period_end, budgeted_hours, budgeted_amount, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [client_id, period_start, period_end, budgeted_hours, budgeted_amount || null, notes || null]
      );

      return res.status(201).send(new ServerResponse(true, result.rows[0]));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to create retainer"));
    }
  }

  /**
   * PUT /ppm/api/retainers/:id
   */
  public static async update(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const fields = ["period_start", "period_end", "budgeted_hours", "budgeted_amount", "notes"];
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
        `UPDATE ppm_retainers SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        params
      );

      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Retainer not found"));
      }
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to update retainer"));
    }
  }

  /**
   * DELETE /ppm/api/retainers/:id
   */
  public static async deleteById(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const result = await db.query(
        "DELETE FROM ppm_retainers WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!result.rows.length) {
        return res.status(404).send(new ServerResponse(false, null, "Retainer not found"));
      }
      return res.status(200).send(new ServerResponse(true, null, "Deleted"));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to delete retainer"));
    }
  }
}
