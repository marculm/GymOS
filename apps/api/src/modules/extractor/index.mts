import { Hono } from "hono";
import { logger } from "../../lib/logger.mts";

const extractorLogger = logger.child({ module: "extractor" });

export const extractorModule = new Hono();

extractorModule.get("/status", (c) => {
  extractorLogger.debug("Checking extractor worker status");
  return c.json({
    status: "idle",
    queueSize: 0,
  });
});
