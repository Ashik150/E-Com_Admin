import jsonwebtoken from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/errors/api-error.js";
import type { AccessUserRepository } from "../../src/modules/auth/access-user.repository.js";
import { AuthenticationService } from "../../src/modules/auth/authentication.service.js";

const userId = "44444444-4444-4444-8444-444444444444";
const tokenConfiguration = {
  secret: "unit-test-access-secret-with-at-least-32-characters",
  issuer: "trends-bird-api",
  audience: "trends-bird-dashboard",
};
const activeUser = {
  id: userId,
  name: "Catalog User",
  email: "catalog@example.com",
  active: true,
  deletedAt: null,
  role: {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Catalog Manager",
    status: "ACTIVE" as const,
    permissions: ["product:read", "product:update"],
  },
};

describe("AuthenticationService", () => {
  const findById = vi.fn();
  const repository = { findById } as AccessUserRepository;
  const service = new AuthenticationService(repository, tokenConfiguration);

  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValue(activeUser);
  });

  function createToken(
    payload: Record<string, unknown> = { sub: userId, type: "access" },
    overrides: Record<string, unknown> = {},
  ): string {
    return jsonwebtoken.sign(payload, tokenConfiguration.secret, {
      algorithm: "HS256",
      issuer: tokenConfiguration.issuer,
      audience: tokenConfiguration.audience,
      expiresIn: "15m",
      ...overrides,
    });
  }

  it("verifies the token and returns only the safe current access context", async () => {
    await expect(service.authenticate(createToken())).resolves.toEqual({
      id: activeUser.id,
      name: activeUser.name,
      email: activeUser.email,
      role: {
        id: activeUser.role.id,
        name: activeUser.role.name,
        status: "ACTIVE",
      },
      permissions: ["product:read", "product:update"],
    });
    expect(findById).toHaveBeenCalledWith(userId);
  });

  it.each([
    "not-a-token",
    jsonwebtoken.sign({ sub: userId, type: "access" }, "wrong-secret"),
    createToken(undefined, { issuer: "wrong-issuer" }),
    createToken(undefined, { audience: "wrong-audience" }),
    createToken(undefined, { expiresIn: -1 }),
    createToken({ sub: userId, type: "refresh" }),
    createToken({ sub: "not-a-uuid", type: "access" }),
    createToken({ type: "access" }),
  ])("rejects every malformed or invalid access token", async (token) => {
    await expect(service.authenticate(token)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  });

  it.each([
    null,
    { ...activeUser, active: false },
    { ...activeUser, deletedAt: new Date() },
    { ...activeUser, role: { ...activeUser.role, status: "INACTIVE" } },
  ])("rejects a missing, inactive, deleted, or role-disabled user", async (user) => {
    findById.mockResolvedValue(user);

    await expect(service.authenticate(createToken())).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(service.authenticate(createToken())).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
