import { Router } from "express";
import { requirePermissions } from "../middleware/require-permissions.js";

export function createDashboardRouter(): Router {
  const router = Router();

  router.get(
    "/",
    requirePermissions("dashboard:watch"),
    (request, response) => {
      response.json({
        success: true,
        data: {
          message: "Dashboard access granted",
          user: request.user,
        },
      });
    },
  );

  return router;
}
