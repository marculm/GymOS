import { env } from "./env.mts";

export const serverConfig = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
} as const;
