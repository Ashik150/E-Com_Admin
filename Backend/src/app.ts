import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import type { AppConfig } from "./config/environment.js";
import { authenticate } from "./middleware/authenticate.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import type { AuthenticationService } from "./modules/auth/authentication.service.js";
import {
  createProtectedAuthRouter,
  createPublicAuthRouter,
} from "./routes/auth.routes.js";
import { createDashboardRouter } from "./routes/dashboard.routes.js";

export interface AppDependencies {
  config: AppConfig;
  authentication: AuthenticationService;
}

export function createApp({ config, authentication }: AppDependencies): Express {
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
