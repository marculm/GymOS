import { env } from "./env.mts";

export const corsOptions = {
  origin: env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  allowMethods: ["GET", "HEAD", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "If-Match", "If-None-Match"],
  exposedHeaders: ["Content-Type", "Location", "X-Response-Time"],
  maxAge: 86_400,
};
