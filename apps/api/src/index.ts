import { Hono } from "hono";
import { logger } from "./lib/logger.ts";
import { gymModule } from "./modules/gym/index.ts";
import { nutritionModule } from "./modules/nutrition/index.ts";
import { extractorModule } from "./modules/extractor/index.ts";

export const app = new Hono();

// Pino Request Logger Middleware
app.use("*", async (c, next) => {
  const start = performance.now();
  const { method, path } = c.req;

  await next();

  const durationMs = (performance.now() - start).toFixed(2);
  const status = c.res.status;

  logger.info({
    method,
    path,
    status,
    durationMs: `${durationMs}ms`,
  }, `${method} ${path} -> ${status} (${durationMs}ms)`);
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "GymOS API",
  });
});

// Feature modules
app.route("/api/gym", gymModule);
app.route("/api/nutrition", nutritionModule);
app.route("/api/extractor", extractorModule);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};

if (import.meta.main) {
  logger.info(`🚀 GymOS API Server running on http://localhost:${port}`);
}
