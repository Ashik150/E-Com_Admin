import { Router } from "express";
import { z } from "zod";
import { requirePermissions } from "../middleware/require-permissions.js";
import type { RoleService } from "../modules/role/role.service.js";
import { asyncHandler, parseInput, success } from "../utils/http.js";
import { paginationSchema } from "../utils/pagination.js";

const idSchema = z.uuid();
const roleInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  permissionIds: z.array(z.uuid()).max(500),
});
const roleQuerySchema = paginationSchema.extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export function createRoleRouter(service: RoleService): Router {
  const router = Router();

  router.get(
    "/",
    requirePermissions("role:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.list(parseInput(roleQuerySchema, request.query)));
    }),
  );
  router.get(
    "/options",
    requirePermissions("role:read"),
    asyncHandler(async (_request, response) => {
      success(response, await service.options());
    }),
  );
  router.post(
    "/",
    requirePermissions("role:create"),
    asyncHandler(async (request, response) => {
      success(response, await service.create(parseInput(roleInputSchema, request.body)), 201);
    }),
  );
  router.get(
    "/:id",
    requirePermissions("role:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.get(parseInput(idSchema, request.params.id)));
    }),
  );
  router.patch(
    "/:id",
    requirePermissions("role:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.update(
          parseInput(idSchema, request.params.id),
          parseInput(roleInputSchema, request.body),
          request.user!.role.id,
        ),
      );
    }),
  );
  router.post(
    "/:id/grant-all",
    requirePermissions("role:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.grantAll(
          parseInput(idSchema, request.params.id),
          request.user!.role.id,
        ),
      );
    }),
  );
  router.post(
    "/:id/permissions/:permissionId",
    requirePermissions("role:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.addPermission(
          parseInput(idSchema, request.params.id),
          parseInput(idSchema, request.params.permissionId),
          request.user!.role.id,
        ),
      );
    }),
  );
  router.delete(
    "/:id/permissions/:permissionId",
    requirePermissions("role:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.removePermission(
          parseInput(idSchema, request.params.id),
          parseInput(idSchema, request.params.permissionId),
          request.user!.role.id,
        ),
      );
    }),
  );
  router.delete(
    "/:id",
    requirePermissions("role:delete"),
    asyncHandler(async (request, response) => {
      await service.delete(
        parseInput(idSchema, request.params.id),
        request.user!.role.id,
      );
      success(response, { deleted: true });
    }),
  );

  return router;
}
