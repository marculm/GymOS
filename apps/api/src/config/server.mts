import { env } from "./env.mts";

export const serverConfig = {
  port: env.PORT,
  hostname: "0.0.0.0",
  nodeEnv: env.NODE_ENV,
} as const;
