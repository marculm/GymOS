# Known Issues and Deferred Work

Last updated: 2026-11-20
Scope: GymOS (Gym Tracker and Nutrition) on `main`.

These are known, non-blocking issues. They do not affect the core flow: create a plan, start a workout, log sets, finish, review history, log meals, and manage recipes.

## Fixed

- Nutrition routes are implemented (ADR-0057, ADR-0058, ADR-0060, ADR-0062); the extractor returns `501 Not Implemented` instead of fabricated data.
- Readiness checks the database; production logging no longer loads `pino-pretty`.
- Plan input is bounded to 50 exercises and cannot repeat an exercise; the exercise register owns the working sets, reps, and weight.
- Regression tests cover set/completion races and two-user isolation.
- API errors use RFC 9457 problem details; gym list endpoints are paginated.
- Missing or malformed JSON bodies return `400` instead of becoming `{}`.
- The seed provisions the configured `GYMOS_USER_EMAIL`, so a custom owner has a usable first run (ADR-0023).
- POST and PUT requests require `Content-Type: application/json`; a cross-site `text/plain` write returns `415` without writing (ADR-0015).
- The web app runs on SvelteKit 3 as a static SPA (ADR-0054).
- All workspaces run on Vitest, and `bun run test:watch` watches the API, web, and shared suites (ADR-0018, ADR-0061).
- Configuration uses a single root `.env`.

## Deferred from the final review

1. **No exercise restore** — soft-deleted exercises are hidden from the register and cannot be restored in the UI; their names stay reserved by the unique constraint. Impact: an accidental delete needs database access to undo, and the name cannot be reused. Fix: restore action or allow name reuse after deletion (ADR-0024).
2. **Plan deleted while a session starts** — `startSession` reads the plan before the serializable insert; if the plan is deleted in between, the foreign-key insert fails with `P2003` and returns `500`. Impact: only reachable from two clients editing and starting at once. Fix: map `P2003` to a not-found or concurrent result.
3. **Plan form rows lack row context** — every plan row labels its exercise selector "Exercise"; screen-reader form navigation cannot tell which row the selector belongs to. Impact: multi-exercise plans are ambiguous to edit without sight. Fix: wrap each row in a fieldset whose legend names the selected exercise, or include the exercise name in the selector's accessible name.

## Deferred features

- Mealprep slice.
- The URL recipe extractor (needs its own ADR).

## Build and test tooling

- **API integration tests need a migrated PostgreSQL.** They create a unique test user and clean up. Service unit tests and the web and shared suites run without a database; CI migrates and seeds the database in `.github/workflows/ci.yml`.
- **`bun run test:watch` has no Vitest keyboard shortcuts.** Bun's filter runner pipes stdin, so press Ctrl-C to stop all watchers (ADR-0061).
- **The PWA build logs a `transform_index_html_unsupported` warning.** SvelteKit 3 no longer runs `transformIndexHtml`; the app links the manifest and registers the service worker itself, so the warning is accepted (ADR-0054).
- **The root `glob` and `minimatch` overrides are temporary.** They patch `workbox-build`; remove them when it catches up (ADR-0054).
- **A first visit to a deep link does not register the service worker.** The generated registration resolves `./sw.js` against the current URL, so the PWA is not installable until the app is opened at a top-level route and reloaded (#164).

## Security and operations

- **No authentication.** ADR-0009 defines the single-user MVP; the API must not be exposed publicly without an access gate (reverse-proxy auth or an application login).
- **The metrics endpoint is not routed** by the ingress; `/prometheus` remains reachable only inside the cluster.
- **Web push needs HTTPS and an installed PWA on iOS.** iOS 16.4+ requires the app on the
  Home Screen, and the browser push service may deliver a few seconds late. Without
  permission or support the in-app rest timer is the only notification (ADR-0044).
- **Rest timer pushes assume one API replica.** The scheduler runs inside the API
  process; multiple replicas would send duplicate notifications (ADR-0044).
