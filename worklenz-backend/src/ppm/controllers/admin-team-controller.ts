// PPM-OVERRIDE: Phase 2 — Team management controller for PPM role assignments
import { Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { UUID_RE } from "../utils/ppm-db";

const VALID_ROLES = ["partner", "employee"];

export default class AdminTeamController {
  /**
   * GET /ppm/api/admin/team
   * List all active team members with their PPM role (partner/employee/null).
   */
  public static async list(req: Request, res: Response) {
    try {
      const teamId = (req.user as any)?.team_id;
      if (!teamId) {
        return res.status(400).json(new ServerResponse(false, null, "No active team"));
      }

      const result = await db.pool.query(`
        SELECT
          tm.id AS team_member_id,
          u.id AS user_id,
          u.name,
          u.email,
          u.avatar_url,
          iu.ppm_role,
          iu.id AS ppm_internal_user_id
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        LEFT JOIN ppm_internal_users iu ON iu.user_id = u.id
        WHERE tm.team_id = $1 AND tm.active = true
        ORDER BY u.name ASC
      `, [teamId]);

      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch team members"));
    }
  }

  /**
   * PUT /ppm/api/admin/team/:userId/role
   * Assign or update a team member's PPM role.
   */
  public static async setRole(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { ppm_role } = req.body;

      if (!userId || !UUID_RE.test(userId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid user ID"));
      }
      if (!ppm_role || !VALID_ROLES.includes(ppm_role)) {
        return res.status(400).json(new ServerResponse(false, null, "Role must be 'partner' or 'employee'"));
      }

      // Verify target user is in the same team
      const teamId = (req.user as any)?.team_id;
      const memberCheck = await db.pool.query(
        `SELECT 1 FROM team_members WHERE user_id = $1 AND team_id = $2 AND active = true`,
        [userId, teamId]
      );
      if (!memberCheck.rows.length) {
        return res.status(404).json(new ServerResponse(false, null, "User is not a member of this team"));
      }

      const result = await db.pool.query(`
        INSERT INTO ppm_internal_users (user_id, ppm_role)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET ppm_role = $2, updated_at = NOW()
        RETURNING id, user_id, ppm_role
      `, [userId, ppm_role]);

      return res.status(200).json(new ServerResponse(true, result.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to set role"));
    }
  }

  /**
   * DELETE /ppm/api/admin/team/:userId/role
   * Remove a team member's PPM role (set to unassigned).
   */
  public static async removeRole(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const currentUserId = (req.user as any)?.id;

      if (!userId || !UUID_RE.test(userId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid user ID"));
      }

      // Prevent self-demotion
      if (userId === currentUserId) {
        return res.status(400).json(new ServerResponse(false, null, "Cannot remove your own partner role"));
      }

      // Verify target user is in the same team
      const teamId = (req.user as any)?.team_id;
      const memberCheck = await db.pool.query(
        `SELECT 1 FROM team_members WHERE user_id = $1 AND team_id = $2 AND active = true`,
        [userId, teamId]
      );
      if (!memberCheck.rows.length) {
        return res.status(404).json(new ServerResponse(false, null, "User is not a member of this team"));
      }

      await db.pool.query(
        `DELETE FROM ppm_internal_users WHERE user_id = $1`,
        [userId]
      );

      return res.status(200).json(new ServerResponse(true, null));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to remove role"));
    }
  }
}
