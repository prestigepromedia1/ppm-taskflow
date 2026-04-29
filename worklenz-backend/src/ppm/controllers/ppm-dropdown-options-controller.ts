import { Response } from "express";
import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * Admin-managed dropdown options (priority, channel, type).
 * Internal only (requires Worklenz login).
 */
export default class PpmDropdownOptionsController {

  /**
   * GET /ppm/api/dropdown-options?category=priority|channel|type
   */
  public static async list(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { category } = req.query;

      const conditions: string[] = ["is_active = TRUE"];
      const params: any[] = [];
      let idx = 1;

      if (category) {
        conditions.push(`category = $${idx++}`);
        params.push(category);
      }

      const result = await db.query(
        `SELECT * FROM ppm_dropdown_options WHERE ${conditions.join(" AND ")} ORDER BY category, sort_order`,
        params
      );

      return res.status(200).send(new ServerResponse(true, result.rows));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to fetch dropdown options"));
    }
  }

  /**
   * POST /ppm/api/dropdown-options
   * Body: { category, label, color?, sort_order? }
   */
  public static async create(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { category, label, color, sort_order } = req.body;
      if (!category || !label) {
        return res.status(400).send(new ServerResponse(false, null, "category and label are required"));
      }

      const result = await db.query(
        `INSERT INTO ppm_dropdown_options (category, label, color, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [category, label, color || null, sort_order ?? 0]
      );

      return res.status(201).send(new ServerResponse(true, result.rows[0]));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to create dropdown option"));
    }
  }

  /**
   * PUT /ppm/api/dropdown-options/:id
   */
  public static async update(req: IPpmRequest, res: Response): Promise<Response> {
    try {
      const { label, color, sort_order, is_active } = req.body;
      const setClauses: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (label !== undefined) { setClauses.push(`label = $${idx++}`); params.push(label); }
      if (color !== undefined) { setClauses.push(`color = $${idx++}`); params.push(color); }
      if (sort_order !== undefined) { setClauses.push(`sort_order = $${idx++}`); params.push(sort_order); }
      if (is_active !== undefined) { setClauses.push(`is_active = $${idx++}`); params.push(is_active); }

      if (!setClauses.length) {
        return res.status(400).send(new ServerResponse(false, null, "No fields to update"));
      }

      params.push(req.params.id);
      const result = await db.query(
        `UPDATE ppm_dropdown_options SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        params
      );

      const [data] = result.rows;
      if (!data) {
        return res.status(404).send(new ServerResponse(false, null, "Dropdown option not found"));
      }
      return res.status(200).send(new ServerResponse(true, data));
    } catch (error: any) {
      log_error(error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to update dropdown option"));
    }
  }
}
