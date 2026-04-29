import express from "express";
import PpmAuthController from "../controllers/ppm-auth-controller";
import { ppmClientAuth } from "../middleware/ppm-client-auth";
import safeControllerFunction from "../../shared/safe-controller-function";

const router = express.Router();

// POST /ppm/api/auth/magic-link — Request a magic link (no auth required)
router.post("/magic-link", safeControllerFunction(PpmAuthController.requestMagicLink));

// GET /ppm/api/auth/verify?token=... — Verify magic link and create session
router.get("/verify", safeControllerFunction(PpmAuthController.verifyMagicLink));

// GET /ppm/api/auth/me — Get current client session (requires client auth)
router.get("/me", ppmClientAuth, safeControllerFunction(PpmAuthController.me));

// POST /ppm/api/auth/logout — Destroy client session
router.post("/logout", safeControllerFunction(PpmAuthController.logout));

export default router;
