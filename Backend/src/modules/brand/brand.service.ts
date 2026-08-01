import type { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClient } from "../../database/prisma.js";
import { ApiError } from "../../errors/api-error.js";
import { paginationMeta } from "../../utils/pagination.js";

export interface BrandInput {
  name: string;
  slug: string;
  description?: string | null;
  logoId?: string | null;
  status: "ACTIVE" | "INACTIVE";
}

const logoSelect = {
  id: true,
  fileName: true,
  publicUrl: true,
  thumbnailUrl: true,
  altText: true,
  title: true,
} as const;

export class BrandService {
  constructor(private readonly database: DatabaseClient) {}

  async list(input: {
    page: number;
    limit: number;
    search: string;
    status?: "ACTIVE" | "INACTIVE";
  }): Promise<object> {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { slug: { contains: input.search, mode: "insensitive" as const } },
              {
                description: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };
    const [brands, total] = await this.database.$transaction([
      this.database.brand.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: { logo: { select: logoSelect } },
      }),
      this.database.brand.count({ where }),
    ]);
    return {
      items: brands,
      pagination: paginationMeta(input.page, input.limit, total),
    };
  }

  async get(id: string): Promise<object> {
    const brand = await this.database.brand.findUnique({
      where: { id },
      include: { logo: { select: logoSelect } },
    });
    if (!brand) throw ApiError.notFound("Brand not found");
    return brand;
  }

  async create(input: BrandInput): Promise<object> {
    const normalized = this.normalizeInput(input);
    const brand = await this.database.$transaction(async (transaction) => {
      await this.ensureUnique(transaction, normalized.name, normalized.slug);
      await this.ensureLogo(transaction, normalized.logoId);
      return transaction.brand.create({ data: normalized, select: { id: true } });
    });
    return this.get(brand.id);
  }

  async update(id: string, input: BrandInput): Promise<object> {
    const normalized = this.normalizeInput(input);
    await this.database.$transaction(async (transaction) => {
      const current = await transaction.brand.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!current) throw ApiError.notFound("Brand not found");
      await this.ensureUnique(
        transaction,
        normalized.name,
        normalized.slug,
        id,
      );
      await this.ensureLogo(transaction, normalized.logoId);
      await transaction.brand.update({ where: { id }, data: normalized });
    });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const brand = await this.database.brand.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!brand) throw ApiError.notFound("Brand not found");
    // The Product module adds a restrictive brand foreign key. Once referenced,
    // PostgreSQL will refuse this delete rather than orphaning a product.
    await this.database.brand.delete({ where: { id } });
  }

  private async ensureUnique(
    transaction: Prisma.TransactionClient,
    name: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await transaction.brand.findFirst({
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
        ? "A brand with this slug already exists"
        : "A brand with this name already exists",
    );
  }

  private async ensureLogo(
    transaction: Prisma.TransactionClient,
    logoId: string | null,
  ): Promise<void> {
    if (!logoId) return;
    const logo = await transaction.mediaAsset.findUnique({
      where: { id: logoId },
      select: { type: true },
    });
    if (!logo) throw ApiError.notFound("Brand logo not found");
    if (logo.type !== "IMAGE") {
      throw ApiError.validation({ logoId: ["Brand logo must be an image"] });
    }
  }

  private normalizeInput(input: BrandInput) {
    return {
      name: input.name.trim().replace(/\s+/g, " "),
      slug: input.slug.trim().toLowerCase(),
      description: this.cleanOptional(input.description),
      logoId: input.logoId ?? null,
      status: input.status,
    };
  }

  private cleanOptional(value?: string | null): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }
}
