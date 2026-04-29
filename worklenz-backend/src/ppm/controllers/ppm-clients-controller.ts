import { Response } from "express";
import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * CRUD for ppm_clients. Internal only (requires Worklenz login).
 */
export default class PpmClientsController {

  /**
   * GET /ppm/api/clients?status=...&page=...&size=...
   */
  public static async list(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { status, search, page = "1", size = "20" } = req.query;
      const pageNum = Math.max(1, Number(page));
      const pageSize = Math.min(100, Math.max(1, Number(size)));
      const offset = (pageNum - 1) * pageSize;

      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (status) {
        conditions.push(`c.status = $${idx++}`);
        params.push(status);
      }
      if (search) {
        conditions.push(`c.name ILIKE $${idx++}`);
        params.push(`%${search}%`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const countQ = `SELECT COUNT(*) FROM ppm_clients c ${where}`;
      const dataQ = `
        SELECT c.*, u.name AS primary_partner_name,
               (SELECT COUNT(*) FROM ppm_deliverables d WHERE d.client_id = c.id) AS deliverable_count,
               (SELECT COUNT(*) FROM ppm_client_users cu WHERE cu.client_id = c.id AND cu.deactivated_at IS NULL) AS user_count
        FROM ppm_clients c
        LEFT JOIN users u ON u.id = c.primary_partner_id
        ${where}
        ORDER BY c.name ASC
        LIMIT $${idx++} OFFSET $${idx++}
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
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch clients"));
    }
  }

  /**
   * GET /ppm/api/clients/:id
   */
  public static async getById(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const result = await db.query(
        `SELECT c.*, u.name AS primary_partner_name
         FROM ppm_clients c
         LEFT JOIN users u ON u.id = c.primary_partner_id
         WHERE c.id = $1`,
        [req.params.id]
      );
      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Client not found"));
      }
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch client"));
    }
  }

  /**
   * POST /ppm/api/clients
   */
  public static async create(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const {
        name, status, primary_partner_id, branding_config,
        contracted_scope, contracted_hours_monthly,
        website, contact_name, contact_email, contact_phone
      } = req.body;

      if (!name) {
        return res.status(400).send(new ServerResponse(false, null, "name is required"));
      }

      const result = await db.query(
        `INSERT INTO ppm_clients
          (name, status, primary_partner_id, branding_config,
           contracted_scope, contracted_hours_monthly,
           website, contact_name, contact_email, contact_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [name, status || "active_project", primary_partner_id || null,
         branding_config ? JSON.stringify(branding_config) : "{}",
         contracted_scope || null, contracted_hours_monthly || null,
         website || null, contact_name || null, contact_email || null, contact_phone || null]
      );

      return res.status(201).send(new ServerResponse(true, result.rows[0]));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to create client"));
    }
  }

  /**
   * PUT /ppm/api/clients/:id
   */
  public static async update(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const fields = [
        "name", "status", "primary_partner_id", "branding_config",
        "contracted_scope", "contracted_hours_monthly",
        "website", "contact_name", "contact_email", "contact_phone", "deactivated_at"
      ];
      const setClauses: string[] = [];
      const params: any[] = [];
      let idx = 1;

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          const value = field === "branding_config" ? JSON.stringify(req.body[field]) : req.body[field];
          setClauses.push(`${field} = $${idx++}`);
          params.push(value);
        }
      }

      if (!setClauses.length) {
        return res.status(400).send(new ServerResponse(false, null, "No fields to update"));
      }

      params.push(req.params.id);
      const result = await db.query(
        `UPDATE ppm_clients SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        params
      );

      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Client not found"));
      }
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to update client"));
    }
  }
}
