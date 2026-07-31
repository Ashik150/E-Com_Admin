CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permission_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "groupId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "roleId" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE UNIQUE INDEX "permission_groups_name_key" ON "permission_groups"("name");
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");
CREATE INDEX "permissions_groupId_idx" ON "permissions"("groupId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_roleId_idx" ON "users"("roleId");
CREATE INDEX "users_active_deletedAt_idx" ON "users"("active", "deletedAt");
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

ALTER TABLE "permissions"
ADD CONSTRAINT "permissions_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "permission_groups"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
ADD CONSTRAINT "users_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "roles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
ADD CONSTRAINT "role_permissions_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "roles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
ADD CONSTRAINT "role_permissions_permissionId_fkey"
FOREIGN KEY ("permissionId") REFERENCES "permissions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
