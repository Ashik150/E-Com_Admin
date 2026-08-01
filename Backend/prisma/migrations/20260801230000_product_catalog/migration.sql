CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK');

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "hasVariants" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(12,2),
    "salePrice" DECIMAL(12,2),
    "stock" INTEGER,
    "stockStatus" "StockStatus",
    "weight" DECIMAL(10,3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "brandId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_simple_or_variable_check" CHECK (
      ("hasVariants" = false AND "sku" IS NOT NULL AND "price" IS NOT NULL AND "stock" IS NOT NULL AND "stockStatus" IS NOT NULL)
      OR
      ("hasVariants" = true AND "sku" IS NULL AND "price" IS NULL AND "salePrice" IS NULL AND "stock" IS NULL AND "stockStatus" IS NULL)
    ),
    CONSTRAINT "products_price_nonnegative_check" CHECK ("price" IS NULL OR "price" >= 0),
    CONSTRAINT "products_sale_price_check" CHECK ("salePrice" IS NULL OR ("salePrice" >= 0 AND "salePrice" <= "price")),
    CONSTRAINT "products_stock_nonnegative_check" CHECK ("stock" IS NULL OR "stock" >= 0),
    CONSTRAINT "products_weight_nonnegative_check" CHECK ("weight" IS NULL OR "weight" >= 0),
    CONSTRAINT "products_sort_order_nonnegative_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "product_categories" (
    "productId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("productId", "categoryId")
);

CREATE TABLE "product_media" (
    "productId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "isThumbnail" BOOLEAN NOT NULL DEFAULT false,
    "isGallery" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_media_pkey" PRIMARY KEY ("productId", "mediaId"),
    CONSTRAINT "product_media_sort_order_nonnegative_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "combinationKey" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2),
    "stock" INTEGER NOT NULL,
    "stockStatus" "StockStatus" NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "weight" DECIMAL(10,3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "purchasable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_variants_price_nonnegative_check" CHECK ("price" >= 0),
    CONSTRAINT "product_variants_sale_price_check" CHECK ("salePrice" IS NULL OR ("salePrice" >= 0 AND "salePrice" <= "price")),
    CONSTRAINT "product_variants_stock_nonnegative_check" CHECK ("stock" >= 0),
    CONSTRAINT "product_variants_threshold_nonnegative_check" CHECK ("lowStockThreshold" >= 0),
    CONSTRAINT "product_variants_weight_nonnegative_check" CHECK ("weight" IS NULL OR "weight" >= 0)
);

CREATE TABLE "product_variant_values" (
    "variantId" UUID NOT NULL,
    "attributeId" UUID NOT NULL,
    "attributeValueId" UUID NOT NULL,
    CONSTRAINT "product_variant_values_pkey" PRIMARY KEY ("variantId", "attributeId")
);

CREATE TABLE "product_variant_media" (
    "variantId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "isThumbnail" BOOLEAN NOT NULL DEFAULT false,
    "isGallery" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_variant_media_pkey" PRIMARY KEY ("variantId", "mediaId"),
    CONSTRAINT "product_variant_media_sort_order_nonnegative_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "attribute_value_media" (
    "attributeValueId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "attribute_value_media_pkey" PRIMARY KEY ("attributeValueId", "mediaId"),
    CONSTRAINT "attribute_value_media_sort_order_nonnegative_check" CHECK ("sortOrder" >= 0)
);

CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE UNIQUE INDEX "attribute_values_id_attributeId_key" ON "attribute_values"("id", "attributeId");
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE UNIQUE INDEX "products_sku_upper_key" ON "products"(UPPER("sku")) WHERE "sku" IS NOT NULL;
CREATE INDEX "products_brandId_idx" ON "products"("brandId");
CREATE INDEX "products_active_sortOrder_idx" ON "products"("active", "sortOrder");
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "product_categories_categoryId_idx" ON "product_categories"("categoryId");
CREATE INDEX "product_media_mediaId_idx" ON "product_media"("mediaId");
CREATE INDEX "product_media_productId_sortOrder_idx" ON "product_media"("productId", "sortOrder");
CREATE UNIQUE INDEX "product_media_one_thumbnail_key" ON "product_media"("productId") WHERE "isThumbnail" = true;
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE UNIQUE INDEX "product_variants_sku_upper_key" ON "product_variants"(UPPER("sku"));
CREATE UNIQUE INDEX "product_variants_productId_combinationKey_key" ON "product_variants"("productId", "combinationKey");
CREATE INDEX "product_variants_productId_active_idx" ON "product_variants"("productId", "active");
CREATE INDEX "product_variants_stockStatus_idx" ON "product_variants"("stockStatus");
CREATE INDEX "product_variant_values_attributeValueId_attributeId_idx" ON "product_variant_values"("attributeValueId", "attributeId");
CREATE INDEX "product_variant_media_mediaId_idx" ON "product_variant_media"("mediaId");
CREATE INDEX "product_variant_media_variantId_sortOrder_idx" ON "product_variant_media"("variantId", "sortOrder");
CREATE UNIQUE INDEX "product_variant_media_one_thumbnail_key" ON "product_variant_media"("variantId") WHERE "isThumbnail" = true;
CREATE INDEX "attribute_value_media_mediaId_idx" ON "attribute_value_media"("mediaId");
CREATE INDEX "attribute_value_media_attributeValueId_sortOrder_idx" ON "attribute_value_media"("attributeValueId", "sortOrder");

ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_values" ADD CONSTRAINT "product_variant_values_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_values" ADD CONSTRAINT "product_variant_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variant_values" ADD CONSTRAINT "product_variant_values_attributeValueId_attributeId_fkey" FOREIGN KEY ("attributeValueId", "attributeId") REFERENCES "attribute_values"("id", "attributeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variant_media" ADD CONSTRAINT "product_variant_media_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_media" ADD CONSTRAINT "product_variant_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribute_value_media" ADD CONSTRAINT "attribute_value_media_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "attribute_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attribute_value_media" ADD CONSTRAINT "attribute_value_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
