import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { z } from "zod";
import { ApiError } from "../errors/api-error.js";

export function asyncHandler(
  handler: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.validation(result.error.flatten());
  }
  return result.data;
}

export function success(response: Response, data: unknown, status = 200): void {
  response.status(status).json({ success: true, data });
}
