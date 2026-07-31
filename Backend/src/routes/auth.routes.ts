import { Router, type Request } from "express";
import { z } from "zod";
import type { AppConfig } from "../config/environment.js";
import { ApiError } from "../errors/api-error.js";
import { csrfProtection } from "../middleware/csrf-protection.js";
import {
  clearAuthenticationCookies,
  REFRESH_COOKIE,
  setAuthenticationCookies,
} from "../modules/auth/auth.cookies.js";
import type { AuthenticationService } from "../modules/auth/authentication.service.js";

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export function createPublicAuthRouter(
  authentication: AuthenticationService,
  config: AppConfig,
): Router {
  const router = Router();

  router.post("/login", async (request, response, next) => {
    try {
      const input = loginSchema.safeParse(request.body);
      if (!input.success) {
        throw ApiError.validation(input.error.flatten());
      }

      const result = await authentication.login(
        input.data.email,
        input.data.password,
        sessionMetadata(request),
      );
      setAuthenticationCookies(response, result, config);
      response.json(authenticationResponse(result));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/refresh",
    csrfProtection(config),
    async (request, response, next) => {
      try {
        const refreshToken = request.cookies?.[REFRESH_COOKIE] as
          | string
          | undefined;
        if (!refreshToken) {
          throw ApiError.unauthorized();
        }

        const result = await authentication.refresh(
          refreshToken,
          sessionMetadata(request),
        );
        setAuthenticationCookies(response, result, config);
        response.json(authenticationResponse(result));
      } catch (error) {
        clearAuthenticationCookies(response, config);
        next(error);
      }
    },
  );

  router.post(
    "/logout",
    csrfProtection(config),
    async (request, response, next) => {
      try {
        const refreshToken = request.cookies?.[REFRESH_COOKIE] as
          | string
          | undefined;
        await authentication.logout(refreshToken);
        clearAuthenticationCookies(response, config);
        response.json({ success: true, data: { loggedOut: true } });
      } catch (error) {
        clearAuthenticationCookies(response, config);
        next(error);
      }
    },
  );

  return router;
}

export function createProtectedAuthRouter(): Router {
  const router = Router();

  router.get("/session", (request, response) => {
    response.json({ success: true, data: request.user });
  });

  return router;
}

function authenticationResponse(result: {
  accessToken: string;
  accessTokenExpiresIn: number;
  user: unknown;
}): object {
  return {
    success: true,
    data: {
      accessToken: result.accessToken,
      expiresIn: result.accessTokenExpiresIn,
      user: result.user,
    },
  };
}

function sessionMetadata(request: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: request.ip,
    userAgent: request.get("user-agent")?.slice(0, 512),
  };
}
