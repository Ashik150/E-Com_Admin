import type { DatabaseClient } from "../../database/prisma.js";
import type {
  AccessUserRecord,
  LoginUserRecord,
} from "../../types/access-control.js";

export interface AccessUserRepository {
  findById(id: string): Promise<AccessUserRecord | null>;
  findByEmail(email: string): Promise<LoginUserRecord | null>;
}

export class PrismaAccessUserRepository implements AccessUserRepository {
  constructor(private readonly database: DatabaseClient) {}

  async findById(id: string): Promise<AccessUserRecord | null> {
    const user = await this.database.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        deletedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            status: true,
            permissions: {
              select: {
                permission: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      deletedAt: user.deletedAt,
      role: {
        id: user.role.id,
        name: user.role.name,
        status: user.role.status,
        permissions: user.role.permissions.map(
          ({ permission }) => permission.name,
        ),
      },
    };
  }

  async findByEmail(email: string): Promise<LoginUserRecord | null> {
    const user = await this.database.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        active: true,
        deletedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            status: true,
            permissions: {
              select: {
                permission: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      active: user.active,
      deletedAt: user.deletedAt,
      role: {
        id: user.role.id,
        name: user.role.name,
        status: user.role.status,
        permissions: user.role.permissions.map(
          ({ permission }) => permission.name,
        ),
      },
    };
  }
}
