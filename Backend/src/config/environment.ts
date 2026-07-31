import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_ISSUER: z.string().min(1),
  JWT_ACCESS_AUDIENCE: z.string().min(1),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(600).max(900).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(7).max(30).default(14),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  return environmentSchema.parse(environment);
}
