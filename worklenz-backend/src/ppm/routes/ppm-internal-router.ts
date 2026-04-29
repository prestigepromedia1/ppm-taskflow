import express from "express";
import PpmDeliverablesController from "../controllers/ppm-deliverables-controller";
import PpmClientsController from "../controllers/ppm-clients-controller";
import PpmClientUsersController from "../controllers/ppm-client-users-controller";
import PpmRetainersController from "../controllers/ppm-retainers-controller";
import PpmBotController from "../controllers/ppm-bot-controller";
import PpmDropdownOptionsController from "../controllers/ppm-dropdown-options-controller";
import { ppmTimeIncrement } from "../middleware/ppm-time-increment";
import TaskWorklogController from "../../controllers/task-work-log-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const router = express.Router();

// ── Deliverables ──
router.get("/deliverables", safeControllerFunction(PpmDeliverablesController.list));
router.get("/deliverables/:id", safeControllerFunction(PpmDeliverablesController.getById));
router.post("/deliverables", safeControllerFunction(PpmDeliverablesController.create));
router.put("/deliverables/:id", safeControllerFunction(PpmDeliverablesController.update));
router.patch("/deliverables/:id/status", safeControllerFunction(PpmDeliverablesController.updateStatus));
router.delete("/deliverables/:id", safeControllerFunction(PpmDeliverablesController.deleteById));

// ── Clients ──
router.get("/clients", safeControllerFunction(PpmClientsController.list));
router.get("/clients/:id", safeControllerFunction(PpmClientsController.getById));
router.post("/clients", safeControllerFunction(PpmClientsController.create));
router.put("/clients/:id", safeControllerFunction(PpmClientsController.update));

// ── Client Users ──
router.get("/client-users", safeControllerFunction(PpmClientUsersController.list));
router.post("/client-users", safeControllerFunction(PpmClientUsersController.invite));
router.put("/client-users/:id", safeControllerFunction(PpmClientUsersController.update));
router.delete("/client-users/:id", safeControllerFunction(PpmClientUsersController.deactivate));

// ── Retainers ──
router.get("/retainers", safeControllerFunction(PpmRetainersController.list));
router.get("/retainers/:id", safeControllerFunction(PpmRetainersController.getById));
router.post("/retainers", safeControllerFunction(PpmRetainersController.create));
router.put("/retainers/:id", safeControllerFunction(PpmRetainersController.update));
router.delete("/retainers/:id", safeControllerFunction(PpmRetainersController.deleteById));

// ── Dropdown Options (admin-managed) ──
router.get("/dropdown-options", safeControllerFunction(PpmDropdownOptionsController.list));
router.post("/dropdown-options", safeControllerFunction(PpmDropdownOptionsController.create));
router.put("/dropdown-options/:id", safeControllerFunction(PpmDropdownOptionsController.update));

// ── PPMBot Task Creation ──
router.post("/bot/tasks", safeControllerFunction(PpmBotController.createTask));

// ── Time Log Wrapper (15-min increment validation) ──
// Rounds to 15-min increments then delegates to Worklenz's TaskWorklogController.create
router.post("/time-log", ppmTimeIncrement, safeControllerFunction(TaskWorklogController.create));

export default router;
