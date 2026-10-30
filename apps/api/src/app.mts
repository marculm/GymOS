import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { showRoutes } from "hono/dev";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { healthRouter } from "./admin/health-router.mts";
import { corsOptions } from "./config/cors.mts";
import { env } from "./config/env.mts";
import { paths } from "./config/paths.mts";
import { getLogger } from "./logger/logger.mts";
import { requestLogger } from "./logger/request-logger.mts";
import { responseTime } from "./logger/response-time.mts";
import { trackMetrics } from "./monitoring/prometheus-metrics.mts";
import { prometheusRouter } from "./monitoring/prometheus-router.mts";
import { extractorModule } from "./modules/extractor/index.mts";
import {
  ActiveSessionExistsError,
  ConcurrentUpdateError,
  DuplicateExerciseNameError,
  DuplicatePlanNameError,
  DuplicateSetError,
  NotFoundError,
  SessionCompletedError,
  UnknownExerciseError,
} from "./modules/gym/service/errors.mts";
import { gymModule } from "./modules/gym/index.mts";
import { nutritionModule } from "./modules/nutrition/index.mts";
import { createProblemDetails } from "./problem-details.mts";
import { CurrentUserNotFoundError } from "./security/errors.mts";

const logger = getLogger("app", "file");

export const app = new Hono();

app.use(secureHeaders());
app.use(cors(corsOptions));
app.use(async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "SAMEORIGIN");
  await next();
});
app.use(compress());
app.use(trackMetrics);
app.use(responseTime, requestLogger);

app.get(paths.health, (c) => c.json({ status: "up" }));
app.route(paths.health, healthRouter);
app.route(paths.prometheus, prometheusRouter);
app.route(paths.gym, gymModule);
app.route(paths.nutrition, nutritionModule);
app.route(paths.extractor, extractorModule);

if (env.NODE_ENV === "development") {
  showRoutes(app, { verbose: true });
}

app.notFound((c) => createProblemDetails(c, 404, "Route not found"));

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return createProblemDetails(c, 422, err.issues);
  }
  if (err instanceof SyntaxError) {
    return createProblemDetails(c, 400, "Invalid JSON body");
  }
  if (err instanceof NotFoundError) {
    return createProblemDetails(c, 404, err.message);
  }
  if (err instanceof ActiveSessionExistsError) {
    return createProblemDetails(c, 409, err.message);
  }
  if (err instanceof SessionCompletedError) {
    return createProblemDetails(c, 409, err.message);
  }
  if (err instanceof DuplicateSetError) {
    return createProblemDetails(c, 409, err.message);
  }
  if (err instanceof DuplicatePlanNameError) {
    return createProblemDetails(c, 409, err.message);
  }
  if (err instanceof DuplicateExerciseNameError) {
    return createProblemDetails(c, 409, err.message);
  }
  if (err instanceof ConcurrentUpdateError) {
    return createProblemDetails(c, 409, err.message);
  }
  if (err instanceof UnknownExerciseError) {
    return createProblemDetails(c, 422, err.message);
  }
  if (err instanceof CurrentUserNotFoundError) {
    return createProblemDetails(c, 500, err.message);
  }

  logger.error({ err }, "Unhandled error");
  return createProblemDetails(c, 500, "Internal server error");
});
