# Workout History and Progress Analytics

## Status

Accepted

## Context

ADR-0027 removed recent workouts from the Gym start screen and deferred history to a
follow-up. The API already lists completed sessions as a page with `planId`, `from`, and
`to` filters and serves one session with its sets. The web app uses neither, so a past
workout cannot be reopened and history stops at whatever the UI would show.

Logged sets also hold enough data for progress analytics: exercise, reps, weight, and
time. Nothing consumes it yet, and the session list summary carries only `totalSets`.
History and analytics are read-only; no new storage is needed.

## Decision

- History sits at the bottom of the Gym start screen, below the "My training plan"
  section. It lists completed sessions, 10 per page, with a "Load more" action.
- History filters mirror the API: a plan dropdown and a `from`/`to` date range. Date
  inputs cover whole local days. Changing any filter restarts the list at page 1.
- Opening a session loads `GET /api/gym/sessions/:id` lazily and expands it inline. The
  detail shows sets grouped by exercise, start and finish times, and the duration. The
  groups keep the plan's exercise order when that plan still exists. Logged sets carry
  `exerciseName`, so sets for soft-deleted exercises stay readable.
- History does not show plan targets for past workouts. After the exercise-driven plan
  model (ADR-0038), plan targets are the current exercise defaults, not the targets the
  session was planned with.
- A new read endpoint `GET /api/gym/progress` returns:
  - `personalRecords`: one entry per exercise with the heaviest logged set, tie-broken by
    more reps and then by the newest set, including sets of soft-deleted exercises.
  - `volume`: one entry per completed session with `totalVolumeKg = Σ(reps × weightKg)`,
    newest first.
- The read service aggregates both from the user's completed sessions. No table, column,
  or migration is added.
- The Gym start screen renders a progress section before history: personal records as
  rows and per-workout volume as proportional bars for recent workouts.
- History and progress are not shown while a session is active; the session screen still
  replaces the start screen.

## Consequences

- Every past workout can be reopened, and history is browsable beyond the first page.
- Filters reuse the existing API contract; no endpoint for history is added.
- Personal records are best-set records, not estimated one-rep maxima. Bodyweight sets
  (`0 kg`) can only set a record through reps.
- The progress endpoint loads every completed set of the user per request. That is
  acceptable at single-user scale; SQL aggregation becomes worthwhile if history grows
  considerably.
- Deleting a plan clears the plan association of its past sessions (`planId` becomes
  `null`), so their logged sets remain readable but the plan and its exercise order are
  gone.
