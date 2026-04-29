import { NextFunction, Response } from "express";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * Middleware for client portal routes.
 * Reads the PPM client session from the Express session store.
 * Sets req.ppmClient and configures the RLS session variable.
 */
export function ppmClientAuth(req: IPpmRequest, res: Response, next: NextFunction): void {
  const session = req.session as any;
  if (!session?.ppmClient) {
    res.status(401).json({ done: false, body: null, message: "Client authentication required" });
    return;
  }

  req.ppmClient = session.ppmClient;
  next();
}

/**
 * Middleware that requires a specific client role (or higher).
 * Role hierarchy: admin > reviewer > viewer
 */
export function ppmRequireRole(...allowedRoles: string[]) {
  return (req: IPpmRequest, res: Response, next: NextFunction): void => {
    if (!req.ppmClient) {
      res.status(401).json({ done: false, body: null, message: "Client authentication required" });
      return;
    }
    if (!allowedRoles.includes(req.ppmClient.role)) {
      res.status(403).json({ done: false, body: null, message: "Insufficient permissions" });
      return;
    }
    next();
  };
}
