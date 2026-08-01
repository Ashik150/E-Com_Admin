import { Router } from "express";
import { z } from "zod";
import { requirePermissions } from "../middleware/require-permissions.js";
import type { ProductService } from "../modules/product/product.service.js";
import { asyncHandler, parseInput, success } from "../utils/http.js";
import { paginationSchema } from "../utils/pagination.js";

const idSchema = z.uuid();
const optionalMoney = z.number().finite().min(0).max(999_999_999.99).nullable().optional();
const optionalWeight = z.number().finite().min(0).max(9_999_999.999).nullable().optional();
const mediaSchema = z.object({
  mediaId: z.uuid(),
  isThumbnail: z.boolean(),
  isGallery: z.boolean(),
  sortOrder: z.number().int().min(0).max(1_000_000),
});
const variantSchema = z.object({
  sku: z.string().trim().min(1).max(100),
  price: z.number().finite().min(0).max(999_999_999.99),
  salePrice: optionalMoney,
  stock: z.number().int().min(0).max(2_147_483_647),
  lowStockThreshold: z.number().int().min(0).max(2_147_483_647),
  weight: optionalWeight,
  active: z.boolean(),
  purchasable: z.boolean(),
  attributeValueIds: z.array(z.uuid()).min(1).max(20),
  media: z.array(mediaSchema).max(100),
});
const productInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  sku: z.string().trim().min(1).max(100).nullable().optional(),
  shortDescription: z.string().trim().max(1_000).nullable().optional(),
  longDescription: z.string().trim().max(20_000).nullable().optional(),
  hasVariants: z.boolean(),
  price: optionalMoney,
  salePrice: optionalMoney,
  stock: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
  weight: optionalWeight,
  active: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(1_000_000),
  brandId: z.uuid().nullable().optional(),
  categoryIds: z.array(z.uuid()).max(100),
  media: z.array(mediaSchema).min(1).max(100),
  variants: z.array(variantSchema).max(5_000),
  attributeValueMedia: z.array(z.object({
    attributeValueId: z.uuid(),
    mediaId: z.uuid(),
    sortOrder: z.number().int().min(0).max(1_000_000),
  })).max(2_000),
});
const productQuerySchema = paginationSchema.extend({
  brandId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sortBy: z.enum(["name", "createdAt", "sortOrder", "price"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export function createProductRouter(service: ProductService): Router {
  const router = Router();

  router.get("/", requirePermissions("product:read"), asyncHandler(async (request, response) => {
    success(response, await service.list(parseInput(productQuerySchema, request.query)));
  }));
  router.get("/form-options", requirePermissions("product:read"), asyncHandler(async (_request, response) => {
    success(response, await service.formOptions());
  }));
  router.post("/", requirePermissions("product:create"), asyncHandler(async (request, response) => {
    success(response, await service.create(parseInput(productInputSchema, request.body)), 201);
  }));
  router.get("/:id", requirePermissions("product:read"), asyncHandler(async (request, response) => {
    success(response, await service.get(parseInput(idSchema, request.params.id)));
  }));
  router.patch("/:id", requirePermissions("product:update"), asyncHandler(async (request, response) => {
    success(response, await service.update(parseInput(idSchema, request.params.id), parseInput(productInputSchema, request.body)));
  }));
  router.delete("/:id", requirePermissions("product:delete"), asyncHandler(async (request, response) => {
    await service.delete(parseInput(idSchema, request.params.id));
    success(response, { deleted: true });
  }));

  return router;
}
