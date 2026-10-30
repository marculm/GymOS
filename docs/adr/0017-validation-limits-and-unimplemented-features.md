# Validation Limits and Unimplemented Feature Endpoints

## Status

Accepted

## Context

The gym API currently accepts unbounded plan input: a plan may contain an unlimited
number of exercises, and target sets and reps have no upper bound. The nutrition and
extractor modules return fixed demo values from real routes, so a client cannot tell
that the data is fabricated. The nutrition and recipe contracts and tables exist but are
not implemented.

## Decision

### Plan input limits

The shared workout schemas enforce:

- at most 50 exercises per plan;
- each exercise at most once per plan;
- `targetSets` at most 20;
- `targetReps` at most 100.

The plan form enforces the same limits so the UI and API agree. The API remains the
authority: invalid input is rejected with `422` problem details.

Numeric limits for logged sets (reps and weight) are defined in ADR-0022.

### Unimplemented features

- `GET /api/nutrition/summary` and `GET /api/extractor/status` return
  `501 Not Implemented` problem details.
- No endpoint returns fabricated data.
- The nutrition and recipe Zod schemas and the corresponding PostgreSQL tables stay in
  place until those slices are implemented.
- The module boundaries stay in place so the features can be added without restructuring
  the API.

## Consequences

- A client can distinguish an unimplemented feature from a working one.
- A single request cannot create a plan with thousands of exercises or render an
  unbounded plan.
- A plan cannot repeat an exercise, so the session screen does not show the same
  logged sets twice.
- The UI and API enforce the same limits.
- The nutrition contracts remain untested until the slice is built; they must be
  revisited when its requirements are defined.
