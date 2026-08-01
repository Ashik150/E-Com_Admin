import type { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClient } from "../../database/prisma.js";
import { ApiError } from "../../errors/api-error.js";
import { paginationMeta } from "../../utils/pagination.js";

export interface ProductMediaInput {
  mediaId: string;
  isThumbnail: boolean;
  isGallery: boolean;
  sortOrder: number;
}

export interface ProductVariantInput {
  sku: string;
  price: number;
  salePrice?: number | null;
  stock: number;
  lowStockThreshold: number;
  weight?: number | null;
  active: boolean;
  purchasable: boolean;
  attributeValueIds: string[];
  media: ProductMediaInput[];
}

export interface ProductInput {
  name: string;
  slug: string;
  sku?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  hasVariants: boolean;
  price?: number | null;
  salePrice?: number | null;
  stock?: number | null;
  weight?: number | null;
  active: boolean;
  featured: boolean;
  sortOrder: number;
  brandId?: string | null;
  categoryIds: string[];
  media: ProductMediaInput[];
  variants: ProductVariantInput[];
  attributeValueMedia: Array<{
    attributeValueId: string;
    mediaId: string;
    sortOrder: number;
  }>;
}

type NormalizedProduct = ReturnType<ProductService["normalizeInput"]>;

const mediaSelect = {
  id: true,
  fileName: true,
  publicUrl: true,
  thumbnailUrl: true,
  altText: true,
  title: true,
  type: true,
} as const;

