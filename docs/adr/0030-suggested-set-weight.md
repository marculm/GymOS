# Suggested Set Weight as a Placeholder

## Status

Superseded by ADR-0039

## Context

The inline set form (ADR-0029) prefills weight and reps from the exercise's defaults, so the
inputs hold values that are submitted unless the user overwrites them. Exercise defaults
quickly diverge from the weight actually lifted, and many exercises are created without a
default weight at all, so the weight input starts empty even for exercises trained for
months. The data for a better hint already exists: completed sessions store every set with
its exercise and weight. This ADR replaces the prefill sentence of ADR-0029.

## Decision

- The weight input is always empty and shows the suggestion as a grey placeholder.
- The suggestion is the average weight of all sets of that exercise in the most recent
  completed workout containing any set of it, rounded to the nearest 0.5 kg. Workouts are
  ordered by completion time, then start time.
- Without history the suggestion falls back to the exercise's `defaultWeightKg`; without
  either, the placeholder stays empty.
- Reps and RPE are neither prefilled nor suggested; both inputs start empty.
- Suggestions are computed per exercise, never across a muscle group, and are returned by
  `GET /api/gym/exercises/weight-suggestions` as a map from exercise ID to rounded
  kilograms. The query is scoped to the current user and includes soft-deleted exercises,
  whose logged history stays meaningful.
- The web app loads suggestions with the gym data and refreshes them after a workout is
  completed. Every exercise card, planned or free, passes its own suggestion to the set
  form.
- The placeholder is a hint only: it never submits a set by itself, and the form needs
  weight and reps in its fields before logging.
- Pressing Enter in the empty weight field accepts the placeholder into the field and moves
  focus to Reps; the keypress does not submit the set. Typing a weight overrides the
  suggestion. Without a suggestion, Enter keeps the form's normal behavior.

## Consequences

- The hint follows real training data and needs no schema change or migration.
- Logging a set requires filling weight and reps every time; defaults are no longer
  submitted.
- Suggestions update when a workout is completed, not while it is in progress.
- The read endpoint returns one entry per exercise with completed history, and its query
  scans the user's completed sets. That is acceptable at single-user scale; a per-exercise
  latest-session lookup becomes worthwhile if history grows considerably.
