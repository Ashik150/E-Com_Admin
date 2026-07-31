import type { DatabaseClient } from "../../database/prisma.js";
import type { AccessUserRecord } from "../../types/access-control.js";

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface NewRefreshSession {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  metadata: SessionMetadata;
}

export interface RotateRefreshSession {
  currentTokenHash: string;
  replacement: Omit<NewRefreshSession, "userId" | "familyId">;
  now: Date;
  metadata: SessionMetadata;
}

export type RotationResult =
  | { status: "rotated"; user: AccessUserRecord }
  | { status: "invalid" | "reused" };

export interface RefreshSessionRepository {
  create(session: NewRefreshSession): Promise<void>;
  rotate(input: RotateRefreshSession): Promise<RotationResult>;
  revoke(tokenHash: string, now: Date): Promise<void>;
}

export class PrismaRefreshSessionRepository
  implements RefreshSessionRepository
{
  constructor(private readonly database: DatabaseClient) {}

  async create(session: NewRefreshSession): Promise<void> {
    await this.database.refreshSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        familyId: session.familyId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
        createdByIp: session.metadata.ipAddress,
        userAgent: session.metadata.userAgent,
      },
    });
  }

  async rotate(input: RotateRefreshSession): Promise<RotationResult> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.refreshSession.findUnique({
        where: { tokenHash: input.currentTokenHash },
        select: {
          id: true,
          familyId: true,
          expiresAt: true,
          revokedAt: true,
          user: {
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
                      permission: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!current) {
        return { status: "invalid" };
      }

      if (current.revokedAt) {
        await transaction.refreshSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: input.now, lastUsedAt: input.now },
        });
        return { status: "reused" };
      }

      if (
        current.expiresAt <= input.now ||
        !current.user.active ||
        current.user.deletedAt !== null ||
        current.user.role.status !== "ACTIVE"
      ) {
        await transaction.refreshSession.updateMany({
          where: { id: current.id, revokedAt: null },
          data: { revokedAt: input.now, lastUsedAt: input.now },
        });
        return { status: "invalid" };
      }

      const claimed = await transaction.refreshSession.updateMany({
        where: {
          id: current.id,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
        data: {
          revokedAt: input.now,
          lastUsedAt: input.now,
          lastUsedIp: input.metadata.ipAddress,
        },
      });
      if (claimed.count !== 1) {
        await transaction.refreshSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: input.now, lastUsedAt: input.now },
        });
        return { status: "reused" };
      }

      await transaction.refreshSession.create({
        data: {
          id: input.replacement.id,
          userId: current.user.id,
          familyId: current.familyId,
          tokenHash: input.replacement.tokenHash,
          expiresAt: input.replacement.expiresAt,
          createdByIp: input.replacement.metadata.ipAddress,
          userAgent: input.replacement.metadata.userAgent,
        },
      });
      await transaction.refreshSession.update({
        where: { id: current.id },
        data: { replacedById: input.replacement.id },
      });

      return {
        status: "rotated",
        user: {
          id: current.user.id,
          name: current.user.name,
          email: current.user.email,
          active: current.user.active,
          deletedAt: current.user.deletedAt,
          role: {
            id: current.user.role.id,
            name: current.user.role.name,
            status: current.user.role.status,
            permissions: current.user.role.permissions.map(
              ({ permission }) => permission.name,
            ),
          },
        },
      };
    });
  }

  async revoke(tokenHash: string, now: Date): Promise<void> {
    await this.database.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now, lastUsedAt: now },
    });
  }
}
