import { createMiddleware } from "hono/factory";
import { getLogger } from "./logger.mts";

const logger = getLogger("requestLogger", "func");

export const requestLogger = createMiddleware(async (c, next) => {
  logger.debug("method=%s, url=%s", c.req.method, c.req.url);
  await next();
});
