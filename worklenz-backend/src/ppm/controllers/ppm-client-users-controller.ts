import { Response } from "express";
import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * Manage client portal users. Internal-only (requires Worklenz login).
 */
export default class PpmClientUsersController {

  /**
   * GET /ppm/api/client-users?client_id=...
   * List portal users for a client.
   */
  public static async list(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { client_id } = req.query;
      if (!client_id) {
        return res.status(400).send(new ServerResponse(false, null, "client_id is required"));
      }

      const result = await db.query(
        `SELECT cu.id, cu.email, cu.display_name, cu.role,
                cu.last_login_at, cu.created_at, cu.deactivated_at,
                inv.name AS invited_by_name
         FROM ppm_client_users cu
         LEFT JOIN users inv ON inv.id = cu.invited_by
         WHERE cu.client_id = $1
         ORDER BY cu.created_at DESC`,
        [client_id]
      );

      return res.status(200).send(new ServerResponse(true, result.rows));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch client users"));
    }
  }

  /**
   * POST /ppm/api/client-users
   * Invite a new client portal user.
   * Body: { email, client_id, role?, display_name? }
   */
  public static async invite(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { email, client_id, role, display_name } = req.body;

      if (!email || !client_id) {
        return res.status(400).send(new ServerResponse(false, null, "email and client_id are required"));
      }

      const result = await db.query(
        `INSERT INTO ppm_client_users (email, client_id, role, display_name, invited_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, client_id, role, display_name, created_at`,
        [email, client_id, role || "viewer", display_name || null, req.user?.id || null]
      );

      // Immediately generate a magic link for the invite email
      const tokenResult = await db.query(
        "SELECT ppm_generate_magic_link($1) AS token",
        [email]
      );

      const user = result.rows[0];
      const token = tokenResult.rows[0]?.token;

      return res.status(201).send(new ServerResponse(true, {
        ...user,
        // Only include token in non-production for testing
        ...(process.env.NODE_ENV !== "production" ? { magic_link_token: token } : {})
      }));
    } catch (error: any) {
      if (error?.constraint === "ppm_client_users_email_key") {
        return res.status(200).send(new ServerResponse(false, null, "A user with this email already exists"));
      }
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to invite client user"));
    }
  }

  /**
   * PUT /ppm/api/client-users/:id
   * Update role or display_name.
   */
  public static async update(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { role, display_name } = req.body;
      const setClauses: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (role !== undefined) {
        setClauses.push(`role = $${idx++}`);
        params.push(role);
      }
      if (display_name !== undefined) {
        setClauses.push(`display_name = $${idx++}`);
        params.push(display_name);
      }

      if (!setClauses.length) {
        return res.status(400).send(new ServerResponse(false, null, "No fields to update"));
      }

      params.push(req.params.id);
      const result = await db.query(
        `UPDATE ppm_client_users SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        params
      );

      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Client user not found"));
      }
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to update client user"));
    }
  }

  /**
   * DELETE /ppm/api/client-users/:id
   * Soft-deactivate a client portal user.
   */
  public static async deactivate(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const result = await db.query(
        `UPDATE ppm_client_users SET deactivated_at = NOW(),
                magic_link_token = NULL, magic_link_expires_at = NULL
         WHERE id = $1 AND deactivated_at IS NULL
         RETURNING id, email`,
        [req.params.id]
      );

      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Client user not found or already deactivated"));
      }
      return res.status(200).send(new ServerResponse(true, data, "User deactivated"));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to deactivate client user"));
    }
  }
}
