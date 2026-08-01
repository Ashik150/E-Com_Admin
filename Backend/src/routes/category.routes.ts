import { Router } from "express";
import { z } from "zod";
import { requirePermissions } from "../middleware/require-permissions.js";
import type { CategoryService } from "../modules/category/category.service.js";
import { asyncHandler, parseInput, success } from "../utils/http.js";
import { paginationSchema } from "../utils/pagination.js";

const idSchema = z.uuid();
const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  description: z.string().trim().max(2_000).nullable().optional(),
  imageId: z.uuid().nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(1_000_000),
});
const categoryFilterSchema = z.object({
  search: z.string().trim().max(100).default(""),
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});
const categoryListSchema = paginationSchema.extend({
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

export function createCategoryRouter(service: CategoryService): Router {
  const router = Router();

  router.get(
    "/",
    requirePermissions("category:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.list(parseInput(categoryListSchema, request.query)));
    }),
  );
  router.get(
    "/tree",
    requirePermissions("category:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.tree(parseInput(categoryFilterSchema, request.query)));
    }),
  );
  router.post(
    "/",
    requirePermissions("category:create"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.create(parseInput(categoryInputSchema, request.body)),
        201,
      );
    }),
  );
  router.get(
    "/:id",
    requirePermissions("category:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.get(parseInput(idSchema, request.params.id)));
    }),
  );
  router.patch(
    "/:id",
    requirePermissions("category:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.update(
          parseInput(idSchema, request.params.id),
          parseInput(categoryInputSchema, request.body),
        ),
      );
    }),
  );
  router.delete(
    "/:id",
    requirePermissions("category:delete"),
    asyncHandler(async (request, response) => {
      await service.delete(parseInput(idSchema, request.params.id));
      success(response, { deleted: true });
    }),
  );

  return router;
}
