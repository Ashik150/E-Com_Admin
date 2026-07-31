import jsonwebtoken, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { ApiError } from "../../errors/api-error.js";
import type { AuthenticatedUser } from "../../types/access-control.js";
import type { AccessUserRepository } from "./access-user.repository.js";

const accessPayloadSchema = z.object({
  sub: z.uuid(),
  type: z.literal("access"),
});

export interface AccessTokenConfiguration {
  secret: string;
  issuer: string;
  audience: string;
}

export class AuthenticationService {
  constructor(
    private readonly users: AccessUserRepository,
    private readonly tokens: AccessTokenConfiguration,
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
    if (
      !user ||
      !user.active ||
      user.deletedAt !== null ||
      user.role.status !== "ACTIVE"
    ) {
      throw ApiError.unauthorized();
    }

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
