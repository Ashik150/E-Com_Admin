CREATE TYPE "Gender" AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER',
    'PREFER_NOT_TO_SAY'
);

ALTER TABLE "users"
ADD COLUMN "phone" TEXT,
ADD COLUMN "gender" "Gender",
ADD COLUMN "avatarUrl" TEXT;

ALTER TABLE "permission_groups"
ADD COLUMN "slug" TEXT;

UPDATE "permission_groups"
SET "slug" = LOWER(REGEXP_REPLACE(TRIM("name"), '[^a-zA-Z0-9]+', '-', 'g'));

ALTER TABLE "permission_groups"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "permission_groups_slug_key"
ON "permission_groups"("slug");

CREATE UNIQUE INDEX "permission_groups_name_lower_key"
ON "permission_groups"(LOWER("name"));

CREATE UNIQUE INDEX "roles_name_lower_key"
ON "roles"(LOWER("name"));

CREATE UNIQUE INDEX "users_email_lower_key"
ON "users"(LOWER("email"));
