import type { DatabaseClient } from "../../database/prisma.js";
import { ApiError } from "../../errors/api-error.js";
import { paginationMeta } from "../../utils/pagination.js";
import type { Prisma } from "../../../generated/prisma/client.ts";

export interface RoleInput {
  name: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
  permissionIds: string[];
}

export class RoleService {
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
              {
                name: {
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
    const [roles, total] = await this.database.$transaction([
      this.database.role.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          _count: { select: { users: true, permissions: true } },
        },
      }),
      this.database.role.count({ where }),
    ]);

    return {
      items: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        status: role.status,
        userCount: role._count.users,
        permissionCount: role._count.permissions,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      })),
      pagination: paginationMeta(input.page, input.limit, total),
    };
  }

  async options(): Promise<object[]> {
    return this.database.role.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  async get(id: string): Promise<object> {
    const role = await this.database.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { name: "asc" } },
        },
        _count: { select: { users: true } },
      },
    });
    if (!role) {
      throw ApiError.notFound("Role not found");
    }
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      status: role.status,
      userCount: role._count.users,
      permissions: role.permissions.map(({ permission }) => permission),
      permissionIds: role.permissions.map(({ permissionId }) => permissionId),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async create(input: RoleInput): Promise<object> {
    const name = this.cleanName(input.name);
    await this.ensureUniqueName(name);
    await this.ensurePermissionsExist(input.permissionIds);
    const role = await this.database.role.create({
      data: {
        name,
        description: this.cleanDescription(input.description),
        status: input.status,
        permissions: {
          createMany: {
            data: [...new Set(input.permissionIds)].map((permissionId) => ({
              permissionId,
            })),
          },
        },
      },
      select: { id: true },
    });
    return this.get(role.id);
  }

  async update(
    id: string,
    input: RoleInput,
    actorRoleId: string,
  ): Promise<object> {
    this.ensureNotOwnRole(id, actorRoleId);
    const name = this.cleanName(input.name);
    const permissionIds = [...new Set(input.permissionIds)];
    await this.database.$transaction(async (transaction) => {
      const current = await transaction.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: { permission: { select: { name: true } } },
          },
        },
      });
      if (!current) {
        throw ApiError.notFound("Role not found");
      }
      const duplicate = await transaction.role.findFirst({
        where: { id: { not: id }, name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicate) {
        throw ApiError.conflict("A role with this name already exists");
      }
      const permissionCount = await transaction.permission.count({
        where: { id: { in: permissionIds } },
      });
      if (permissionCount !== permissionIds.length) {
        throw ApiError.validation({
          permissionIds: ["One or more permissions do not exist"],
        });
      }
      await this.ensureManagementSurvives(
        transaction,
        id,
        input.status,
        permissionIds,
      );

      await transaction.role.update({
        where: { id },
        data: {
          name,
          description: this.cleanDescription(input.description),
          status: input.status,
        },
      });
      await transaction.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionIds.length > 0) {
        await transaction.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
    });
    return this.get(id);
  }

  async grantAll(id: string, actorRoleId: string): Promise<object> {
    this.ensureNotOwnRole(id, actorRoleId);
    const role = await this.database.role.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!role) {
      throw ApiError.notFound("Role not found");
    }
    const permissions = await this.database.permission.findMany({
      select: { id: true },
    });
    await this.database.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
    return this.get(id);
  }

  async addPermission(
    id: string,
    permissionId: string,
    actorRoleId: string,
  ): Promise<object> {
    this.ensureNotOwnRole(id, actorRoleId);
    await this.ensureRoleAndPermissionExist(id, permissionId);
    await this.database.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: id, permissionId } },
      update: {},
      create: { roleId: id, permissionId },
    });
    return this.get(id);
  }

  async removePermission(
    id: string,
    permissionId: string,
    actorRoleId: string,
  ): Promise<object> {
    this.ensureNotOwnRole(id, actorRoleId);
    await this.database.$transaction(async (transaction) => {
      const link = await transaction.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: id, permissionId } },
        include: { permission: { select: { name: true } } },
      });
      if (!link) {
        throw ApiError.notFound("Role permission assignment not found");
      }
      if (link.permission.name === "role:update") {
        const current = await transaction.role.findUniqueOrThrow({
          where: { id },
          include: { permissions: { select: { permissionId: true } } },
        });
        await this.ensureManagementSurvives(
          transaction,
          id,
          current.status,
          current.permissions
            .map(({ permissionId: currentId }) => currentId)
            .filter((currentId) => currentId !== permissionId),
        );
      }
      await transaction.rolePermission.delete({
        where: { roleId_permissionId: { roleId: id, permissionId } },
      });
    });
    return this.get(id);
  }

  async delete(id: string, actorRoleId: string): Promise<void> {
    this.ensureNotOwnRole(id, actorRoleId);
    await this.database.$transaction(async (transaction) => {
      const role = await transaction.role.findUnique({
        where: { id },
        include: {
          _count: { select: { users: true } },
          permissions: {
            include: { permission: { select: { name: true } } },
          },
        },
      });
      if (!role) {
        throw ApiError.notFound("Role not found");
      }
      if (role._count.users > 0) {
        throw ApiError.conflict("A role assigned to users cannot be deleted");
      }
      if (
        role.status === "ACTIVE" &&
        role.permissions.some(
          ({ permission }) => permission.name === "role:update",
        )
      ) {
        await this.ensureManagementSurvives(transaction, id, "INACTIVE", []);
      }
      await transaction.role.delete({ where: { id } });
    });
  }

  private async ensureUniqueName(name: string): Promise<void> {
    const duplicate = await this.database.role.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) {
      throw ApiError.conflict("A role with this name already exists");
    }
  }

  private async ensurePermissionsExist(permissionIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(permissionIds)];
    const count = await this.database.permission.count({
      where: { id: { in: uniqueIds } },
    });
    if (count !== uniqueIds.length) {
      throw ApiError.validation({
        permissionIds: ["One or more permissions do not exist"],
      });
    }
  }

  private async ensureRoleAndPermissionExist(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    const [role, permission] = await Promise.all([
      this.database.role.findUnique({ where: { id: roleId }, select: { id: true } }),
      this.database.permission.findUnique({
        where: { id: permissionId },
        select: { id: true },
      }),
    ]);
    if (!role) throw ApiError.notFound("Role not found");
    if (!permission) throw ApiError.notFound("Permission not found");
  }

  private async ensureManagementSurvives(
    transaction: Prisma.TransactionClient,
    roleId: string,
    proposedStatus: "ACTIVE" | "INACTIVE",
    proposedPermissionIds: string[],
  ): Promise<void> {
    const updatePermission = await transaction.permission.findUnique({
      where: { name: "role:update" },
      select: { id: true },
    });
    if (!updatePermission) {
      throw ApiError.conflict("The role:update permission is missing");
    }
    const targetKeepsManagement =
      proposedStatus === "ACTIVE" &&
      proposedPermissionIds.includes(updatePermission.id);
    if (targetKeepsManagement) return;

    const anotherManager = await transaction.role.count({
      where: {
        id: { not: roleId },
        status: "ACTIVE",
        permissions: {
          some: { permissionId: updatePermission.id },
        },
      },
    });
    if (anotherManager === 0) {
      throw ApiError.conflict(
        "This change would leave nobody able to manage roles",
      );
    }
  }

  private cleanName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }

  private cleanDescription(description?: string | null): string | null {
    const cleaned = description?.trim();
    return cleaned ? cleaned : null;
  }

  private ensureNotOwnRole(roleId: string, actorRoleId: string): void {
    if (roleId === actorRoleId) {
      throw ApiError.forbidden(["A user cannot change their own role or permissions"]);
    }
  }
}
