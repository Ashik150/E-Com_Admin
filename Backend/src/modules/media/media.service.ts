import { randomUUID } from "node:crypto";
import {
  mkdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import type { DatabaseClient } from "../../database/prisma.js";
import { ApiError } from "../../errors/api-error.js";
import { paginationMeta } from "../../utils/pagination.js";
import type { MediaConfig } from "../../config/media.js";

const ALLOWED_MEDIA = new Map([
  ["image/jpeg", { extension: "jpg", type: "IMAGE" as const }],
  ["image/png", { extension: "png", type: "IMAGE" as const }],
  ["image/webp", { extension: "webp", type: "IMAGE" as const }],
  ["image/gif", { extension: "gif", type: "IMAGE" as const }],
  ["image/avif", { extension: "avif", type: "IMAGE" as const }],
  ["video/mp4", { extension: "mp4", type: "VIDEO" as const }],
  ["video/webm", { extension: "webm", type: "VIDEO" as const }],
]);

export interface MediaMetadataInput {
  title?: string | null;
  altText?: string | null;
}

interface PreparedAsset {
  id: string;
  fileName: string;
  storedPath: string;
  publicUrl: string;
  mimeType: string;
  type: "IMAGE" | "VIDEO";
  size: number;
  width: number | null;
  height: number | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  absolutePaths: string[];
}

export class MediaService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly config: MediaConfig,
  ) {}

  get uploadLimits(): Pick<MediaConfig, "maxFileSizeBytes" | "maxFiles"> {
    return {
      maxFileSizeBytes: this.config.maxFileSizeBytes,
      maxFiles: this.config.maxFiles,
    };
  }

  async list(input: {
    page: number;
    limit: number;
    search: string;
    type?: "IMAGE" | "VIDEO";
  }): Promise<object> {
    const where = {
      ...(input.type ? { type: input.type } : {}),
      ...(input.search
        ? {
            OR: [
              {
                fileName: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
              {
                title: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
              {
                altText: {
                  contains: input.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };
    const [assets, total] = await this.database.$transaction([
      this.database.mediaAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.database.mediaAsset.count({ where }),
    ]);
    return {
      items: assets,
      pagination: paginationMeta(input.page, input.limit, total),
    };
  }

  async get(id: string): Promise<object> {
    const asset = await this.database.mediaAsset.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!asset) throw ApiError.notFound("Media asset not found");
    return asset;
  }

  async upload(files: Express.Multer.File[], uploadedById: string): Promise<object[]> {
    if (files.length === 0) {
      throw ApiError.validation({ files: ["Select at least one file"] });
    }
    if (files.length > this.config.maxFiles) {
      throw ApiError.validation({
        files: [`A maximum of ${this.config.maxFiles} files is allowed`],
      });
    }

    const prepared: PreparedAsset[] = [];
    try {
      for (const file of files) {
        prepared.push(await this.prepareAndStore(file));
      }
      await this.database.mediaAsset.createMany({
        data: prepared.map(({ absolutePaths: _absolutePaths, ...asset }) => ({
          ...asset,
          uploadedById,
        })),
      });
      return this.database.mediaAsset.findMany({
        where: { id: { in: prepared.map(({ id }) => id) } },
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (error) {
      await this.removePaths(prepared.flatMap(({ absolutePaths }) => absolutePaths));
      throw error;
    }
  }

  async update(id: string, input: MediaMetadataInput): Promise<object> {
    const exists = await this.database.mediaAsset.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw ApiError.notFound("Media asset not found");
    await this.database.mediaAsset.update({
      where: { id },
      data: {
        ...(input.title !== undefined
          ? { title: this.cleanOptional(input.title) }
          : {}),
        ...(input.altText !== undefined
          ? { altText: this.cleanOptional(input.altText) }
          : {}),
      },
    });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const asset = await this.database.mediaAsset.findUnique({
      where: { id },
      select: { storedPath: true, thumbnailPath: true },
    });
    if (!asset) throw ApiError.notFound("Media asset not found");

    const paths = [asset.storedPath, asset.thumbnailPath]
      .filter((path): path is string => Boolean(path))
      .map((path) => this.absoluteStoragePath(path));
    const staged: Array<{ original: string; staged: string }> = [];
    try {
      for (const original of paths) {
        const stagedPath = `${original}.deleting-${randomUUID()}`;
        try {
          await rename(original, stagedPath);
          staged.push({ original, staged: stagedPath });
        } catch (error) {
          if (!this.isMissingFile(error)) throw error;
        }
      }
      await this.database.mediaAsset.delete({ where: { id } });
    } catch (error) {
      await Promise.allSettled(
        staged.map(({ original, staged: stagedPath }) =>
          rename(stagedPath, original),
        ),
      );
      throw error;
    }
    await this.removePaths(staged.map(({ staged: stagedPath }) => stagedPath));
  }

  private async prepareAndStore(file: Express.Multer.File): Promise<PreparedAsset> {
    if (file.size > this.config.maxFileSizeBytes) {
      throw new ApiError(
        413,
        "FILE_TOO_LARGE",
        `Each file must be at most ${this.config.maxFileSizeBytes} bytes`,
      );
    }
    const detected = await fileTypeFromBuffer(file.buffer);
    const allowed = detected ? ALLOWED_MEDIA.get(detected.mime) : undefined;
    if (!detected || !allowed) {
      throw ApiError.validation({
        files: [
          "Unsupported file content. Allowed: JPEG, PNG, WebP, GIF, AVIF, MP4, and WebM",
        ],
      });
    }

    const id = randomUUID();
    const storedPath = `originals/${id}.${allowed.extension}`;
    const absoluteOriginal = this.absoluteStoragePath(storedPath);
    let width: number | null = null;
    let height: number | null = null;
    let thumbnailPath: string | null = null;
    let thumbnailUrl: string | null = null;
    let thumbnailBuffer: Buffer | null = null;
    if (allowed.type === "IMAGE") {
      try {
        const image = sharp(file.buffer, { failOn: "error" });
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height) {
          throw new Error("Image dimensions are missing");
        }
        const rotated = Boolean(metadata.orientation && metadata.orientation >= 5);
        width = rotated ? metadata.height : metadata.width;
        height = rotated ? metadata.width : metadata.height;
        thumbnailPath = `thumbnails/${id}.webp`;
        thumbnailUrl = `${this.config.publicPath}/${thumbnailPath}`;
        thumbnailBuffer = await image
          .clone()
          .rotate()
          .resize({
            width: 480,
            height: 480,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 78 })
          .toBuffer();
      } catch {
        throw ApiError.validation({ files: [`${file.originalname} is not a valid image`] });
      }
    }

    const absolutePaths = [absoluteOriginal];
    const writes: Array<Promise<void>> = [];
    await mkdir(dirname(absoluteOriginal), { recursive: true });
    writes.push(writeFile(absoluteOriginal, file.buffer, { flag: "wx" }));
    if (thumbnailPath && thumbnailBuffer) {
      const absoluteThumbnail = this.absoluteStoragePath(thumbnailPath);
      absolutePaths.push(absoluteThumbnail);
      await mkdir(dirname(absoluteThumbnail), { recursive: true });
      writes.push(writeFile(absoluteThumbnail, thumbnailBuffer, { flag: "wx" }));
    }
    try {
      await Promise.all(writes);
    } catch (error) {
      await this.removePaths(absolutePaths);
      throw error;
    }

    return {
      id,
      fileName: this.cleanFileName(file.originalname),
      storedPath,
      publicUrl: `${this.config.publicPath}/${storedPath}`,
      mimeType: detected.mime,
      type: allowed.type,
      size: file.size,
      width,
      height,
      thumbnailPath,
      thumbnailUrl,
      absolutePaths,
    };
  }

  private absoluteStoragePath(relativePath: string): string {
    const absolutePath = resolve(this.config.storageDirectory, relativePath);
    const root = resolve(this.config.storageDirectory);
    if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
      throw new ApiError(500, "INVALID_STORAGE_PATH", "Invalid media storage path");
    }
    return absolutePath;
  }

  private cleanFileName(fileName: string): string {
    const cleaned = basename(fileName)
      .normalize("NFKC")
      .split("")
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join("")
      .trim();
    return cleaned || `upload${extname(fileName).toLowerCase()}`;
  }

  private cleanOptional(value?: string | null): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private async removePaths(paths: string[]): Promise<void> {
    await Promise.allSettled(paths.map((path) => unlink(path)));
  }

  private isMissingFile(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    );
  }
}
