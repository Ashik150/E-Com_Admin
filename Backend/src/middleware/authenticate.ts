import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "../errors/api-error.js";
import type { AuthenticationService } from "../modules/auth/authentication.service.js";

export function authenticate(
  authentication: AuthenticationService,
): RequestHandler {
  return async (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        throw ApiError.unauthorized();
      }

      request.user = await authentication.authenticate(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}
