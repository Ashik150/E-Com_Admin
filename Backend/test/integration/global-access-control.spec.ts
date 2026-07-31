import jsonwebtoken from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/environment.js";
import type { AccessUserRepository } from "../../src/modules/auth/access-user.repository.js";
import { AuthenticationService } from "../../src/modules/auth/authentication.service.js";

const userId = "44444444-4444-4444-8444-444444444444";
const config: AppConfig = {
  NODE_ENV: "test",
  PORT: 3000,
  DATABASE_URL: "postgresql://unused-in-integration-test",
  FRONTEND_URL: "http://localhost:5173",
  JWT_ACCESS_SECRET: "integration-secret-with-at-least-32-characters",
  JWT_ACCESS_ISSUER: "trends-bird-api",
  JWT_ACCESS_AUDIENCE: "trends-bird-dashboard",
};

describe("Express global access control", () => {
  const findById = vi.fn();
  const repository = { findById } as AccessUserRepository;
  const authentication = new AuthenticationService(repository, {
    secret: config.JWT_ACCESS_SECRET,
    issuer: config.JWT_ACCESS_ISSUER,
    audience: config.JWT_ACCESS_AUDIENCE,
  });
  const app = createApp({ config, authentication });

  function createToken(subject = userId): string {
    return jsonwebtoken.sign(
      { sub: subject, type: "access" },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: "HS256",
        issuer: config.JWT_ACCESS_ISSUER,
        audience: config.JWT_ACCESS_AUDIENCE,
        expiresIn: "15m",
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValue({
      id: userId,
      name: "Catalog User",
      email: "catalog@example.com",
      active: true,
      deletedAt: null,
      role: {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Catalog Manager",
        status: "ACTIVE",
        permissions: ["product:read"],
      },
    });
  });

  it("protects the session route by default", async () => {
    const response = await request(app).get("/api/v1/auth/session").expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("rejects an incorrectly signed token", async () => {
    const invalidToken = jsonwebtoken.sign(
      { sub: userId, type: "access" },
      "different-secret-with-at-least-32-characters",
    );

    await request(app)
      .get("/api/v1/auth/session")
      .set("Authorization", `Bearer ${invalidToken}`)
      .expect(401);
  });

  it("returns the current user, role, and flat permission list", async () => {
    const response = await request(app)
      .get("/api/v1/auth/session")
      .set("Authorization", `Bearer ${createToken()}`)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: userId,
        name: "Catalog User",
        email: "catalog@example.com",
        role: {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Catalog Manager",
          status: "ACTIVE",
        },
        permissions: ["product:read"],
      },
    });
  });

  it("returns 403 when a valid user lacks the route permission", async () => {
    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${createToken()}`)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "FORBIDDEN",
        requiredPermissions: ["dashboard:watch"],
      },
    });
  });

  it("allows the route after its permission is granted", async () => {
    findById.mockResolvedValueOnce({
      id: userId,
      name: "Catalog User",
      email: "catalog@example.com",
      active: true,
      deletedAt: null,
      role: {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Catalog Manager",
        status: "ACTIVE",
        permissions: ["dashboard:watch"],
      },
    });

    await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${createToken()}`)
      .expect(200);
  });

  it("applies permission revocation on the next request", async () => {
    findById
      .mockResolvedValueOnce({
        id: userId,
        name: "Catalog User",
        email: "catalog@example.com",
        active: true,
        deletedAt: null,
        role: {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Catalog Manager",
          status: "ACTIVE",
          permissions: ["dashboard:watch"],
        },
      })
      .mockResolvedValueOnce({
        id: userId,
        name: "Catalog User",
        email: "catalog@example.com",
        active: true,
        deletedAt: null,
        role: {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Catalog Manager",
          status: "ACTIVE",
          permissions: [],
        },
      });
    const token = createToken();

    await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("returns 404 for an unknown authenticated route", async () => {
    const response = await request(app)
      .get("/api/v1/not-a-route")
      .set("Authorization", `Bearer ${createToken()}`)
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
