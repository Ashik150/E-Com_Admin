import type { ErrorRequestHandler, RequestHandler } from "express";
import { ApiError } from "../errors/api-error.js";

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(ApiError.notFound());
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  const databaseConflict =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2002" || error.code === "P2003");
  const apiError =
    error instanceof ApiError
      ? error
      : databaseConflict
        ? ApiError.conflict("The record conflicts with existing data")
      : new ApiError(500, "INTERNAL_SERVER_ERROR", "Internal server error");

  response.status(apiError.statusCode).json({
    success: false,
    error: {
      statusCode: apiError.statusCode,
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details && typeof apiError.details === "object"
        ? apiError.details
        : {}),
    },
    path: request.originalUrl,
    timestamp: new Date().toISOString(),
  });
};
