import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import * as helmetModule from "helmet";
import type { AppConfig } from "./config/environment.js";
import { authenticate } from "./middleware/authenticate.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import type { AuthenticationService } from "./modules/auth/authentication.service.js";
import type { PermissionService } from "./modules/permission/permission.service.js";
import type { RoleService } from "./modules/role/role.service.js";
import type { UserService } from "./modules/user/user.service.js";
import type { MediaService } from "./modules/media/media.service.js";
import type { CategoryService } from "./modules/category/category.service.js";
import type { BrandService } from "./modules/brand/brand.service.js";
import type { AttributeService } from "./modules/attribute/attribute.service.js";
import type { ProductService } from "./modules/product/product.service.js";
import {
  createProtectedAuthRouter,
  createPublicAuthRouter,
} from "./routes/auth.routes.js";
import { createDashboardRouter } from "./routes/dashboard.routes.js";
import { createPermissionRouter } from "./routes/permission.routes.js";
import { createRoleRouter } from "./routes/role.routes.js";
import { createUserRouter } from "./routes/user.routes.js";
import { createMediaRouter } from "./routes/media.routes.js";
import { createCategoryRouter } from "./routes/category.routes.js";
import { createBrandRouter } from "./routes/brand.routes.js";
import { createAttributeRouter } from "./routes/attribute.routes.js";
import { createProductRouter } from "./routes/product.routes.js";

export interface AppDependencies {
  config: AppConfig;
  authentication: AuthenticationService;
  permissions?: PermissionService;
  roles?: RoleService;
  users?: UserService;
  media?: MediaService;
  mediaStorageDirectory?: string;
  categories?: CategoryService;
  brands?: BrandService;
  attributes?: AttributeService;
  products?: ProductService;
}

export function createApp({
  config,
  authentication,
  permissions,
  roles,
  users,
  media,
  mediaStorageDirectory,
  categories,
  brands,
  attributes,
  products,
}: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmetModule.default());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  if (mediaStorageDirectory) {
    app.use(
      "/uploads",
      express.static(mediaStorageDirectory, {
        dotfiles: "deny",
        index: false,
        immutable: true,
        maxAge: "1y",
        setHeaders(response) {
          response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          response.setHeader("X-Content-Type-Options", "nosniff");
        },
      }),
      (_request, response) => {
        response.status(404).json({
          success: false,
          error: { statusCode: 404, code: "NOT_FOUND", message: "File not found" },
        });
      },
    );
  }

  // Login, refresh, and logout will be mounted on this router before the
  // authentication middleware. No other router may be mounted here.
  app.use("/api/v1/auth", createPublicAuthRouter(authentication, config));

  // Everything mounted after this line is authenticated by default.
  app.use(authenticate(authentication));
  app.use("/api/v1/auth", createProtectedAuthRouter());
  app.use("/api/v1/dashboard", createDashboardRouter());
  if (permissions) app.use("/api/v1/permissions", createPermissionRouter(permissions));
  if (roles) app.use("/api/v1/roles", createRoleRouter(roles));
  if (users) app.use("/api/v1/users", createUserRouter(users));
  if (media) app.use("/api/v1/media", createMediaRouter(media));
  if (categories) app.use("/api/v1/categories", createCategoryRouter(categories));
  if (brands) app.use("/api/v1/brands", createBrandRouter(brands));
  if (attributes) app.use("/api/v1/attributes", createAttributeRouter(attributes));
  if (products) app.use("/api/v1/products", createProductRouter(products));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
