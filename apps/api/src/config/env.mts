import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  GYMOS_USER_EMAIL: z.email().default("demo@gymos.app"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:admin@gymos.app"),
});

export const env = EnvSchema.parse(process.env);

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function vapidConfig(): VapidConfig | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

const CurrentUserEmailSchema = z.email();

/**
 * The current user email is read per request so tests can switch users.
 * Invalid or empty overrides fall back to the validated environment value.
 */
export function currentUserEmail(): string {
  const override = process.env.GYMOS_USER_EMAIL;
  if (!override) return env.GYMOS_USER_EMAIL;

  const parsed = CurrentUserEmailSchema.safeParse(override);
  return parsed.success ? parsed.data : env.GYMOS_USER_EMAIL;
}
