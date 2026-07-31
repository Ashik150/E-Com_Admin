import { Router } from "express";

export function createProtectedAuthRouter(): Router {
  const router = Router();

  router.get("/session", (request, response) => {
    response.json({
      success: true,
      data: request.user,
    });
  });

  return router;
}
