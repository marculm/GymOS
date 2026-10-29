import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { paths } from "./config/paths.mts";
import { requestLogger } from "./logger/request-logger.mts";
import { responseTime } from "./logger/response-time.mts";
import { getLogger } from "./logger/logger.mts";
import { extractorModule } from "./modules/extractor/index.mts";
import { gymModule } from "./modules/gym/index.mts";
import { nutritionModule } from "./modules/nutrition/index.mts";

const logger = getLogger("app", "file");

export const app = new Hono();

app.use(responseTime, requestLogger);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  logger.error({ err }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

app.get(paths.health, (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "GymOS API",
  })
);

app.route(paths.gym, gymModule);
app.route(paths.nutrition, nutritionModule);
app.route(paths.extractor, extractorModule);
