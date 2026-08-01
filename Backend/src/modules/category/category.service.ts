import type { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClient } from "../../database/prisma.js";
import { ApiError } from "../../errors/api-error.js";
import { paginationMeta } from "../../utils/pagination.js";

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  imageId?: string | null;
  parentId?: string | null;
  active: boolean;
  sortOrder: number;
}

interface NormalizedCategoryInput {
  name: string;
  slug: string;
  description: string | null;
  imageId: string | null;
  parentId: string | null;
  active: boolean;
  sortOrder: number;
}

interface CategoryTreeRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageId: string | null;
  parentId: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  image: {
    id: string;
    fileName: string;
    publicUrl: string;
    thumbnailUrl: string | null;
    altText: string | null;
    title: string | null;
  } | null;
}

export interface CategoryTreeNode extends CategoryTreeRecord {
  children: CategoryTreeNode[];
}

const imageSelect = {
  id: true,
  fileName: true,
  publicUrl: true,
  thumbnailUrl: true,
  altText: true,
  title: true,
} as const;

export class CategoryService {
  constructor(private readonly database: DatabaseClient) {}

  async list(input: {
    page: number;
    limit: number;
    search: string;
    active?: boolean;
  }): Promise<object> {
    const where = {
      ...(typeof input.active === "boolean" ? { active: input.active } : {}),
      ...(input.search
        ? {
            OR: [
              {
                name: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
              {
                slug: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
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
    const [categories, total] = await this.database.$transaction([
      this.database.category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          image: { select: imageSelect },
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { children: true } },
        },
      }),
      this.database.category.count({ where }),
    ]);
    return {
      items: categories.map(({ _count, ...category }) => ({
        ...category,
        childCount: _count.children,
      })),
      pagination: paginationMeta(input.page, input.limit, total),
    };
  }

  async tree(input: { search: string; active?: boolean }): Promise<object> {
    const records = await this.database.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { image: { select: imageSelect } },
    });
    const includedIds = this.filteredTreeIds(records, input);
    return {
      items: this.buildTree(records.filter(({ id }) => includedIds.has(id))),
      matchCount: records.filter((record) => this.matchesTreeFilter(record, input))
        .length,
    };
  }

  async get(id: string): Promise<object> {
    const category = await this.database.category.findUnique({
      where: { id },
      include: {
        image: { select: imageSelect },
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { children: true } },
      },
    });
    if (!category) throw ApiError.notFound("Category not found");
    const { _count, ...data } = category;
    return { ...data, childCount: _count.children };
  }

  async create(input: CategoryInput): Promise<object> {
    const normalized = this.normalizeInput(input);
    const category = await this.database.$transaction(async (transaction) => {
      await this.ensureUniqueSlug(transaction, normalized.slug);
      await this.ensureParentExists(transaction, normalized.parentId);
      await this.ensureImage(transaction, normalized.imageId);
      return transaction.category.create({ data: normalized, select: { id: true } });
    });
    return this.get(category.id);
  }

  async update(id: string, input: CategoryInput): Promise<object> {
    const normalized = this.normalizeInput(input);
    await this.database.$transaction(
      async (transaction) => {
        const current = await transaction.category.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!current) throw ApiError.notFound("Category not found");
        await this.ensureUniqueSlug(transaction, normalized.slug, id);
        await this.ensureNoCycle(transaction, id, normalized.parentId);
        await this.ensureImage(transaction, normalized.imageId);
        await transaction.category.update({ where: { id }, data: normalized });
      },
      { isolationLevel: "Serializable" },
    );
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      const category = await transaction.category.findUnique({
        where: { id },
        include: { _count: { select: { children: true } } },
      });
      if (!category) throw ApiError.notFound("Category not found");
      if (category._count.children > 0) {
        throw ApiError.conflict(
          "Categories with children cannot be deleted; reassign or delete the children first",
        );
      }
      await transaction.category.delete({ where: { id } });
    });
  }

  private buildTree(records: CategoryTreeRecord[]): CategoryTreeNode[] {
    const nodes = new Map<string, CategoryTreeNode>();
    for (const record of records) nodes.set(record.id, { ...record, children: [] });
    const roots: CategoryTreeNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    const sort = (items: CategoryTreeNode[]) => {
      items.sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      );
      for (const item of items) sort(item.children);
    };
    sort(roots);
    return roots;
  }

  private filteredTreeIds(
    records: CategoryTreeRecord[],
    input: { search: string; active?: boolean },
  ): Set<string> {
    if (!input.search && typeof input.active !== "boolean") {
      return new Set(records.map(({ id }) => id));
    }
    const byId = new Map(records.map((record) => [record.id, record]));
    const included = new Set<string>();
    for (const record of records) {
      if (!this.matchesTreeFilter(record, input)) continue;
      let current: CategoryTreeRecord | undefined = record;
      const visited = new Set<string>();
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        included.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    return included;
  }

  private matchesTreeFilter(
    record: CategoryTreeRecord,
    input: { search: string; active?: boolean },
  ): boolean {
    if (typeof input.active === "boolean" && record.active !== input.active) {
      return false;
    }
    const search = input.search.trim().toLowerCase();
    return (
      !search ||
      record.name.toLowerCase().includes(search) ||
      record.slug.toLowerCase().includes(search) ||
      record.description?.toLowerCase().includes(search) === true
    );
  }

  private async ensureUniqueSlug(
    transaction: Prisma.TransactionClient,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await transaction.category.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (duplicate) throw ApiError.conflict("A category with this slug already exists");
  }

  private async ensureParentExists(
    transaction: Prisma.TransactionClient,
    parentId: string | null,
  ): Promise<void> {
    if (!parentId) return;
    const parent = await transaction.category.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) throw ApiError.notFound("Parent category not found");
  }

  private async ensureNoCycle(
    transaction: Prisma.TransactionClient,
    categoryId: string,
    proposedParentId: string | null,
  ): Promise<void> {
    let currentId = proposedParentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === categoryId) {
        throw ApiError.validation({
          parentId: ["A category cannot be its own parent or descendant"],
        });
      }
      if (visited.has(currentId)) {
        throw ApiError.conflict("The existing category hierarchy contains a cycle");
      }
      visited.add(currentId);
      const current = await transaction.category.findUnique({
        where: { id: currentId },
        select: { id: true, parentId: true },
      });
      if (!current) throw ApiError.notFound("Parent category not found");
      currentId = current.parentId;
    }
  }

  private async ensureImage(
    transaction: Prisma.TransactionClient,
    imageId: string | null,
  ): Promise<void> {
    if (!imageId) return;
    const image = await transaction.mediaAsset.findUnique({
      where: { id: imageId },
      select: { type: true },
    });
    if (!image) throw ApiError.notFound("Category image not found");
    if (image.type !== "IMAGE") {
      throw ApiError.validation({ imageId: ["Category media must be an image"] });
    }
  }

  private normalizeInput(input: CategoryInput): NormalizedCategoryInput {
    return {
      name: input.name.trim().replace(/\s+/g, " "),
      slug: input.slug.trim().toLowerCase(),
      description: this.cleanOptional(input.description),
      imageId: input.imageId ?? null,
      parentId: input.parentId ?? null,
      active: input.active,
      sortOrder: input.sortOrder,
    };
  }

  private cleanOptional(value?: string | null): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }
}
