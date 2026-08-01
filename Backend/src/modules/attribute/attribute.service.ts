import type { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClient } from "../../database/prisma.js";
import { ApiError } from "../../errors/api-error.js";
import { paginationMeta } from "../../utils/pagination.js";

export type AttributeTypeValue =
  | "DROPDOWN"
  | "RADIO"
  | "CHECKBOX"
  | "COLOR_SWATCH"
  | "IMAGE_SWATCH";

export interface AttributeInput {
  name: string;
  slug: string;
  type: AttributeTypeValue;
}

export interface AttributeValueInput {
  value: string;
  slug: string;
  colorValue?: string | null;
  imageId?: string | null;
  sortOrder: number;
}

const valueInclude = {
  image: {
    select: {
      id: true,
      fileName: true,
      publicUrl: true,
      thumbnailUrl: true,
      altText: true,
      title: true,
    },
  },
} as const;

export class AttributeService {
  constructor(private readonly database: DatabaseClient) {}

  async list(input: {
    page: number;
    limit: number;
    search: string;
    type?: AttributeTypeValue;
  }): Promise<object> {
    const where = {
      ...(input.type ? { type: input.type } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { slug: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [attributes, total] = await this.database.$transaction([
      this.database.attribute.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: { _count: { select: { values: true } } },
      }),
      this.database.attribute.count({ where }),
    ]);
    return {
      items: attributes.map(({ _count, ...attribute }) => ({
        ...attribute,
        valueCount: _count.values,
      })),
      pagination: paginationMeta(input.page, input.limit, total),
    };
  }

  async get(id: string): Promise<object> {
    const attribute = await this.database.attribute.findUnique({
      where: { id },
      include: {
        values: {
          orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
          include: valueInclude,
        },
      },
    });
    if (!attribute) throw ApiError.notFound("Attribute not found");
    return attribute;
  }

  async create(input: AttributeInput): Promise<object> {
    const normalized = this.normalizeAttribute(input);
    const attribute = await this.database.$transaction(async (transaction) => {
      await this.ensureAttributeUnique(
        transaction,
        normalized.name,
        normalized.slug,
      );
      return transaction.attribute.create({
        data: normalized,
        select: { id: true },
      });
    });
    return this.get(attribute.id);
  }

  async update(id: string, input: AttributeInput): Promise<object> {
    const normalized = this.normalizeAttribute(input);
    await this.database.$transaction(async (transaction) => {
      const current = await transaction.attribute.findUnique({
        where: { id },
        include: { _count: { select: { values: true } } },
      });
      if (!current) throw ApiError.notFound("Attribute not found");
      if (current.type !== normalized.type && current._count.values > 0) {
        throw ApiError.conflict(
          "Remove existing values before changing the attribute type",
        );
      }
      await this.ensureAttributeUnique(
        transaction,
        normalized.name,
        normalized.slug,
        id,
      );
      await transaction.attribute.update({ where: { id }, data: normalized });
    });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const attribute = await this.database.attribute.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!attribute) throw ApiError.notFound("Attribute not found");
    // Product variant value links use restrictive foreign keys, so an attribute
    // in active use cannot cascade away and corrupt a variant.
    await this.database.attribute.delete({ where: { id } });
  }

  async createValue(
    attributeId: string,
    input: AttributeValueInput,
  ): Promise<object> {
    await this.database.$transaction(async (transaction) => {
      const attribute = await this.getAttributeType(transaction, attributeId);
      const normalized = await this.normalizeAndValidateValue(
        transaction,
        attribute.type,
        input,
      );
      await this.ensureValueUnique(
        transaction,
        attributeId,
        normalized.value,
        normalized.slug,
      );
      await transaction.attributeValue.create({
        data: { ...normalized, attributeId },
      });
    });
    return this.get(attributeId);
  }

