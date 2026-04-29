import { Request } from "express";
import { IPassportSession } from "../../interfaces/passport-session";

/** Session data for a client portal user (set by ppmClientAuth middleware). */
export interface IPpmClientSession {
  client_user_id: string;
  email: string;
  client_id: string;
  role: "viewer" | "reviewer" | "admin";
}

/**
 * Extends the standard Worklenz request with optional PPM client session.
 * - req.user is set by Passport (internal Worklenz users)
 * - req.ppmClient is set by ppmClientAuth middleware (client portal users)
 */
export interface IPpmRequest extends Request {
  user?: IPassportSession;
  ppmClient?: IPpmClientSession;
}
