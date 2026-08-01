CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageId" UUID,
    "parentId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_parentId_sortOrder_idx" ON "categories"("parentId", "sortOrder");
CREATE INDEX "categories_active_sortOrder_idx" ON "categories"("active", "sortOrder");
CREATE INDEX "categories_imageId_idx" ON "categories"("imageId");

ALTER TABLE "categories"
ADD CONSTRAINT "categories_imageId_fkey"
FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categories"
ADD CONSTRAINT "categories_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
