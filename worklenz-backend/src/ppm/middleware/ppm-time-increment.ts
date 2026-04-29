import { NextFunction, Response } from "express";
import { IPpmRequest } from "../interfaces/ppm-request";

/**
 * Validates and rounds time log entries to 15-minute (900 second) increments.
 * Proven in spike 004: CEIL(seconds / 900) * 900.
 *
 * Sits in front of Worklenz's task-work-log controller.
 * Modifies req.body.seconds_spent in place before forwarding.
 */
export function ppmTimeIncrement(req: IPpmRequest, res: Response, next: NextFunction): void {
  const seconds = Number(req.body?.seconds_spent);

  if (isNaN(seconds) || seconds <= 0) {
    res.status(400).json({
      done: false,
      body: null,
      message: "seconds_spent must be a positive number"
    });
    return;
  }

  // Round up to nearest 15-minute increment
  req.body.seconds_spent = Math.ceil(seconds / 900) * 900;

  next();
}
