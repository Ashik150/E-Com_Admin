import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { ApiError } from "../errors/api-error.js";
import { requirePermissions } from "../middleware/require-permissions.js";
import type { MediaService } from "../modules/media/media.service.js";
import { asyncHandler, parseInput, success } from "../utils/http.js";
import { paginationSchema } from "../utils/pagination.js";

const idSchema = z.uuid();
const mediaQuerySchema = paginationSchema.extend({
  type: z.enum(["IMAGE", "VIDEO"]).optional(),
});
const metadataSchema = z
  .object({
    title: z.string().trim().max(160).nullable().optional(),
    altText: z.string().trim().max(500).nullable().optional(),
  })
  .refine((input) => input.title !== undefined || input.altText !== undefined, {
    message: "Provide title or alt text",
  });

export function createMediaRouter(service: MediaService): Router {
  const router = Router();
  const limits = service.uploadLimits;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: limits.maxFileSizeBytes,
      files: limits.maxFiles,
      fields: 5,
    },
  });

  router.get(
    "/",
    requirePermissions("media:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.list(parseInput(mediaQuerySchema, request.query)));
    }),
  );
  router.post(
    "/upload",
    requirePermissions("media:upload"),
    receiveFiles(upload.array("files", limits.maxFiles), limits),
    asyncHandler(async (request, response) => {
      const files = Array.isArray(request.files) ? request.files : [];
      success(response, await service.upload(files, request.user!.id), 201);
    }),
  );
  router.get(
    "/:id",
    requirePermissions("media:read"),
    asyncHandler(async (request, response) => {
      success(response, await service.get(parseInput(idSchema, request.params.id)));
    }),
  );
  router.patch(
    "/:id",
    requirePermissions("media:write"),
    asyncHandler(async (request, response) => {
      success(
        response,
        await service.update(
          parseInput(idSchema, request.params.id),
          parseInput(metadataSchema, request.body),
        ),
      );
    }),
  );
  router.delete(
    "/:id",
    requirePermissions("media:delete"),
    asyncHandler(async (request, response) => {
      await service.delete(parseInput(idSchema, request.params.id));
      success(response, { deleted: true });
    }),
  );

  return router;
}

function receiveFiles(
  middleware: RequestHandler,
  limits: { maxFileSizeBytes: number; maxFiles: number },
): RequestHandler {
  return (request, response, next) => {
    middleware(request, response, (error?: unknown) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return next(
            new ApiError(
              413,
              "FILE_TOO_LARGE",
              `Each file must be at most ${limits.maxFileSizeBytes} bytes`,
            ),
          );
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return next(
            ApiError.validation({
              files: [`A maximum of ${limits.maxFiles} files is allowed`],
            }),
          );
        }
        return next(ApiError.validation({ files: [error.message] }));
      }
      return next(error);
    });
  };
}
