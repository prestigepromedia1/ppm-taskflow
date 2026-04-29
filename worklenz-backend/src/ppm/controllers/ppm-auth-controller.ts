import { NextFunction, Response } from "express";
import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * Client portal authentication controller.
 * Magic link flow: requestMagicLink → (email sent) → verifyMagicLink → session created.
 */
export default class PpmAuthController {

  /**
   * POST /ppm/api/auth/magic-link
   * Generate a magic link token and return it (email sending is a separate concern).
   */
  public static async requestMagicLink(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send(new ServerResponse(false, null, "Email is required"));
      }

      const result = await db.query("SELECT ppm_generate_magic_link($1) AS token", [email]);
      const [row] = result.rows;

      if (!row?.token) {
        // Don't reveal whether the email exists
        return res.status(200).send(new ServerResponse(true, null, "If this email is registered, a magic link has been sent."));
      }

      // In production, send email here. For now, return the token directly.
      // TODO: Wire email sending via SES or similar
      return res.status(200).send(new ServerResponse(true, {
        message: "Magic link generated",
        // Only include token in non-production for testing
        ...(process.env.NODE_ENV !== "production" ? { token: row.token } : {})
      }));
    } catch (error: any) {
      log_error(error);
      // Don't reveal internal errors for auth endpoints
      return res.status(200).send(new ServerResponse(true, null, "If this email is registered, a magic link has been sent."));
    }
  }

  /**
   * GET /ppm/api/auth/verify?token=...
   * Validate magic link, consume it, create session.
   */
  public static async verifyMagicLink(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") {
        return res.status(400).send(new ServerResponse(false, null, "Token is required"));
      }

      const result = await db.query("SELECT * FROM ppm_validate_magic_link($1)", [token]);
      const [user] = result.rows;

      if (!user) {
        return res.status(401).send(new ServerResponse(false, null, "Invalid or expired magic link"));
      }

      // Set client session
      const session = req.session as any;
      session.ppmClient = {
        client_user_id: user.user_id,
        email: user.email,
        client_id: user.client_id,
        role: user.role
      };

      return res.status(200).send(new ServerResponse(true, {
        client_user_id: user.user_id,
        email: user.email,
        client_id: user.client_id,
        role: user.role
      }));
    } catch (error: any) {
      log_error(error);
      return res.status(401).send(new ServerResponse(false, null, "Invalid or expired magic link"));
    }
  }

  /**
   * GET /ppm/api/auth/me
   * Return current client session info. Requires ppmClientAuth middleware.
   */
  public static async me(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      if (!req.ppmClient) {
        return res.status(401).send(new ServerResponse(false, null, "Not authenticated"));
      }

      const result = await db.query(
        `SELECT cu.id, cu.email, cu.display_name, cu.role, cu.client_id,
                c.name AS client_name, c.branding_config
         FROM ppm_client_users cu
         JOIN ppm_clients c ON c.id = cu.client_id
         WHERE cu.id = $1 AND cu.deactivated_at IS NULL`,
        [req.ppmClient.client_user_id]
      );
      const [user] = result.rows;

      if (!user) {
        return res.status(401).send(new ServerResponse(false, null, "User not found"));
      }

      return res.status(200).send(new ServerResponse(true, user));
    } catch (error: any) {
      log_error(error);
      return res.status(500).send(new ServerResponse(false, null, "Failed to fetch user info"));
    }
  }

  /**
   * POST /ppm/api/auth/logout
   */
  public static async logout(req: IPpmRequest, res: Response): Promise<Response> {
    const session = req.session as any;
    delete session.ppmClient;
    return res.status(200).send(new ServerResponse(true, null, "Logged out"));
  }
}
