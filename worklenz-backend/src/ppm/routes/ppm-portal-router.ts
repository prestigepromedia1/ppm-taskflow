import express from "express";
import PpmDeliverablesController from "../controllers/ppm-deliverables-controller";
import { ppmClientAuth, ppmRequireRole } from "../middleware/ppm-client-auth";
import { ppmSetRlsContext } from "../middleware/ppm-rls-context";
import safeControllerFunction from "../../shared/safe-controller-function";

const router = express.Router();

// All portal routes require client auth + RLS context
router.use(ppmClientAuth, ppmSetRlsContext);

// GET /ppm/api/portal/deliverables — List client's deliverables (RLS-scoped)
router.get("/deliverables", safeControllerFunction(PpmDeliverablesController.clientList));

// GET /ppm/api/portal/deliverables/:id — Get single deliverable
router.get("/deliverables/:id", safeControllerFunction(PpmDeliverablesController.clientGetById));

// PATCH /ppm/api/portal/deliverables/:id/status — Approve/reject (reviewer or admin only)
router.patch("/deliverables/:id/status",
  ppmRequireRole("reviewer", "admin"),
  safeControllerFunction(PpmDeliverablesController.updateStatus)
);

export default router;
