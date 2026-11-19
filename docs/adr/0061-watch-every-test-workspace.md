# Watch Every Test Workspace

## Status

Accepted

## Context

The root `test:watch` script must run the Vitest watchers of `apps/api`,
`apps/web`, and `packages/shared` together and stop them on Ctrl-C. The previous
command joined two watchers with a background `&`, so it waited only for the
foreground watcher and never watched the shared suite.

Vitest 4 enables watch mode only when `process.stdin.isTTY` is true and CI is
not set. Bun's `run --filter` runner gives its child scripts a non-TTY stdin
because it pipes output to prefix each line, so a bare `vitest` in a workspace
script would run once and exit under the root command. A plain shell `&`
background job has the same problem: the non-interactive shell gives it
`/dev/null` as stdin.

## Decision

The root `test:watch` script runs `bun run --filter '*' test:watch`. Bun starts
every workspace watcher concurrently, waits for all of them, propagates a
non-zero exit, and keeps them in the root process group so terminal Ctrl-C
reaches all of them. Every participating workspace script passes `--watch`
explicitly (`vitest --watch`), so watch mode does not depend on the child's
stdin being a TTY. The root script still runs
`bun --filter @gymos/api db:generate` first, as ADR-0045 requires.

## Consequences

- `bun run test:watch` watches the API, web, and shared suites and exits
  cleanly on Ctrl-C.
- Because the filter runner pipes stdin, Vitest's keyboard shortcuts (`h`, `q`)
  are not available; Ctrl-C is the way to stop the watchers.
- Output lines are prefixed with the workspace name.
- A future workspace must define `test:watch` to be included; packages without
  the script are skipped silently.
- No new dependency and no process manager.
