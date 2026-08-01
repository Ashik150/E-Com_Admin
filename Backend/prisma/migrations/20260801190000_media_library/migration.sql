CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnailPath" TEXT,
    "thumbnailUrl" TEXT,
    "altText" TEXT,
    "title" TEXT,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_assets_storedPath_key" ON "media_assets"("storedPath");
CREATE UNIQUE INDEX "media_assets_thumbnailPath_key" ON "media_assets"("thumbnailPath");
CREATE INDEX "media_assets_uploadedById_idx" ON "media_assets"("uploadedById");
CREATE INDEX "media_assets_type_createdAt_idx" ON "media_assets"("type", "createdAt");

ALTER TABLE "media_assets"
ADD CONSTRAINT "media_assets_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
