# Known Issues and Deferred Work

Last updated: 2026-10-30
Scope: Gym Tracker MVP on `refactor/ponytail`.

These are known, non-blocking issues. They do not affect the core flow: create a plan, start a workout, log sets, finish, and review history.

## Fixed during the architecture migration

- Nutrition and extractor routes return `501 Not Implemented` instead of fabricated data.
- Readiness checks the database; production logging no longer loads `pino-pretty`.
- Plan input is bounded (50 exercises, 20 target sets, 100 target reps) and cannot repeat an exercise.
- Regression tests cover set/completion races and two-user isolation.
- API errors use RFC 9457 problem details; list endpoints are paginated.
- Missing or malformed JSON bodies return `400` instead of becoming `{}`.
- The seed provisions the configured `GYMOS_USER_EMAIL`, so a custom owner has a usable first run (ADR-0023).

## Deferred from the final review

1. **Inputs editable while a request is pending** — `SessionView` disables the buttons but not the exercise/weight/reps/RPE inputs. Impact: typed values can be cleared when a slow request succeeds. Fix: wrap the controls in a disabled fieldset.
2. **JSON-only request bodies** — handlers parse JSON with `c.req.json()`; missing or malformed bodies return `400`. The PWA always sends a JSON body (`{}` for bodyless session starts). Impact: non-browser callers must send `Content-Type` and a valid body. Fix: document the contract in the API docs.
3. **No request timeout in the web client** — a hung API leaves the Gym tab in the loading state. Impact: no retry path until reload. Fix: `AbortController`/timeout and an error state.
4. **Accessibility polish** — repeated "Start plan" buttons lack plan-specific accessible names, and error messages are not announced (`role="alert"`/`aria-live`). Impact: screen-reader ambiguity and silent errors. Fix: add plan names to button labels and live regions.
5. **No exercise restore** — soft-deleted exercises are hidden from the register and cannot be restored in the UI; their names stay reserved by the unique constraint. Impact: an accidental delete needs database access to undo, and the name cannot be reused. Fix: restore action or allow name reuse after deletion (ADR-0024).
6. **Plan deleted while a session starts** — `startSession` reads the plan before the serializable insert; if the plan is deleted in between, the foreign-key insert fails with `P2003` and returns `500`. Impact: only reachable from two clients editing and starting at once. Fix: map `P2003` to a not-found or concurrent result.

## Deferred features

- PWA icon assets (`apps/web/public/pwa-192x192.png`, `pwa-512x512.png`).
- A single root `.env` instead of the root/API duplication.
- Test-database isolation and CI.
- Dockerfiles and K3s manifests (ADR-0008).
- Nutrition/mealprep slice.
- Text-first recipe extractor (needs its own ADR).

## Security and operations

- **No authentication.** ADR-0009 defines the single-user MVP; the API must not be exposed publicly without an access gate (reverse-proxy auth or an application login).
- **Tests need a local seeded PostgreSQL.** They use a unique test user and clean up, but there is no CI test database yet.
