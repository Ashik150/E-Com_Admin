import { Router } from "express";
import { z } from "zod";
import { requirePermissions } from "../middleware/require-permissions.js";
import type { UserService } from "../modules/user/user.service.js";
import { asyncHandler, parseInput, success } from "../utils/http.js";
import { paginationSchema } from "../utils/pagination.js";

const idSchema = z.uuid();
const genderSchema = z.enum([
  "MALE",
  "FEMALE",
  "OTHER",
  "PREFER_NOT_TO_SAY",
]);
const nullableUrl = z.union([z.url(), z.literal(""), z.null()]).optional();
const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  password: z.string().min(8).max(128),
  phone: z.string().trim().max(30).nullable().optional(),
  gender: genderSchema.nullable().optional(),
  avatarUrl: nullableUrl,
  roleId: z.uuid(),
  active: z.boolean(),
});
const updateUserSchema = createUserSchema
  .partial()
  .extend({ password: z.union([z.string().min(8).max(128), z.literal("")]).optional() })
  .transform((input) => ({
    ...input,
    ...(input.password === "" ? { password: undefined } : {}),
    ...(input.avatarUrl === "" ? { avatarUrl: null } : {}),
  }));
const userQuerySchema = paginationSchema.extend({
  roleId: z.uuid().optional(),
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export function createUserRouter(service: UserService): Router {
  const router = Router();

  router.get(
    "/",
    requirePermissions("user:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.list(parseInput(userQuerySchema, request.query)));
    }),
  );
  router.post(
    "/",
    requirePermissions("user:create"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.create(parseInput(createUserSchema, request.body)),
        201,
      );
    }),
  );
  router.get(
    "/role-options",
    requirePermissions("user:read"),
    asyncHandler(async (_request, response) => {
      success(response, await service.roleOptions());
    }),
  );
  router.get(
    "/:id",
    requirePermissions("user:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.get(parseInput(idSchema, request.params.id)));
    }),
  );
  router.patch(
    "/:id",
    requirePermissions("user:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.update(
          parseInput(idSchema, request.params.id),
          request.user!.id,
          parseInput(updateUserSchema, request.body),
        ),
      );
    }),
  );
  router.delete(
    "/:id",
    requirePermissions("user:delete"),
    asyncHandler(async (request, response) => {
      await service.delete(
        parseInput(idSchema, request.params.id),
        request.user!.id,
      );
      success(response, { deleted: true });
    }),
  );

  return router;
}
