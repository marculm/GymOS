# Known Issues and Deferred Work

Last updated: 2026-11-08
Scope: Gym Tracker MVP on `refactor/ponytail`.

These are known, non-blocking issues. They do not affect the core flow: create a plan, start a workout, log sets, finish, and review history.

## Fixed during the architecture migration

- Nutrition and extractor routes return `501 Not Implemented` instead of fabricated data.
- Readiness checks the database; production logging no longer loads `pino-pretty`.
- Plan input is bounded to 50 exercises and cannot repeat an exercise; the exercise register owns the working sets, reps, and weight.
- Regression tests cover set/completion races and two-user isolation.
- API errors use RFC 9457 problem details; list endpoints are paginated.
- Missing or malformed JSON bodies return `400` instead of becoming `{}`.
- The seed provisions the configured `GYMOS_USER_EMAIL`, so a custom owner has a usable first run (ADR-0023).
- Write requests require `Content-Type: application/json`; a cross-site `text/plain` write returns `415` without writing (ADR-0015).

## Deferred from the final review

1. **No request timeout in the web client** — a hung API leaves the Gym tab in the loading state. Impact: no retry path until reload. Fix: `AbortController`/timeout and an error state.
2. **No exercise restore** — soft-deleted exercises are hidden from the register and cannot be restored in the UI; their names stay reserved by the unique constraint. Impact: an accidental delete needs database access to undo, and the name cannot be reused. Fix: restore action or allow name reuse after deletion (ADR-0024).
3. **Plan deleted while a session starts** — `startSession` reads the plan before the serializable insert; if the plan is deleted in between, the foreign-key insert fails with `P2003` and returns `500`. Impact: only reachable from two clients editing and starting at once. Fix: map `P2003` to a not-found or concurrent result.
4. **Plan form rows lack row context** — every plan row labels its exercise selector "Exercise"; screen-reader form navigation cannot tell which row the selector belongs to. Impact: multi-exercise plans are ambiguous to edit without sight. Fix: wrap each row in a fieldset whose legend names the selected exercise, or include the exercise name in the selector's accessible name.

## Deferred features

- A single root `.env` instead of the root/API duplication.
- Nutrition/mealprep slice.
- Text-first recipe extractor (needs its own ADR).

## Security and operations

- **No authentication.** ADR-0009 defines the single-user MVP; the API must not be exposed publicly without an access gate (reverse-proxy auth or an application login).
- **Tests need a seeded PostgreSQL.** They use a unique test user and clean up; CI provisions and seeds the database in `.github/workflows/ci.yml`.
- **The first deploy needs public GHCR packages and `DEPLOY_ENABLED=true`.** The repository is private, so the first push creates private packages; the deploy job is skipped until the variable is set, and then fails at the image pull until the packages are public. See `docs/deployment.md` steps 7 and 9.
- **The K3s/Tailscale deploy path is unverified** until the VM is provisioned. The manifests and deploy script are validated statically in CI (`kubeconform`, `actionlint`, `shellcheck`).
- **The metrics endpoint is not routed** by the ingress; `/prometheus` remains reachable only inside the cluster.
