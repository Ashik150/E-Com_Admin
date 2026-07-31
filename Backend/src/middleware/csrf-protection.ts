import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { AppConfig } from "../config/environment.js";
import { ApiError } from "../errors/api-error.js";
import { CSRF_COOKIE } from "../modules/auth/auth.cookies.js";

export function csrfProtection(config: AppConfig): RequestHandler {
  const allowedOrigin = new URL(config.FRONTEND_URL).origin;

  return (request, _response, next): void => {
    const origin = request.get("origin");
    const headerToken = request.get("x-csrf-token");
    const cookieToken = request.cookies?.[CSRF_COOKIE] as string | undefined;

    if (
      origin !== allowedOrigin ||
      !headerToken ||
      !cookieToken ||
      !tokensMatch(headerToken, cookieToken)
    ) {
      next(ApiError.csrfValidationFailed());
      return;
    }

    next();
  };
}

function tokensMatch(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}
