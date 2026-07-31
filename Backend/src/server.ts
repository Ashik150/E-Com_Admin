import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createPrismaClient } from "./database/prisma.js";
import { PrismaAccessUserRepository } from "./modules/auth/access-user.repository.js";
import { AuthenticationService } from "./modules/auth/authentication.service.js";
import { PrismaRefreshSessionRepository } from "./modules/auth/refresh-session.repository.js";

const config = loadEnvironment();
const database = createPrismaClient(config.DATABASE_URL);
const users = new PrismaAccessUserRepository(database);
const sessions = new PrismaRefreshSessionRepository(database);
const authentication = new AuthenticationService(users, sessions, {
  secret: config.JWT_ACCESS_SECRET,
  issuer: config.JWT_ACCESS_ISSUER,
  audience: config.JWT_ACCESS_AUDIENCE,
  accessTtlSeconds: config.JWT_ACCESS_TTL_SECONDS,
  refreshTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
});
const app = createApp({ config, authentication });
const server = app.listen(config.PORT, () => {
  console.info(`API listening on port ${config.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`${signal} received; shutting down`);
  server.close(async () => {
    await database.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
