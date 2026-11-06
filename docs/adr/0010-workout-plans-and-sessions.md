# Workout Plans as Templates and Sessions as Independent Records

## Status

Accepted

## Context

The gym tracker must show reusable training plans and let the user check off sets quickly during a workout. Users will eventually edit plans, but past workouts must remain an accurate record of what was actually performed. Sessions also need to support ad-hoc workouts that do not follow a plan.

## Decision

- `WorkoutPlan` and `WorkoutPlanExercise` store the exercise selection and order (`position`). Working sets, reps, and weight live on `Exercise` (ADR-0038).
- `WorkoutSession` optionally references a plan (`planId`, `onDelete: SetNull`). Sessions store their own title, start time, and completion time.
- Logged `WorkoutSet` rows are independent records. Editing or deleting a plan later must never rewrite past sessions.
- A user has at most one active session (`completedAt IS NULL`).
- Set numbers are assigned per exercise within a session, starting at 1, and enforced by a unique constraint.

## Consequences

- Workout history is stable without plan versioning.
- Plan editing and deletion can be added later without touching historical sets.
- Starting a plan session stores only the plan reference; the frontend reads targets from the current exercise defaults.
- Only one active session per user keeps the "resume workout" flow unambiguous.
