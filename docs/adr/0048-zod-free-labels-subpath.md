# Zod-free Labels Subpath

## Status

Accepted

## Context

The web app needs a few shared constants that are not schemas: the muscle-group list
and the duplicate-exercise and duplicate-rotation messages. They lived in
`packages/shared/src/schemas/workout.mts`, and the only public entry point was the
package barrel (`@gymos/shared`), which re-exports every Zod schema module. Any runtime
import from the barrel therefore evaluates the whole schema module graph, and the built
PWA shipped Zod even though the browser only needed the constants. ADR-0022 already
introduced the `@gymos/shared/limits` subpath for the same reason.

## Decision

Zod-free constants live in `packages/shared/src/labels.mts` and are exported as the
`@gymos/shared/labels` subpath, following the `./limits` pattern:

- `MUSCLE_GROUPS`, `DUPLICATE_EXERCISE_MESSAGE`, and
  `DUPLICATE_ROTATION_PLAN_MESSAGE` move out of the workout schema module.
- `workout.mts` imports `MUSCLE_GROUPS` from `labels.mts` for `MuscleGroupSchema`; the
  schema behavior is unchanged.
- The barrel still re-exports `labels.mts`, so API-side imports from `@gymos/shared`
  keep working.
- Web components import the constants from `@gymos/shared/labels`, never from the
  barrel.
- A new Zod-free constant belongs in `labels.mts` (or another dedicated subpath), not
  in a schema module that the web app imports at runtime.

## Consequences

- The web bundle no longer contains the Zod schemas or Zod runtime code; the built
  bundle drops by about 92 kB, from about 243 kB to about 151 kB minified.
- The browser and the API read the same constant values, so their messages and muscle
  groups cannot drift.
- Adding a subpath is a one-line `exports` entry in `packages/shared/package.json`.
- A runtime import from the open barrel still pulls in Zod; the rule above and the
  subpath keep that out of the web app.
