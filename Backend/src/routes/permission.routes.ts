import { Router } from "express";
import { z } from "zod";
import { requirePermissions } from "../middleware/require-permissions.js";
import type { PermissionService } from "../modules/permission/permission.service.js";
import { asyncHandler, parseInput, success } from "../utils/http.js";
import { paginationSchema } from "../utils/pagination.js";

const idSchema = z.uuid();
const groupInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).nullable().optional(),
  actions: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
});

export function createPermissionRouter(service: PermissionService): Router {
  const router = Router();

  router.get(
    "/",
    requirePermissions("permission:read"),
    asyncHandler(async (request, response) => {
      const query = parseInput(paginationSchema, request.query);
      success(response, await service.list(query));
    }),
  );
  router.post(
    "/",
    requirePermissions("permission:create"),
    asyncHandler(async (request, response) => {
      const input = parseInput(groupInputSchema, request.body);
      success(response, await service.create(input), 201);
    }),
  );
  router.delete(
    "/actions/:permissionId",
    requirePermissions("permission:delete"),
    asyncHandler(async (request, response) => {
      const permissionId = parseInput(idSchema, request.params.permissionId);
      await service.deletePermission(permissionId);
      success(response, { deleted: true });
    }),
  );
  router.get(
    "/:id",
    requirePermissions("permission:read"),
    asyncHandler(async (request, response) => {
      const id = parseInput(idSchema, request.params.id);
      success(response, await service.get(id));
    }),
  );
  router.patch(
    "/:id",
    requirePermissions("permission:update"),
    asyncHandler(async (request, response) => {
      const id = parseInput(idSchema, request.params.id);
      const input = parseInput(groupInputSchema, request.body);
      success(response, await service.update(id, input));
    }),
  );
  router.delete(
    "/:id",
    requirePermissions("permission:delete"),
    asyncHandler(async (request, response) => {
      const id = parseInput(idSchema, request.params.id);
      await service.deleteGroup(id);
      success(response, { deleted: true });
    }),
  );

  return router;
}
