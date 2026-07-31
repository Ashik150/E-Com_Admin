import type { Response } from "express";
import type { AppConfig } from "../../config/environment.js";
import type { AuthenticationResult } from "./authentication.service.js";

export const REFRESH_COOKIE = "refresh_token";
export const CSRF_COOKIE = "csrf_token";

export function setAuthenticationCookies(
  response: Response,
  authentication: AuthenticationResult,
  config: AppConfig,
): void {
  const sharedOptions = {
    secure: config.COOKIE_SECURE,
    sameSite: "strict" as const,
  };

  response.cookie(REFRESH_COOKIE, authentication.refreshToken, {
    ...sharedOptions,
    httpOnly: true,
    path: "/api/v1/auth",
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
  response.cookie(CSRF_COOKIE, authentication.csrfToken, {
    ...sharedOptions,
    httpOnly: false,
    path: "/",
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthenticationCookies(
  response: Response,
  config: AppConfig,
): void {
  const sharedOptions = {
    secure: config.COOKIE_SECURE,
    sameSite: "strict" as const,
  };

  response.clearCookie(REFRESH_COOKIE, {
    ...sharedOptions,
    httpOnly: true,
    path: "/api/v1/auth",
  });
  response.clearCookie(CSRF_COOKIE, {
    ...sharedOptions,
    httpOnly: false,
    path: "/",
  });
}
