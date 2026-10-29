import { createMiddleware } from "hono/factory";
import { Counter, Histogram, collectDefaultMetrics } from "prom-client";

collectDefaultMetrics();

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status_code"],
});

const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status_code"],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const trackMetrics = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();

  const labels = {
    method: c.req.method,
    path: c.req.path,
    status_code: c.res.status,
  };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, (Date.now() - start) / 1000);
});
