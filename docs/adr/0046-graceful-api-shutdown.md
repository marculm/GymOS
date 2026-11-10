# Graceful API Shutdown

## Status

Accepted

## Context

Kubernetes sends `SIGTERM` to the API pod during a rolling update. The API used to
disconnect Prisma and call `process.exit(0)` immediately, without stopping `Bun.serve`.
Requests already accepted by the server were cut off: a set log could fail, and a retry
could then duplicate it. The transaction rolls back, so there is no corruption, but the
user sees a failed request.

Prisma must not disconnect while a request still uses the database. Endpoint removal also
propagates asynchronously, so a pod can still receive new connections after `SIGTERM`.

## Decision

- The shutdown handler stops the HTTP server before disconnecting Prisma. `Bun.serve`'s
  `stop()` stops accepting new connections and resolves after in-flight requests finish.
- The handler runs its teardown once. Repeated `SIGINT` or `SIGTERM` signals return
  without disconnecting Prisma again or exiting early.
- The API Deployment adds a five-second `preStop` sleep, so endpoint removal propagates
  before the listener closes.

## Consequences

- In-flight requests finish during a rolling update; Prisma disconnects only after the
  server has drained.
- A terminating pod waits five seconds before shutdown starts, within the default
  30-second termination grace period.
- A request that outlives the grace period still ends with `SIGKILL`.
