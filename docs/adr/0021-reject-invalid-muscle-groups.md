# Reject Invalid Muscle Groups at the Repository Boundary

## Status

Accepted

## Context

`Exercise.muscleGroup` is stored as a free-form `String` in PostgreSQL, while the
shared `ExerciseSchema` restricts it to `chest`, `back`, `legs`, `shoulders`, `arms`,
and `core`. The repository mapping cast the database value to the enum without
validation, so invalid seeded or externally written data could reach clients and break
the API contract (previously tracked as known issue 8). ADR-0005 makes the shared
schemas the single contract; ADR-0015 defines the error model.

## Decision

- `toExercise` validates `muscleGroup` with `ExerciseSchema.shape.muscleGroup`.
- An invalid value throws `InvalidMuscleGroupError`, naming the exercise and the value.
- The response is rejected instead of falling back to a valid group. No neutral group
  exists, and a fallback would report false data while hiding the corruption.
- The error is not mapped in `app.onError`; it falls through to the generic `500`
  problem details and is logged server-side like other unhandled errors.

## Consequences

- Clients never receive a muscle group outside the shared contract.
- Invalid rows make the affected reads fail until the data is corrected. The seed is
  the only writer today, so this surfaces corruption instead of masking it.
- The seed and any future exercise writer must use the contract enum.
- The database still stores a plain string; validation happens on read.
