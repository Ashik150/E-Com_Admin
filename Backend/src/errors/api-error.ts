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

  static notFound(): ApiError {
    return new ApiError(404, "NOT_FOUND", "Route not found");
  }
}
