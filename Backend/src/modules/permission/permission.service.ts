import type { DatabaseClient } from "../../database/prisma.js";
import { ApiError } from "../../errors/api-error.js";
import { paginationMeta } from "../../utils/pagination.js";

export const STANDARD_PERMISSION_ACTIONS = [
  "watch",
  "create",
  "read",
  "update",
  "delete",
  "upload",
  "write",
  "approve",
  "status",
] as const;

export interface PermissionGroupInput {
  name: string;
  description?: string | null;
  actions: string[];
}

export class PermissionService {
  constructor(private readonly database: DatabaseClient) {}

  async list(input: {
    page: number;
    limit: number;
    search: string;
  }): Promise<object> {
    const where = input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            {
              description: {
                contains: input.search,
                mode: "insensitive" as const,
              },
            },
            {
              permissions: {
                some: {
                  name: {
                    contains: input.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {};
    const [groups, total] = await this.database.$transaction([
      this.database.permissionGroup.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          permissions: { orderBy: { name: "asc" } },
        },
      }),
      this.database.permissionGroup.count({ where }),
    ]);

    return {
      items: groups.map((group) => this.serializeGroup(group)),
      pagination: paginationMeta(input.page, input.limit, total),
    };
  }

  async get(id: string): Promise<object> {
    const group = await this.database.permissionGroup.findUnique({
      where: { id },
      include: { permissions: { orderBy: { name: "asc" } } },
    });
    if (!group) {
      throw ApiError.notFound("Permission group not found");
    }
    return this.serializeGroup(group);
  }

  async create(input: PermissionGroupInput): Promise<object> {
    const name = this.normalizeDisplayName(input.name);
    const slug = this.slugify(name);
    const actions = this.normalizeActions(input.actions);
    if (actions.length === 0) {
      throw ApiError.validation({ actions: ["Select at least one action"] });
    }

    const duplicate = await this.database.permissionGroup.findFirst({
      where: { OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] },
      select: { id: true },
    });
    if (duplicate) {
      throw ApiError.conflict("A permission group with this name already exists");
    }

    const group = await this.database.permissionGroup.create({
      data: {
        name,
        slug,
        description: this.cleanDescription(input.description),
        permissions: {
          create: actions.map((action) => ({
            name: `${slug}:${action}`,
            description: `${action} ${name.toLowerCase()}`,
          })),
        },
      },
      include: { permissions: { orderBy: { name: "asc" } } },
    });
    return this.serializeGroup(group);
  }

  async update(id: string, input: PermissionGroupInput): Promise<object> {
    const name = this.normalizeDisplayName(input.name);
    const slug = this.slugify(name);
    const actions = this.normalizeActions(input.actions);
    if (actions.length === 0) {
      throw ApiError.validation({ actions: ["Select at least one action"] });
    }

    await this.database.$transaction(async (transaction) => {
      const group = await transaction.permissionGroup.findUnique({
        where: { id },
        include: { permissions: true },
      });
      if (!group) {
        throw ApiError.notFound("Permission group not found");
      }
      const duplicate = await transaction.permissionGroup.findFirst({
        where: {
          id: { not: id },
          OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }],
        },
        select: { id: true },
      });
      if (duplicate) {
        throw ApiError.conflict("A permission group with this name already exists");
      }

      const currentByAction = new Map(
        group.permissions.map((permission) => [
          permission.name.split(":").at(-1) ?? "",
          permission,
        ]),
      );
      const removed = group.permissions.filter(
        (permission) =>
          !actions.includes(permission.name.split(":").at(-1) ?? ""),
      );
      if (
        removed.some((permission) => permission.name === "role:update") ||
        (group.permissions.some(
          (permission) => permission.name === "role:update",
        ) &&
          slug !== "role")
      ) {
        throw ApiError.conflict(
          "The role:update permission cannot be removed from the system",
        );
      }

      await transaction.permissionGroup.update({
        where: { id },
        data: {
          name,
          slug,
          description: this.cleanDescription(input.description),
        },
      });
      for (const action of actions) {
        const existing = currentByAction.get(action);
        if (existing) {
          await transaction.permission.update({
            where: { id: existing.id },
            data: {
              name: `${slug}:${action}`,
              description: `${action} ${name.toLowerCase()}`,
            },
          });
        } else {
          await transaction.permission.create({
            data: {
              groupId: id,
              name: `${slug}:${action}`,
              description: `${action} ${name.toLowerCase()}`,
            },
          });
        }
      }
      if (removed.length > 0) {
        await transaction.permission.deleteMany({
          where: { id: { in: removed.map((permission) => permission.id) } },
        });
      }
    });

    return this.get(id);
  }

  async deleteGroup(id: string): Promise<void> {
    const group = await this.database.permissionGroup.findUnique({
      where: { id },
      include: { permissions: { select: { name: true } } },
    });
    if (!group) {
      throw ApiError.notFound("Permission group not found");
    }
    if (group.permissions.some((permission) => permission.name === "role:update")) {
      throw ApiError.conflict(
        "The group containing role:update cannot be deleted",
      );
    }
    await this.database.permissionGroup.delete({ where: { id } });
  }

  async deletePermission(id: string): Promise<void> {
    const permission = await this.database.permission.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!permission) {
      throw ApiError.notFound("Permission not found");
    }
    if (permission.name === "role:update") {
      throw ApiError.conflict(
        "The role:update permission cannot be deleted from the system",
      );
    }
    await this.database.permission.delete({ where: { id } });
  }

  private normalizeActions(actions: string[]): string[] {
    const normalized = actions.map((action) => action.trim().toLowerCase());
    const invalid = normalized.find(
      (action) => !/^[a-z][a-z0-9_-]{1,39}$/.test(action),
    );
    if (invalid) {
      throw ApiError.validation({
        actions: [`Invalid action name: ${invalid}`],
      });
    }
    return [...new Set(normalized)].sort();
  }

  private normalizeDisplayName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }

  private slugify(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) {
      throw ApiError.validation({ name: ["Name must contain letters or numbers"] });
    }
    return slug;
  }

  private cleanDescription(description?: string | null): string | null {
    const cleaned = description?.trim();
    return cleaned ? cleaned : null;
  }

  private serializeGroup(group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    permissions: Array<{
      id: string;
      name: string;
      description: string | null;
    }>;
  }): object {
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      actions: group.permissions.map((permission) => ({
        id: permission.id,
        name: permission.name,
        action: permission.name.split(":").at(-1),
        description: permission.description,
      })),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}
