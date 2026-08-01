import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const permissionGroups = {
  Dashboard: ["watch"],
  Permission: ["watch", "create", "read", "update", "delete"],
  Role: ["watch", "create", "read", "update", "delete"],
  User: ["watch", "create", "read", "update", "delete"],
  Media: ["watch", "read", "upload", "write", "delete"],
  Category: ["watch", "create", "read", "update", "delete"],
  Brand: ["watch", "create", "read", "update", "delete"],
  Attribute: ["watch", "create", "read", "update", "delete"],
  Product: ["watch", "create", "read", "update", "delete"],
} as const;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function seed(): Promise<void> {
  const permissionIds: string[] = [];
  const catalogPermissionIds: string[] = [];

  for (const [groupName, actions] of Object.entries(permissionGroups)) {
    const slug = groupName.toLowerCase();
    const group = await database.permissionGroup.upsert({
      where: { slug },
      update: {
        name: groupName,
        description: `${groupName} module permissions`,
      },
      create: {
        name: groupName,
        slug,
        description: `${groupName} module permissions`,
      },
    });

    for (const action of actions) {
      const name = `${slug}:${action}`;
      const permission = await database.permission.upsert({
        where: { name },
        update: {
          groupId: group.id,
          description: `${action} ${groupName.toLowerCase()}`,
        },
        create: {
          name,
          description: `${action} ${groupName.toLowerCase()}`,
          groupId: group.id,
        },
      });
      permissionIds.push(permission.id);
      if (
        slug === "dashboard" ||
        ["media", "category", "brand", "attribute", "product"].includes(slug)
      ) {
        catalogPermissionIds.push(permission.id);
      }
    }
  }

  const administratorRole = await database.role.upsert({
    where: { name: "Super Administrator" },
    update: { status: "ACTIVE", description: "Full system access" },
    create: {
      name: "Super Administrator",
      description: "Full system access",
      status: "ACTIVE",
    },
  });
  const catalogRole = await database.role.upsert({
    where: { name: "Catalog Manager" },
    update: {
      status: "ACTIVE",
      description: "Catalog access without access-control administration",
    },
    create: {
      name: "Catalog Manager",
      description: "Catalog access without access-control administration",
      status: "ACTIVE",
    },
  });

  await database.$transaction([
    database.rolePermission.deleteMany({
      where: { roleId: { in: [administratorRole.id, catalogRole.id] } },
    }),
    database.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId: administratorRole.id,
        permissionId,
      })),
    }),
    database.rolePermission.createMany({
      data: catalogPermissionIds.map((permissionId) => ({
        roleId: catalogRole.id,
        permissionId,
      })),
    }),
  ]);

  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ?? "admin@trendsbird.com"
  ).toLowerCase();
  const catalogEmail = (
    process.env.SEED_CATALOG_EMAIL ?? "catalog@trendsbird.com"
  ).toLowerCase();
  const [adminPasswordHash, catalogPasswordHash] = await Promise.all([
    bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345", 12),
    bcrypt.hash(process.env.SEED_CATALOG_PASSWORD ?? "Catalog@12345", 12),
  ]);

  await database.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Super Administrator",
      passwordHash: adminPasswordHash,
      roleId: administratorRole.id,
      active: true,
      deletedAt: null,
    },
    create: {
      name: "Super Administrator",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      roleId: administratorRole.id,
      active: true,
    },
  });
  await database.user.upsert({
    where: { email: catalogEmail },
    update: {
      name: "Catalog Manager",
      passwordHash: catalogPasswordHash,
      roleId: catalogRole.id,
      active: true,
      deletedAt: null,
    },
    create: {
      name: "Catalog Manager",
      email: catalogEmail,
      passwordHash: catalogPasswordHash,
      roleId: catalogRole.id,
      active: true,
    },
  });
}

try {
  await seed();
  console.info("Database seed completed");
} finally {
  await database.$disconnect();
}
