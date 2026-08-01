import { resolve } from "node:path";
import { z } from "zod";

const mediaEnvironmentSchema = z.object({
  MEDIA_STORAGE_DIR: z.string().trim().min(1).default("uploads"),
  MEDIA_MAX_FILE_SIZE_MB: z.coerce.number().positive().max(100).default(10),
  MEDIA_MAX_FILES: z.coerce.number().int().min(1).max(50).default(10),
});

export interface MediaConfig {
  storageDirectory: string;
  maxFileSizeBytes: number;
  maxFiles: number;
  publicPath: string;
}

export function loadMediaConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MediaConfig {
  const parsed = mediaEnvironmentSchema.parse(environment);
  return {
    storageDirectory: resolve(process.cwd(), parsed.MEDIA_STORAGE_DIR),
    maxFileSizeBytes: Math.floor(parsed.MEDIA_MAX_FILE_SIZE_MB * 1024 * 1024),
    maxFiles: parsed.MEDIA_MAX_FILES,
    publicPath: "/uploads",
  };
}
