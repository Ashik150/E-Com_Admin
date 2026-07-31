import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { authenticate } from "../../src/middleware/authenticate.js";
import { requirePermissions } from "../../src/middleware/require-permissions.js";
import type { AuthenticationService } from "../../src/modules/auth/authentication.service.js";
import type { AuthenticatedUser } from "../../src/types/access-control.js";

const user: AuthenticatedUser = {
  id: "user-id",
  name: "Catalog User",
  email: "catalog@example.com",
  role: {
    id: "role-id",
    name: "Catalog Manager",
    status: "ACTIVE",
  },
  permissions: ["product:read", "product:update"],
};

describe("authenticate middleware", () => {
  it.each([
    undefined,
    "",
    "Basic credentials",
    "Bearer",
    "Bearer token extra-value",
  ])("rejects a missing or malformed bearer header: %s", async (authorization) => {
    const authentication = {
      authenticate: vi.fn(),
    } as unknown as AuthenticationService;
    const middleware = authenticate(authentication);
    const request = {
      headers: authorization ? { authorization } : {},
    } as Request;
    const next = vi.fn() as NextFunction;

    await middleware(request, {} as Response, next);

    expect(authentication.authenticate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: "UNAUTHORIZED" }),
    );
  });

  it("attaches the authenticated user before continuing", async () => {
    const authentication = {
      authenticate: vi.fn().mockResolvedValue(user),
    } as unknown as AuthenticationService;
    const middleware = authenticate(authentication);
    const request = {
      headers: { authorization: "Bearer valid-token" },
    } as Request;
    const next = vi.fn() as NextFunction;

    await middleware(request, {} as Response, next);

    expect(authentication.authenticate).toHaveBeenCalledWith("valid-token");
    expect(request.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  it("forwards authentication failures to the central error handler", async () => {
    const error = new Error("database unavailable");
    const authentication = {
      authenticate: vi.fn().mockRejectedValue(error),
    } as unknown as AuthenticationService;
    const middleware = authenticate(authentication);
    const request = {
      headers: { authorization: "Bearer valid-token" },
    } as Request;
    const next = vi.fn() as NextFunction;

    await middleware(request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("requirePermissions middleware", () => {
  it("returns 401 if it is accidentally used before authentication", () => {
    const middleware = requirePermissions("product:read");
    const next = vi.fn() as NextFunction;

    middleware({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: "UNAUTHORIZED" }),
    );
  });

  it("continues only when every required permission is held", () => {
    const middleware = requirePermissions("product:read", "product:update");
    const next = vi.fn() as NextFunction;

    middleware({ user } as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("returns 403 with the route's complete permission requirement", () => {
    const middleware = requirePermissions("product:read", "product:delete");
    const next = vi.fn() as NextFunction;

    middleware({ user } as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: "FORBIDDEN",
        details: {
          requiredPermissions: ["product:read", "product:delete"],
        },
      }),
    );
  });
});