const fullInclude = {
  brand: true,
  categories: { include: { category: true } },
  media: {
    orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
    include: { media: { select: mediaSelect } },
  },
  variants: {
    orderBy: { createdAt: "asc" },
    include: {
      values: {
        orderBy: { attributeId: "asc" },
        include: {
          attribute: true,
          attributeValue: {
            include: {
              image: { select: mediaSelect },
              media: {
                orderBy: { sortOrder: "asc" as const },
                include: { media: { select: mediaSelect } },
              },
            },
          },
        },
      },
      media: {
        orderBy: [{ sortOrder: "asc" }, { mediaId: "asc" }],
        include: { media: { select: mediaSelect } },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export class ProductService {
  constructor(private readonly database: DatabaseClient) {}

  async list(input: {
    page: number;
    limit: number;
    search: string;
    brandId?: string;
    categoryId?: string;
    active?: boolean;
    sortBy: "name" | "createdAt" | "sortOrder" | "price";
    sortOrder: "asc" | "desc";
  }): Promise<object> {
    const where: Prisma.ProductWhereInput = {
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.categoryId
        ? { categories: { some: { categoryId: input.categoryId } } }
        : {}),
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { sku: { contains: input.search, mode: "insensitive" } },
              {
                variants: {
                  some: { sku: { contains: input.search, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [input.sortBy]: input.sortOrder,
    };
    const [products, total] = await this.database.$transaction([
      this.database.product.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          brand: { select: { id: true, name: true } },
          categories: { include: { category: { select: { id: true, name: true } } } },
          media: {
            where: { isThumbnail: true },
            take: 1,
            include: { media: { select: mediaSelect } },
          },
          variants: {
            select: { price: true, salePrice: true, stock: true, stockStatus: true },
          },
        },
      }),
      this.database.product.count({ where }),
    ]);

    return {
      items: products.map((product) => {
        const prices = product.hasVariants
          ? product.variants.map((variant) => Number(variant.price))
          : [Number(product.price)];
        const stock = product.hasVariants
          ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
          : (product.stock ?? 0);
        return {
          ...product,
          categories: product.categories.map((link) => link.category),
          thumbnail: product.media[0]?.media ?? null,
          variants: undefined,
          media: undefined,
          priceMin: Math.min(...prices),
          priceMax: Math.max(...prices),
          stock,
          stockStatus: deriveStockStatus(stock, 0),
        };
      }),
      pagination: paginationMeta(input.page, input.limit, total),
    };
  }

  async get(id: string): Promise<object> {
    const product = await this.database.product.findUnique({
      where: { id },
      include: fullInclude,
    });
    if (!product) throw ApiError.notFound("Product not found");
    return this.serializeFull(product);
  }

  async formOptions(): Promise<object> {
    const [brands, categories, attributes] = await Promise.all([
      this.database.brand.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      this.database.category.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, parentId: true },
      }),
      this.database.attribute.findMany({
        orderBy: { name: "asc" },
        include: {
          values: {
            orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
            include: {
              image: { select: mediaSelect },
              media: {
                orderBy: { sortOrder: "asc" },
                include: { media: { select: mediaSelect } },
              },
            },
          },
        },
      }),
    ]);
    return {
      brands,
      categories,
      attributes: attributes.map((attribute) => ({
        ...attribute,
        values: attribute.values.map((value) => ({
          ...value,
          media: value.media.map((link) => link.media),
        })),
      })),
    };
  }

  async create(input: ProductInput): Promise<object> {
    const normalized = this.normalizeInput(input);
    const id = await this.runTransaction(async (transaction) => {
      const validated = await this.validate(transaction, normalized);
      const product = await transaction.product.create({
        data: this.productData(normalized),
        select: { id: true },
      });
      await this.createRelations(transaction, product.id, normalized, validated);
      return product.id;
    });
    return this.get(id);
  }

  async update(id: string, input: ProductInput): Promise<object> {
    const normalized = this.normalizeInput(input);
    await this.runTransaction(async (transaction) => {
      const current = await transaction.product.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!current) throw ApiError.notFound("Product not found");
      const validated = await this.validate(transaction, normalized, id);
      await transaction.productVariant.deleteMany({ where: { productId: id } });
      await transaction.productMedia.deleteMany({ where: { productId: id } });
      await transaction.productCategory.deleteMany({ where: { productId: id } });
      await transaction.product.update({
        where: { id },
        data: this.productData(normalized),
      });
      await this.createRelations(transaction, id, normalized, validated);
    });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const product = await this.database.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) throw ApiError.notFound("Product not found");
    await this.database.product.delete({ where: { id } });
  }

  private async validate(
    transaction: Prisma.TransactionClient,
    input: NormalizedProduct,
    excludeId?: string,
  ) {
    const details: Record<string, string[]> = {};
    const add = (field: string, message: string) => {
      details[field] = [...(details[field] ?? []), message];
    };

    if (input.hasVariants) {
      if (input.sku !== null || input.price !== null || input.salePrice !== null || input.stock !== null) {
        add("hasVariants", "Variable products cannot have product-level SKU, price, sale price, or stock");
      }
      if (input.variants.length === 0) add("variants", "Variable products need at least one variant");
    } else {
      if (!input.sku) add("sku", "A simple product SKU is required");
      if (input.price === null) add("price", "A simple product price is required");
      if (input.stock === null) add("stock", "A simple product stock count is required");
      if (input.variants.length > 0) add("variants", "Simple products cannot contain variants");
    }
    if (input.price !== null && input.price < 0) add("price", "Price cannot be negative");
    if (input.salePrice !== null && input.salePrice < 0) add("salePrice", "Sale price cannot be negative");
    if (input.salePrice !== null && input.price !== null && input.salePrice > input.price) add("salePrice", "Sale price cannot exceed price");
    if (input.stock !== null && input.stock < 0) add("stock", "Stock cannot be negative");
    if (input.weight !== null && input.weight < 0) add("weight", "Weight cannot be negative");
    if (input.sortOrder < 0) add("sortOrder", "Sort order cannot be negative");

    const duplicateSlug = await transaction.product.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        slug: input.slug,
      },
      select: { id: true },
    });
    if (duplicateSlug) add("slug", "A product with this slug already exists");
    if (input.sku) {
      const duplicateSku = await transaction.product.findFirst({
        where: { ...(excludeId ? { id: { not: excludeId } } : {}), sku: input.sku },
        select: { id: true },
      });
      if (duplicateSku) add("sku", "A product with this SKU already exists");
    }

    const variantSkus = input.variants.map((variant) => variant.sku);
    if (new Set(variantSkus).size !== variantSkus.length) add("variants", "Variant SKUs must be unique");
    if (input.sku && variantSkus.includes(input.sku)) add("sku", "Product and variant SKUs cannot match");
    if (variantSkus.length > 0) {
      const conflictingVariants = await transaction.productVariant.findFirst({
        where: {
          sku: { in: variantSkus },
          ...(excludeId ? { productId: { not: excludeId } } : {}),
        },
        select: { sku: true },
      });
      if (conflictingVariants) add("variants", `Variant SKU ${conflictingVariants.sku} already exists`);
      const conflictingProducts = await transaction.product.findFirst({
        where: {
          sku: { in: variantSkus },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { sku: true },
      });
      if (conflictingProducts?.sku) add("variants", `SKU ${conflictingProducts.sku} is already used by a product`);
    }
    if (input.sku) {
      const conflictingVariant = await transaction.productVariant.findFirst({
        where: { sku: input.sku, ...(excludeId ? { productId: { not: excludeId } } : {}) },
        select: { sku: true },
      });
      if (conflictingVariant) add("sku", "This SKU is already used by a variant");
    }

    if (input.brandId) {
      const brand = await transaction.brand.findUnique({ where: { id: input.brandId }, select: { id: true } });
      if (!brand) add("brandId", "Brand does not exist");
    }
    const categoryIds = unique(input.categoryIds);
    if (categoryIds.length !== input.categoryIds.length) add("categoryIds", "A category can only be attached once");
    if (categoryIds.length) {
      const count = await transaction.category.count({ where: { id: { in: categoryIds } } });
      if (count !== categoryIds.length) add("categoryIds", "One or more categories do not exist");
    }

    this.validateMedia(input.media, "media", true, add);
    for (const [index, variant] of input.variants.entries()) {
      if (!variant.sku) add(`variants.${index}.sku`, "Variant SKU is required");
      if (variant.price < 0) add(`variants.${index}.price`, "Price cannot be negative");
      if (variant.salePrice !== null && variant.salePrice < 0) add(`variants.${index}.salePrice`, "Sale price cannot be negative");
      if (variant.salePrice !== null && variant.salePrice > variant.price) add(`variants.${index}.salePrice`, "Sale price cannot exceed price");
      if (variant.stock < 0) add(`variants.${index}.stock`, "Stock cannot be negative");
      if (variant.lowStockThreshold < 0) add(`variants.${index}.lowStockThreshold`, "Low-stock threshold cannot be negative");
      if (variant.weight !== null && variant.weight < 0) add(`variants.${index}.weight`, "Weight cannot be negative");
      if (variant.attributeValueIds.length === 0) add(`variants.${index}.attributeValueIds`, "Choose at least one attribute value");
      if (unique(variant.attributeValueIds).length !== variant.attributeValueIds.length) add(`variants.${index}.attributeValueIds`, "An attribute value can only be used once");
      this.validateMedia(variant.media, `variants.${index}.media`, false, add);
    }

    const allMediaIds = unique([
      ...input.media.map((item) => item.mediaId),
      ...input.variants.flatMap((variant) => variant.media.map((item) => item.mediaId)),
      ...input.attributeValueMedia.map((item) => item.mediaId),
    ]);
    const media = allMediaIds.length
      ? await transaction.mediaAsset.findMany({ where: { id: { in: allMediaIds } }, select: { id: true, type: true } })
      : [];
    if (media.length !== allMediaIds.length) add("media", "One or more media assets do not exist");
    const mediaTypes = new Map(media.map((item) => [item.id, item.type]));
    const productThumbnail = input.media.find((item) => item.isThumbnail);
    if (productThumbnail && mediaTypes.get(productThumbnail.mediaId) !== "IMAGE") add("media", "Product thumbnail must be an image");
    for (const item of input.variants.flatMap((variant) => variant.media)) {
      if (mediaTypes.get(item.mediaId) !== "IMAGE") add("variants", "Variant media must be images");
    }
    for (const item of input.attributeValueMedia) {
      if (mediaTypes.get(item.mediaId) !== "IMAGE") add("attributeValueMedia", "Attribute-value media must be images");
    }

    const valueIds = unique(input.variants.flatMap((variant) => variant.attributeValueIds));
    const values = valueIds.length
      ? await transaction.attributeValue.findMany({
          where: { id: { in: valueIds } },
          select: { id: true, attributeId: true },
        })
      : [];
    if (values.length !== valueIds.length) add("variants", "One or more attribute values do not exist");
    const valueMap = new Map(values.map((value) => [value.id, value.attributeId]));
    const combinations = new Set<string>();
    let expectedAttributes: string | null = null;
    const validatedVariants = input.variants.map((variant, index) => {
      const pairs = variant.attributeValueIds
        .map((valueId) => ({ valueId, attributeId: valueMap.get(valueId) ?? "" }))
        .sort((left, right) => left.attributeId.localeCompare(right.attributeId));
      const attributeIds = pairs.map((pair) => pair.attributeId);
      if (unique(attributeIds).length !== attributeIds.length) add(`variants.${index}.attributeValueIds`, "Choose exactly one value from each attribute");
      const attributeSet = attributeIds.join("|");
      if (expectedAttributes === null) expectedAttributes = attributeSet;
      else if (expectedAttributes !== attributeSet) add(`variants.${index}.attributeValueIds`, "Every variant must use the same set of attributes");
      const combinationKey = pairs.map((pair) => `${pair.attributeId}:${pair.valueId}`).join("|");
      if (combinations.has(combinationKey)) add("variants", "Duplicate attribute-value combination");
      combinations.add(combinationKey);
      return { ...variant, pairs, combinationKey };
    });

    const usedValues = new Set(valueIds);
    const attributeMediaKeys = input.attributeValueMedia.map((item) => `${item.attributeValueId}:${item.mediaId}`);
    if (unique(attributeMediaKeys).length !== attributeMediaKeys.length) add("attributeValueMedia", "The same media cannot be attached twice to a value");
    for (const item of input.attributeValueMedia) {
      if (!usedValues.has(item.attributeValueId)) add("attributeValueMedia", "Media can only be assigned to values used by this product");
    }

    if (Object.keys(details).length) throw ApiError.validation(details);
    return { categoryIds, variants: validatedVariants };
  }

  private validateMedia(
    media: ProductMediaInput[],
    field: string,
    requireThumbnail: boolean,
    add: (field: string, message: string) => void,
  ): void {
    const ids = media.map((item) => item.mediaId);
    if (unique(ids).length !== ids.length) add(field, "The same media asset cannot be attached twice");
    const thumbnailCount = media.filter((item) => item.isThumbnail).length;
    if (requireThumbnail && thumbnailCount !== 1) add(field, "Exactly one product thumbnail is required");
    if (!requireThumbnail && thumbnailCount > 1) add(field, "A variant can have at most one thumbnail");
  }

  private async createRelations(
    transaction: Prisma.TransactionClient,
    productId: string,
    input: NormalizedProduct,
    validated: Awaited<ReturnType<ProductService["validate"]>>,
  ): Promise<void> {
    if (validated.categoryIds.length) {
      await transaction.productCategory.createMany({
        data: validated.categoryIds.map((categoryId) => ({ productId, categoryId })),
      });
    }
    if (input.media.length) {
      await transaction.productMedia.createMany({
        data: input.media.map((item) => ({ productId, ...item })),
      });
    }
    for (const variant of validated.variants) {
      const created = await transaction.productVariant.create({
        data: {
          productId,
          sku: variant.sku,
          combinationKey: variant.combinationKey,
          price: variant.price,
          salePrice: variant.salePrice,
          stock: variant.stock,
          stockStatus: deriveStockStatus(variant.stock, variant.lowStockThreshold),
          lowStockThreshold: variant.lowStockThreshold,
          weight: variant.weight,
          active: variant.active,
          purchasable: variant.purchasable,
        },
        select: { id: true },
      });
      await transaction.productVariantValue.createMany({
        data: variant.pairs.map((pair) => ({
          variantId: created.id,
          attributeId: pair.attributeId,
          attributeValueId: pair.valueId,
        })),
      });
      if (variant.media.length) {
        await transaction.productVariantMedia.createMany({
          data: variant.media.map((item) => ({ variantId: created.id, ...item })),
        });
      }
    }
    for (const item of input.attributeValueMedia) {
      await transaction.attributeValueMedia.upsert({
        where: {
          attributeValueId_mediaId: {
            attributeValueId: item.attributeValueId,
            mediaId: item.mediaId,
          },
        },
        update: { sortOrder: item.sortOrder },
        create: item,
      });
    }
  }

  private productData(input: NormalizedProduct) {
    return {
      name: input.name,
      slug: input.slug,
      sku: input.hasVariants ? null : input.sku,
      shortDescription: input.shortDescription,
      longDescription: input.longDescription,
      hasVariants: input.hasVariants,
      price: input.hasVariants ? null : input.price,
      salePrice: input.hasVariants ? null : input.salePrice,
      stock: input.hasVariants ? null : input.stock,
      stockStatus: input.hasVariants || input.stock === null ? null : deriveStockStatus(input.stock, 0),
      weight: input.weight,
      active: input.active,
      featured: input.featured,
      sortOrder: input.sortOrder,
      brandId: input.brandId,
    };
  }

  private normalizeInput(input: ProductInput) {
    const clean = (value?: string | null) => value?.trim() || null;
    const numberOrNull = (value?: number | null) => value ?? null;
    return {
      ...input,
      name: input.name.trim().replace(/\s+/g, " "),
      slug: input.slug.trim().toLowerCase(),
      sku: clean(input.sku)?.toUpperCase() ?? null,
      shortDescription: clean(input.shortDescription),
      longDescription: clean(input.longDescription),
      price: numberOrNull(input.price),
      salePrice: numberOrNull(input.salePrice),
      stock: numberOrNull(input.stock),
      weight: numberOrNull(input.weight),
      brandId: input.brandId ?? null,
      categoryIds: input.categoryIds,
      media: input.media.map((item) => ({ ...item })),
      variants: input.variants.map((variant) => ({
            ...variant,
            sku: variant.sku.trim().toUpperCase(),
            salePrice: numberOrNull(variant.salePrice),
            weight: numberOrNull(variant.weight),
          })),
      attributeValueMedia: input.attributeValueMedia,
    };
  }

  private serializeFull(product: Prisma.ProductGetPayload<{ include: typeof fullInclude }>) {
    return {
      ...product,
      price: product.price === null ? null : Number(product.price),
      salePrice: product.salePrice === null ? null : Number(product.salePrice),
      weight: product.weight === null ? null : Number(product.weight),
      categories: product.categories.map((link) => link.category),
      media: product.media.map((link) => ({ ...link, asset: link.media, media: undefined })),
      variants: product.variants.map((variant) => ({
        ...variant,
        price: Number(variant.price),
        salePrice: variant.salePrice === null ? null : Number(variant.salePrice),
        weight: variant.weight === null ? null : Number(variant.weight),
        media: variant.media.map((link) => ({ ...link, asset: link.media, media: undefined })),
        values: variant.values.map((link) => ({
          id: link.attributeValue.id,
          attributeId: link.attributeId,
          attribute: link.attribute,
          value: link.attributeValue.value,
          slug: link.attributeValue.slug,
          colorValue: link.attributeValue.colorValue,
          image: link.attributeValue.image,
          media: link.attributeValue.media.map((mediaLink) => mediaLink.media),
        })),
      })),
    };
  }

  private async runTransaction<T>(work: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.database.$transaction(work, {
          isolationLevel: "Serializable",
          maxWait: 5_000,
          timeout: 20_000,
        });
      } catch (error) {
        if (attempt < 3 && typeof error === "object" && error !== null && "code" in error && error.code === "P2034") continue;
        throw error;
      }
    }
    throw new Error("Transaction retry limit reached");
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function deriveStockStatus(stock: number, lowStockThreshold: number): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (stock === 0) return "OUT_OF_STOCK";
  if (lowStockThreshold > 0 && stock <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}
