import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  GYMOS_USER_EMAIL: z.email().default("demo@gymos.app"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

export const env = EnvSchema.parse(process.env);
