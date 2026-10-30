# Workout Rotation and Next-Workout Suggestion

## Status

Accepted

## Context

Plans are reusable templates, but nothing tells the user which plan comes next. Users
follow an ordered rotation (for example Push Fullbody, Pull Fullbody) and expect the app
to suggest the following plan after each completed workout. Free workouts and manual
deviations must not corrupt that rotation, and deleted plans must disappear from it.

## Decision

- A rotation is an ordered list of a user's plans, stored as `WorkoutRotationItem` rows
  (`userId`, `planId`, `position`). There is no separate rotation entity: one rotation
  per user is implicit, with unique `(userId, position)` and `(userId, planId)`.
- `GET /api/gym/rotation` returns `{ plans, nextPlanId }`. `PUT /api/gym/rotation`
  replaces the whole ordered list from a body of plan IDs, allowing an empty list to
  clear the rotation. Both routes are owner-scoped.
- The suggestion starts from the most recently completed session that has a `planId`.
  The next plan is the rotation item after that plan, wrapping after the last item.
  With no such session, or when the last planned session's plan is no longer in the
  rotation, the suggestion is the first rotation item. An empty rotation has no
  suggestion.
- Free workouts have no `planId` and are ignored by the suggestion query, so they never
  advance the rotation. Starting any plan manually counts as that plan's position, so
  deviations set the next suggestion from the deviated plan.
- Replacing a rotation validates that every plan ID exists and belongs to the user,
  rejects duplicates, and rejects unknown plans with `422`. The replacement is atomic.
- Deleting a plan cascades to its rotation items via `onDelete: Cascade`. The remaining
  order stays valid because positions are only an ordering key.
- Plan editing is unaffected: rotation items reference plans, not plan snapshots.
- The rotation UI lives in a "Training rotation" section of the gym view and shows the
  next suggestion with a start action plus add, remove, and move controls.

## Consequences

- Suggestions follow history and manual deviations without storing rotation state on
  sessions.
- Changing the rotation changes only future suggestions; past workouts keep their plan
  reference and title.
- Because the rotation stores plan references, renaming or retargeting a plan updates
  what the rotation shows.
- There is no rotation history or versioning.
