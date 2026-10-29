# Runtime Configuration and Observability

## Status

Accepted

## Context

Configuration values are currently read from `process.env` in several files, the request
logger is inline in the server entry point, `/health` reports `ok` without checking the
database, and there are no metrics. The logger loads `pino-pretty` whenever
`NODE_ENV !== "production"`, which can break a production install when `NODE_ENV` is
unset. The target architecture defines a single configuration module and a consistent
observability layer.

## Decision

### Configuration

- `config/env.mts` is the single source of environment values. It parses `process.env`
  once with Zod and fails at startup on invalid values:
  `NODE_ENV`, `PORT`, `DATABASE_URL`, `GYMOS_USER_EMAIL`, `LOG_LEVEL`, `CORS_ORIGINS`.
- `config/app.mts` holds typed runtime settings such as pagination defaults.
- `config/paths.mts` centralizes route prefixes.
- `config/cors.mts` holds CORS options derived from `CORS_ORIGINS`.
- `config/server.mts` holds the port, host, and `NODE_ENV`.
- `config/prisma-client.mts` owns the Prisma client, `connectDB`, `disconnectDB`, and
  the `globalThis` cache for `bun --watch`.
- No other module reads `process.env` directly.
- TOML configuration is not used. Environment variables are the single configuration
  source.
- TLS is terminated by the reverse proxy/ingress (ADR-0008). The API does not load
  certificates.

### Logging

- `logger/logger.mts` builds the parent Pino logger and exposes
  `getLogger(context, kind = "class")` for child loggers.
- Logs go to stdout. Containers and orchestrators collect them; no log file is written.
- `pino-pretty` is enabled only when `NODE_ENV === "development"`. Production does not
  load development dependencies.
- `logger/request-logger.mts` logs method and URL.
- `logger/response-time.mts` logs duration and status and sets `X-Response-Time`.

### Middleware

The application registers, in order: `secureHeaders`, `cors`, custom security headers
(`X-Content-Type-Options`, `X-Frame-Options`), `compress`, Prometheus metrics,
`responseTime`, `requestLogger`, then routes.

### Health

- `GET /health/liveness` returns `{ "status": "up" }`.
- `GET /health/readiness` runs a cheap Prisma query (`prisma.user.count()`) and returns
  `503` problem details when the database is unavailable. Raw SQL is not used
  (ADR-0007).
- `GET /health` is an alias for liveness.

### Metrics

- `monitoring/prometheus-metrics.mts` registers default metrics, an
  `http_requests_total` counter, an `http_request_duration_seconds` histogram, and the
  `trackMetrics` middleware.
- `monitoring/prometheus-router.mts` serves `GET /prometheus`.
- The endpoint is unauthenticated. It must remain on a private network or be blocked at
  the reverse proxy before public exposure (ADR-0009).

### Not adopted

- TOML resources.
- File-based logging.
- Application-level TLS.
- A development HTTP router for database reloads.
- Mail notifications.
- Keycloak, JWT, and role-based access (ADR-0009).

## Consequences

- Startup fails fast on invalid or missing configuration.
- Production logging cannot fail because of a missing development dependency.
- Readiness reflects database availability, so orchestrators can remove a broken
  instance from rotation.
- Metrics and health endpoints are available for local and container monitoring.
- The metrics endpoint is a deliberate, documented exposure that must be protected at
  the deployment boundary.
