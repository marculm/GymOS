import { Hono } from "hono";
import { getLogger } from "../../logger/logger.mts";

const extractorLogger = getLogger("extractor");

export const extractorModule = new Hono();

extractorModule.get("/status", (c) => {
  extractorLogger.debug("Checking extractor worker status");
  return c.json({
    status: "idle",
    queueSize: 0,
  });
});
