# Known Issues and Deferred Work

Last updated: 2026-10-29
Scope: Gym Tracker MVP on `refactor/ponytail`.

These are known, non-blocking issues. They do not affect the core flow: create a plan, start a workout, log sets, finish, and review history.

## Fixed during the architecture migration

- Nutrition and extractor routes return `501 Not Implemented` instead of fabricated data.
- Readiness checks the database; production logging no longer loads `pino-pretty`.
- Plan input is bounded (50 exercises, 20 target sets, 100 target reps).
- Regression tests cover set/completion races and two-user isolation.
- API errors use RFC 9457 problem details; list endpoints are paginated.
- Missing or malformed JSON bodies return `400` instead of becoming `{}`.

## Deferred from the final review

1. **Duplicate exercises in a plan** — `CreateWorkoutPlanSchema` accepts the same `exerciseId` twice, and `SessionView` groups logged sets by exercise, so a duplicated plan row shows the same sets twice. Impact: misleading display, no data corruption. Fix: reject duplicates in the schema or model sets against a plan-exercise row.
2. **Inputs editable while a request is pending** — `SessionView` disables the buttons but not the exercise/weight/reps/RPE inputs. Impact: typed values can be cleared when a slow request succeeds. Fix: wrap the controls in a disabled fieldset.
3. **JSON-only request bodies** — handlers parse JSON with `c.req.json()`; missing or malformed bodies return `400`. The PWA always sends a JSON body (`{}` for bodyless session starts). Impact: non-browser callers must send `Content-Type` and a valid body. Fix: document the contract in the API docs.
4. **Custom `GYMOS_USER_EMAIL` is not seeded** — the seed only creates `demo@gymos.app`. Setting a different email makes `CurrentUserService` return 500 with a seed hint that does not create that user. Impact: first-run dead end for a custom owner. Fix: seed the configured email or document manual provisioning.
5. **No upper bounds on reps/weight** — the API accepts arbitrary positive integers; values above Prisma's 32-bit `Int` range produce a 500. Impact: extreme input errors. Fix: add sane maxima to the shared schemas.
6. **No request timeout in the web client** — a hung API leaves the Gym tab in the loading state. Impact: no retry path until reload. Fix: `AbortController`/timeout and an error state.
7. **Accessibility polish** — repeated "Start plan" buttons lack plan-specific accessible names, and error messages are not announced (`role="alert"`/`aria-live`). Impact: screen-reader ambiguity and silent errors. Fix: add plan names to button labels and live regions.
8. **`muscleGroup` cast** — `apps/api/src/modules/gym/repository/mapping.mts` casts the Prisma string to the shared enum without runtime validation. Impact: invalid seeded or externally written data could break the contract. Fix: validate at the boundary or handle unknown groups.

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
