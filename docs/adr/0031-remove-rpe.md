# Remove RPE from Set Logging

## Status

Accepted

## Context

The gym tracker logs weight and reps per set and allowed an optional RPE (rate of perceived
exertion, 1–10) on the set form (ADR-0029). Nothing consumes RPE: plans do not use it, no
analytics read it, and the session screen only renders it when present. The field adds a
third input to every set form and a nullable column to every stored set. When this decision
was made the database held one logged set and none with an RPE value.

## Decision

- The set form no longer shows an RPE input; a set is logged with weight and reps only.
- The session screen no longer renders RPE.
- `rpe` is removed from the create-set and logged-set contracts.
- The `rpe` column is dropped from `workout_sets` by a migration. Stored values are
  discarded; none exist in practice.
- Older clients that still send `rpe` keep working: body validation strips unknown keys and
  the value is ignored.

## Consequences

- Logging a set is faster, and the API, storage, and UI carry fewer fields.
- RPE can no longer be recorded. Reintroducing it needs a migration and a new form input.
- ADR-0029 and ADR-0030 mention the optional RPE field; this ADR replaces those parts.
