import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jsonwebtoken, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { ApiError } from "../../errors/api-error.js";
import type {
  AccessUserRecord,
  AuthenticatedUser,
} from "../../types/access-control.js";
import type { AccessUserRepository } from "./access-user.repository.js";
import type {
  NewRefreshSession,
  RefreshSessionRepository,
  SessionMetadata,
} from "./refresh-session.repository.js";

const accessPayloadSchema = z.object({
  sub: z.uuid(),
  type: z.literal("access"),
});
const dummyPasswordHash = bcrypt.hash(
  "constant-password-used-only-for-timing-equality",
  12,
);

export interface TokenConfiguration {
  secret: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
}

export interface AuthenticationResult {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  csrfToken: string;
  user: AuthenticatedUser;
}

export class AuthenticationService {
  constructor(
    private readonly users: AccessUserRepository,
    private readonly sessions: RefreshSessionRepository,
    private readonly tokens: TokenConfiguration,
  ) {}

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    let decoded: string | JwtPayload;
    try {
      decoded = jsonwebtoken.verify(accessToken, this.tokens.secret, {
        algorithms: ["HS256"],
        issuer: this.tokens.issuer,
        audience: this.tokens.audience,
      });
    } catch {
      throw ApiError.unauthorized();
    }

    const payload = accessPayloadSchema.safeParse(decoded);
    if (!payload.success) {
      throw ApiError.unauthorized();
    }

    const user = await this.users.findById(payload.data.sub);
    if (!this.isActiveUser(user)) {
      throw ApiError.unauthorized();
    }

    return this.toAuthenticatedUser(user);
  }

  async login(
    email: string,
    password: string,
    metadata: SessionMetadata,
  ): Promise<AuthenticationResult> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordMatches || !this.isActiveUser(user)) {
      throw ApiError.invalidCredentials();
    }

    const refreshToken = this.createRefreshToken();
    const session = this.createSession(
      user.id,
      randomUUID(),
      refreshToken,
      metadata,
    );
    await this.sessions.create(session);

    return this.createAuthenticationResult(user, refreshToken);
  }

  async refresh(
    currentRefreshToken: string,
    metadata: SessionMetadata,
  ): Promise<AuthenticationResult> {
    const replacementToken = this.createRefreshToken();
    const replacement = this.createReplacementSession(
      replacementToken,
      metadata,
    );
    const rotation = await this.sessions.rotate({
      currentTokenHash: this.hashRefreshToken(currentRefreshToken),
      replacement,
      now: new Date(),
      metadata,
    });

    if (rotation.status !== "rotated") {
      throw ApiError.unauthorized();
    }

    return this.createAuthenticationResult(rotation.user, replacementToken);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    await this.sessions.revoke(this.hashRefreshToken(refreshToken), new Date());
  }

  private createAuthenticationResult(
    user: AccessUserRecord,
    refreshToken: string,
  ): AuthenticationResult {
    return {
      accessToken: jsonwebtoken.sign(
        { sub: user.id, type: "access" },
        this.tokens.secret,
        {
          algorithm: "HS256",
          issuer: this.tokens.issuer,
          audience: this.tokens.audience,
          expiresIn: this.tokens.accessTtlSeconds,
          jwtid: randomUUID(),
        },
      ),
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      refreshToken,
      csrfToken: randomBytes(32).toString("base64url"),
      user: this.toAuthenticatedUser(user),
    };
  }

  private createSession(
    userId: string,
    familyId: string,
    refreshToken: string,
    metadata: SessionMetadata,
  ): NewRefreshSession {
    return {
      id: randomUUID(),
      userId,
      familyId,
      tokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: new Date(
        Date.now() + this.tokens.refreshTtlDays * 24 * 60 * 60 * 1000,
      ),
      metadata,
    };
  }

  private createRefreshToken(): string {
    return randomBytes(64).toString("base64url");
  }

  private createReplacementSession(
    refreshToken: string,
    metadata: SessionMetadata,
  ): Omit<NewRefreshSession, "userId" | "familyId"> {
    return {
      id: randomUUID(),
      tokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: new Date(
        Date.now() + this.tokens.refreshTtlDays * 24 * 60 * 60 * 1000,
      ),
      metadata,
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  private isActiveUser(
    user: AccessUserRecord | null,
  ): user is AccessUserRecord {
    return Boolean(
      user &&
        user.active &&
        user.deletedAt === null &&
        user.role.status === "ACTIVE",
    );
  }

  private toAuthenticatedUser(user: AccessUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: {
        id: user.role.id,
        name: user.role.name,
        status: "ACTIVE",
      },
      permissions: user.role.permissions,
    };
  }
}
