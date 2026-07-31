import type { RequestHandler } from "express";
import { ApiError } from "../errors/api-error.js";

export function requirePermissions(...permissions: string[]): RequestHandler {
  return (request, _response, next): void => {
    if (!request.user) {
      next(ApiError.unauthorized());
      return;
    }

    const heldPermissions = new Set(request.user.permissions);
    const missingPermissions = permissions.filter(
      (permission) => !heldPermissions.has(permission),
    );
    if (missingPermissions.length > 0) {
      next(ApiError.forbidden(permissions));
      return;
    }

    next();
  };
}
