# Trim Plan Names and Session Titles

## Status

Accepted

## Context

`CreateExerciseSchema` already normalizes its `name` with `.trim().min(1)`, but
`CreateWorkoutPlanSchema.name` and `CreateWorkoutSessionSchema.title` only used
`.min(1)`. A direct API call could therefore create a plan named `   ` or a session
with a whitespace-only title. The API maps a Zod failure to a `422 Unprocessable
Content`, yet whitespace passed validation, and the web UI rendered the resulting
blank card or heading.

The create schemas parse every write at the API boundary, so they are the single place
to enforce the rule. The web plan form already trims the name and disables submit for a
blank one; the web app does not send session titles at all.

## Decision

`CreateWorkoutPlanSchema.name` and `CreateWorkoutSessionSchema.title` use
`.trim().min(1)` and keep their existing `max(100)` bound. The response schemas
(`WorkoutPlanSchema`, `WorkoutSessionDetailSchema`, and the history schemas) stay
unchanged: they describe stored data, and normalizing on read would transform existing
records rather than reject bad writes. This follows the existing exercise-name rule.

## Consequences

- A plan name or session title that is empty or only whitespace is rejected with `422`.
- Values that surround a real name with whitespace are stored trimmed, so the browser
  and the API converge on the same value.
- Values written before this change are not repaired; a whitespace-only name created
  by an old direct API call still renders blank and would need a data migration.
- No web change is required: the plan form already sends a trimmed name, and session
  titles are not created from the web UI.
