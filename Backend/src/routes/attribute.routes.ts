import { Router } from "express";
import { z } from "zod";
import { requirePermissions } from "../middleware/require-permissions.js";
import type { AttributeService } from "../modules/attribute/attribute.service.js";
import { asyncHandler, parseInput, success } from "../utils/http.js";
import { paginationSchema } from "../utils/pagination.js";

const idSchema = z.uuid();
const attributeTypeSchema = z.enum([
  "DROPDOWN",
  "RADIO",
  "CHECKBOX",
  "COLOR_SWATCH",
  "IMAGE_SWATCH",
]);
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");
const attributeInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.min(2),
  type: attributeTypeSchema,
});
const valueInputSchema = z.object({
  value: z.string().trim().min(1).max(120),
  slug: slugSchema,
  colorValue: z.string().trim().max(20).nullable().optional(),
  imageId: z.uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(1_000_000),
});
const attributeQuerySchema = paginationSchema.extend({
  type: attributeTypeSchema.optional(),
});

export function createAttributeRouter(service: AttributeService): Router {
  const router = Router();

  router.get(
    "/",
    requirePermissions("attribute:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.list(parseInput(attributeQuerySchema, request.query)));
    }),
  );
  router.post(
    "/",
    requirePermissions("attribute:create"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.create(parseInput(attributeInputSchema, request.body)),
        201,
      );
    }),
  );
  router.get(
    "/:id",
    requirePermissions("attribute:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.get(parseInput(idSchema, request.params.id)));
    }),
  );
  router.patch(
    "/:id",
    requirePermissions("attribute:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.update(
          parseInput(idSchema, request.params.id),
          parseInput(attributeInputSchema, request.body),
        ),
      );
    }),
  );
  router.delete(
    "/:id",
    requirePermissions("attribute:delete"),
    asyncHandler(async (request, response) => {
      await service.delete(parseInput(idSchema, request.params.id));
      success(response, { deleted: true });
    }),
  );
  router.post(
    "/:id/values",
    requirePermissions("attribute:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.createValue(
          parseInput(idSchema, request.params.id),
          parseInput(valueInputSchema, request.body),
        ),
        201,
      );
    }),
  );
  router.patch(
    "/:id/values/:valueId",
    requirePermissions("attribute:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.updateValue(
          parseInput(idSchema, request.params.id),
          parseInput(idSchema, request.params.valueId),
          parseInput(valueInputSchema, request.body),
        ),
      );
    }),
  );
  router.delete(
    "/:id/values/:valueId",
    requirePermissions("attribute:update"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.deleteValue(
          parseInput(idSchema, request.params.id),
          parseInput(idSchema, request.params.valueId),
        ),
      );
    }),
  );

  return router;
}
