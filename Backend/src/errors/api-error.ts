export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(): ApiError {
    return new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  static forbidden(requiredPermissions: string[]): ApiError {
    return new ApiError(403, "FORBIDDEN", "Insufficient permissions", {
      requiredPermissions,
    });
  }

  static invalidCredentials(): ApiError {
    return new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  static csrfValidationFailed(): ApiError {
    return new ApiError(403, "CSRF_VALIDATION_FAILED", "CSRF validation failed");
  }

  static validation(details: unknown): ApiError {
    return new ApiError(422, "VALIDATION_ERROR", "Validation failed", {
      details,
    });
  }

  static notFound(message = "Route not found"): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, "CONFLICT", message);
  }
}
