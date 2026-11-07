# Derive Exercise Defaults from Recent Workouts

## Status

Accepted

## Context

After ADR-0038, plans store only exercise selection and order; the exercise register owns
the working values (`defaultSets`, `defaultReps`, `defaultWeightKg`) that plans and
sessions display. Those defaults were only edited by hand, so they diverged from the
weight actually lifted. The set form also used a separate weight-suggestion endpoint
(ADR-0030) that averaged the latest completed workout, while the register defaults stayed
stale.

## Decision

- Completing a session updates the defaults of every exercise that has sets in it, inside
  the same serializable completion transaction (ADR-0011).
- For each exercise, take all of its sets from the last two completed sessions of the
  current user that contain at least one set of it. A session without a set of the
  exercise does not count. Sessions are ordered by completion time, then start time.
- With a single completed session, use it. Without completed sets, keep the current
  defaults (and a missing `defaultWeightKg` stays missing).
- `defaultWeightKg` is the average of all set weights in those sessions, rounded to the
  nearest 0.5 kg.
- `defaultReps` is the average reps of the sets within 2.5 kg of the rounded weight,
  inclusive, rounded to the nearest integer. If no set is within that window, average all
  sets.
- `defaultSets` stays manual.
- `GET /api/gym/exercises/weight-suggestions` and the `WeightSuggestions` contract are
  removed. The set form's weight placeholder is the exercise's `defaultWeightKg`; the
  placeholder and Enter behavior of ADR-0030 remain, and reps stay unprefilled.
- After a session completes, the web app reloads the exercise and plan lists so the next
  session uses the new defaults and the plan targets derived from them (ADR-0038).

## Consequences

- The register defaults follow training automatically; no suggestion endpoint or client
  plumbing remains.
- The next workout's targets and weight placeholders reflect the completed session after
  one reload of the exercise and plan lists.
- Default weight and reps can change after every completed session. A manual edit to them
  is overwritten by the next completion; `defaultSets` is not.
- Completion scans the user's completed sets to group the last two sessions per exercise.
  That is acceptable at single-user scale; a per-exercise latest-two-sessions query
  becomes worthwhile if history grows considerably.
- ADR-0030 is superseded for the suggestion source and endpoint; its placeholder rules
  still apply.
