import express from "express";
import botAuthMiddleware from "../middlewares/bot-auth-middleware";
import BotTasksController from "../controllers/bot-tasks-controller";

const botTasksApiRouter = express.Router();

// All bot routes require service account JWT auth
botTasksApiRouter.use(botAuthMiddleware);

botTasksApiRouter.post("/tasks", BotTasksController.create);

// PPM forward-mirror: create a deliverable + linked task atomically, idempotent
// on external_ref.monday_item_id. Used by the Monday -> taskflow forward-mirror.
botTasksApiRouter.post("/deliverables", BotTasksController.createDeliverable);

export default botTasksApiRouter;
