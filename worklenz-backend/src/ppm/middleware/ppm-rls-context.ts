import db from "../../config/db";
import { NextFunction, Response } from "express";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * Sets the PostgreSQL session variable `ppm.current_client_id` for RLS isolation.
 * Must run AFTER ppmClientAuth so req.ppmClient is populated.
 *
 * This uses a dedicated connection from the pool for the duration of the request,
 * ensuring the session variable is isolated per-request.
 */
export async function ppmSetRlsContext(req: IPpmRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.ppmClient?.client_id) {
    res.status(401).json({ done: false, body: null, message: "Client context required" });
    return;
  }

  try {
    // Get a dedicated connection for this request
    const client = await db.pool.connect();

    // Set the RLS session variable on this dedicated connection.
    // Using SET (not SET LOCAL) since we're not in a transaction — the variable
    // persists for this connection's lifetime, which is scoped to this request.
    await client.query("SET ppm.current_client_id = $1", [req.ppmClient.client_id]);

    // Attach to request so controllers can use this connection
    (req as any).ppmDbClient = client;

    // Release connection when response finishes
    const cleanup = () => {
      client.release();
      res.removeListener("finish", cleanup);
      res.removeListener("close", cleanup);
    };
    res.on("finish", cleanup);
    res.on("close", cleanup);

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to get the RLS-scoped DB client from a request.
 * Returns a {query} interface compatible with both PoolClient and the db module.
 * Falls back to the shared pool for internal (non-client) requests.
 */
export function getPpmDbClient(req: IPpmRequest): { query: (text: string, params?: unknown[]) => Promise<any> } {
  return (req as any).ppmDbClient || db;
}
