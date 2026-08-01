import bcrypt from "bcryptjs";
import type { DatabaseClient } from "../../database/prisma.js";
import { ApiError } from "../../errors/api-error.js";
import { paginationMeta } from "../../utils/pagination.js";

export type GenderValue =
  | "MALE"
  | "FEMALE"
  | "OTHER"
  | "PREFER_NOT_TO_SAY";

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  gender?: GenderValue | null;
  avatarUrl?: string | null;
  roleId: string;
  active: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  phone?: string | null;
  gender?: GenderValue | null;
  avatarUrl?: string | null;
  roleId?: string;
  active?: boolean;
}

export class UserService {
  constructor(private readonly database: DatabaseClient) {}

  async list(input: {
    page: number;
    limit: number;
    search: string;
    roleId?: string;
    active?: boolean;
  }): Promise<object> {
    const where = {
      deletedAt: null,
      ...(input.roleId ? { roleId: input.roleId } : {}),
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
                email: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };
    const [users, total] = await this.database.$transaction([
      this.database.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: { role: { select: { id: true, name: true, status: true } } },
      }),
      this.database.user.count({ where }),
    ]);

    return {
      items: users.map((user) => this.serialize(user)),
      pagination: paginationMeta(input.page, input.limit, total),
    };
  }

  async get(id: string): Promise<object> {
    const user = await this.database.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: { select: { id: true, name: true, status: true } } },
    });
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return this.serialize(user);
  }

  async roleOptions(): Promise<object[]> {
    return this.database.role.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  async create(input: CreateUserInput): Promise<object> {
    const email = input.email.trim().toLowerCase();
    await Promise.all([
      this.ensureUniqueEmail(email),
      this.ensureAssignableRole(input.roleId),
    ]);
    const user = await this.database.user.create({
      data: {
        name: this.cleanRequired(input.name),
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        phone: this.cleanOptional(input.phone),
        gender: input.gender ?? null,
        avatarUrl: this.cleanOptional(input.avatarUrl),
        roleId: input.roleId,
        active: input.active,
      },
      select: { id: true },
    });
    return this.get(user.id);
  }

  async update(
    id: string,
    actorId: string,
    input: UpdateUserInput,
  ): Promise<object> {
    const current = await this.database.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, roleId: true, active: true },
    });
    if (!current) {
      throw ApiError.notFound("User not found");
    }
    if (id === actorId && input.roleId && input.roleId !== current.roleId) {
      throw new ApiError(
        403,
        "SELF_ROLE_CHANGE_FORBIDDEN",
        "You cannot change your own role",
      );
    }

    const email = input.email?.trim().toLowerCase();
    if (email && email !== current.email) {
      await this.ensureUniqueEmail(email, id);
    }
    if (input.roleId && input.roleId !== current.roleId) {
      await this.ensureAssignableRole(input.roleId);
    }
    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 12)
      : undefined;

    await this.database.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id },
        data: {
          ...(input.name !== undefined
            ? { name: this.cleanRequired(input.name) }
            : {}),
          ...(email !== undefined ? { email } : {}),
          ...(passwordHash ? { passwordHash } : {}),
          ...(input.phone !== undefined
            ? { phone: this.cleanOptional(input.phone) }
            : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.avatarUrl !== undefined
            ? { avatarUrl: this.cleanOptional(input.avatarUrl) }
            : {}),
          ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      if (passwordHash || input.active === false) {
        await transaction.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });
    return this.get(id);
  }

  async delete(id: string, actorId: string): Promise<void> {
    if (id === actorId) {
      throw ApiError.conflict("You cannot delete your own account");
    }
    const user = await this.database.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    const now = new Date();
    await this.database.$transaction([
      this.database.user.update({
        where: { id },
        data: { active: false, deletedAt: now },
      }),
      this.database.refreshSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  private async ensureUniqueEmail(email: string, excludeId?: string): Promise<void> {
    const duplicate = await this.database.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw ApiError.conflict("A user with this email already exists");
    }
  }

  private async ensureAssignableRole(roleId: string): Promise<void> {
    const role = await this.database.role.findUnique({
      where: { id: roleId },
      select: { status: true },
    });
    if (!role) {
      throw ApiError.notFound("Role not found");
    }
    if (role.status !== "ACTIVE") {
      throw ApiError.conflict("An inactive role cannot be assigned to a user");
    }
  }

  private cleanRequired(value: string): string {
    return value.trim().replace(/\s+/g, " ");
  }

  private cleanOptional(value?: string | null): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private serialize(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    gender: GenderValue | null;
    avatarUrl: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    role: { id: string; name: string; status: "ACTIVE" | "INACTIVE" };
  }): object {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      active: user.active,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