  async updateValue(
    attributeId: string,
    valueId: string,
    input: AttributeValueInput,
  ): Promise<object> {
    await this.database.$transaction(async (transaction) => {
      const existing = await transaction.attributeValue.findUnique({
        where: { id: valueId },
        include: { attribute: { select: { id: true, type: true } } },
      });
      if (!existing || existing.attributeId !== attributeId) {
        throw ApiError.notFound("Attribute value not found");
      }
      const normalized = await this.normalizeAndValidateValue(
        transaction,
        existing.attribute.type,
        input,
      );
      await this.ensureValueUnique(
        transaction,
        attributeId,
        normalized.value,
        normalized.slug,
        valueId,
      );
      await transaction.attributeValue.update({
        where: { id: valueId },
        data: normalized,
      });
    });
    return this.get(attributeId);
  }

  async deleteValue(attributeId: string, valueId: string): Promise<object> {
    const existing = await this.database.attributeValue.findUnique({
      where: { id: valueId },
      select: { attributeId: true },
    });
    if (!existing || existing.attributeId !== attributeId) {
      throw ApiError.notFound("Attribute value not found");
    }
    // A future variant reference uses ON DELETE RESTRICT and is surfaced as 409.
    await this.database.attributeValue.delete({ where: { id: valueId } });
    return this.get(attributeId);
  }

  private async getAttributeType(
    transaction: Prisma.TransactionClient,
    id: string,
  ): Promise<{ type: AttributeTypeValue }> {
    const attribute = await transaction.attribute.findUnique({
      where: { id },
      select: { type: true },
    });
    if (!attribute) throw ApiError.notFound("Attribute not found");
    return attribute;
  }

  private async ensureAttributeUnique(
    transaction: Prisma.TransactionClient,
    name: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await transaction.attribute.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          { slug },
        ],
      },
      select: { name: true, slug: true },
    });
    if (!duplicate) return;
    throw ApiError.conflict(
      duplicate.slug === slug
        ? "An attribute with this slug already exists"
        : "An attribute with this name already exists",
    );
  }

  private async ensureValueUnique(
    transaction: Prisma.TransactionClient,
    attributeId: string,
    value: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await transaction.attributeValue.findFirst({
      where: {
        attributeId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { value: { equals: value, mode: "insensitive" } },
          { slug },
        ],
      },
      select: { value: true, slug: true },
    });
    if (!duplicate) return;
    throw ApiError.conflict(
      duplicate.slug === slug
        ? "This attribute already has a value with that slug"
        : "This value already exists in the attribute",
    );
  }

  private async normalizeAndValidateValue(
    transaction: Prisma.TransactionClient,
    type: AttributeTypeValue,
    input: AttributeValueInput,
  ) {
    const value = input.value.trim().replace(/\s+/g, " ");
    const slug = input.slug.trim().toLowerCase();
    const colorValue = input.colorValue?.trim().toUpperCase() || null;
    const imageId = input.imageId ?? null;
    if (type === "COLOR_SWATCH") {
      if (!colorValue || !/^#[0-9A-F]{6}$/.test(colorValue)) {
        throw ApiError.validation({
          colorValue: ["A colour swatch requires a six-digit hex code"],
        });
      }
      if (imageId) {
        throw ApiError.validation({ imageId: ["Colour swatches cannot use an image"] });
      }
    } else if (type === "IMAGE_SWATCH") {
      if (!imageId) {
        throw ApiError.validation({ imageId: ["An image swatch requires an image"] });
      }
      if (colorValue) {
        throw ApiError.validation({
          colorValue: ["Image swatches cannot use a colour reference"],
        });
      }
      const image = await transaction.mediaAsset.findUnique({
        where: { id: imageId },
        select: { type: true },
      });
      if (!image) throw ApiError.notFound("Swatch image not found");
      if (image.type !== "IMAGE") {
        throw ApiError.validation({ imageId: ["Swatch media must be an image"] });
      }
    } else if (colorValue || imageId) {
      throw ApiError.validation({
        reference: ["Only colour and image swatches accept reference values"],
      });
    }
    return {
      value,
      slug,
      colorValue: type === "COLOR_SWATCH" ? colorValue : null,
      imageId: type === "IMAGE_SWATCH" ? imageId : null,
      sortOrder: input.sortOrder,
    };
  }

  private normalizeAttribute(input: AttributeInput) {
    return {
      name: input.name.trim().replace(/\s+/g, " "),
      slug: input.slug.trim().toLowerCase(),
      type: input.type,
    };
  }
}
