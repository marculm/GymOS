import pino from "pino";
import { env } from "../config/env.mts";

const isDevelopment = env.NODE_ENV === "development";

export const parentLogger = pino({
  level: env.LOG_LEVEL ?? (isDevelopment ? "debug" : "info"),
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

export function getLogger(context: string, kind = "class") {
  return parentLogger.child({ [kind]: context });
}
