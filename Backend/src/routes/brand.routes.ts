import { Router } from "express";
import { z } from "zod";
import { requirePermissions } from "../middleware/require-permissions.js";
import type { BrandService } from "../modules/brand/brand.service.js";
import { asyncHandler, parseInput, success } from "../utils/http.js";
import { paginationSchema } from "../utils/pagination.js";

const idSchema = z.uuid();
const brandInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  description: z.string().trim().max(2_000).nullable().optional(),
  logoId: z.uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
const brandQuerySchema = paginationSchema.extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export function createBrandRouter(service: BrandService): Router {
  const router = Router();

  router.get(
    "/",
    requirePermissions("brand:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.list(parseInput(brandQuerySchema, request.query)));
    }),
  );
  router.post(
    "/",
    requirePermissions("brand:create"),
    asyncHandler(async (request, response) => {
      success(response, await service.create(parseInput(brandInputSchema, request.body)), 201);
    }),
  );
  router.get(
    "/:id",
    requirePermissions("brand:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.get(parseInput(idSchema, request.params.id)));
    }),
  );
  router.patch(
    "/:id",
    requirePermissions("brand:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.update(
          parseInput(idSchema, request.params.id),
          parseInput(brandInputSchema, request.body),
        ),
      );
    }),
  );
  router.delete(
    "/:id",
    requirePermissions("brand:delete"),
    asyncHandler(async (request, response) => {
      await service.delete(parseInput(idSchema, request.params.id));
      success(response, { deleted: true });
    }),
  );

  return router;
}
