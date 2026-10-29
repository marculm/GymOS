import { createMiddleware } from "hono/factory";
import { getLogger } from "./logger.mts";

const logger = getLogger("responseTime", "func");

export const responseTime = createMiddleware(async (c, next) => {
  const start = performance.now();
  await next();
  const duration = Math.round(performance.now() - start);
  c.res.headers.set("X-Response-Time", `${duration}ms`);
  logger.debug("Response time: %d ms, %d", duration, c.res.status);
});
