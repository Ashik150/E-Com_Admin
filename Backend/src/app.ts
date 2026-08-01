import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import type { AppConfig } from "./config/environment.js";
import { authenticate } from "./middleware/authenticate.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import type { AuthenticationService } from "./modules/auth/authentication.service.js";
import type { PermissionService } from "./modules/permission/permission.service.js";
import type { RoleService } from "./modules/role/role.service.js";
import type { UserService } from "./modules/user/user.service.js";
import {
  createProtectedAuthRouter,
  createPublicAuthRouter,
} from "./routes/auth.routes.js";
import { createDashboardRouter } from "./routes/dashboard.routes.js";
import { createPermissionRouter } from "./routes/permission.routes.js";
import { createRoleRouter } from "./routes/role.routes.js";
import { createUserRouter } from "./routes/user.routes.js";

export interface AppDependencies {
  config: AppConfig;
  authentication: AuthenticationService;
  permissions?: PermissionService;
  roles?: RoleService;
  users?: UserService;
}

export function createApp({
  config,
  authentication,
  permissions,
  roles,
  users,
}: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
