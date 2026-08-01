CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AttributeType" AS ENUM ('DROPDOWN', 'RADIO', 'CHECKBOX', 'COLOR_SWATCH', 'IMAGE_SWATCH');

CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoId" UUID,
    "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attributes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attribute_values" (
    "id" UUID NOT NULL,
    "attributeId" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "colorValue" TEXT,
    "imageId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attribute_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");
CREATE UNIQUE INDEX "brands_name_lower_key" ON "brands"(LOWER("name"));
CREATE INDEX "brands_logoId_idx" ON "brands"("logoId");
CREATE INDEX "brands_status_name_idx" ON "brands"("status", "name");

CREATE UNIQUE INDEX "attributes_name_key" ON "attributes"("name");
CREATE UNIQUE INDEX "attributes_slug_key" ON "attributes"("slug");
CREATE UNIQUE INDEX "attributes_name_lower_key" ON "attributes"(LOWER("name"));
CREATE INDEX "attributes_type_name_idx" ON "attributes"("type", "name");

CREATE UNIQUE INDEX "attribute_values_attributeId_slug_key" ON "attribute_values"("attributeId", "slug");
CREATE UNIQUE INDEX "attribute_values_attributeId_value_lower_key" ON "attribute_values"("attributeId", LOWER("value"));
CREATE INDEX "attribute_values_attributeId_sortOrder_idx" ON "attribute_values"("attributeId", "sortOrder");
CREATE INDEX "attribute_values_imageId_idx" ON "attribute_values"("imageId");

ALTER TABLE "brands"
ADD CONSTRAINT "brands_logoId_fkey"
FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attribute_values"
ADD CONSTRAINT "attribute_values_attributeId_fkey"
FOREIGN KEY ("attributeId") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attribute_values"
ADD CONSTRAINT "attribute_values_imageId_fkey"
FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
