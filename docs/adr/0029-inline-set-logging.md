# Inline Set Logging in Exercise Cards

## Status

Accepted

## Context

The session screen renders one card per plan exercise and a separate global "Log a set"
form with an exercise selector. Logging therefore requires leaving the exercise card,
re-selecting the exercise, and losing the card context. Free sessions show no card at all
until a set is logged. The API already accepts a set for any exercise in the session's
user scope, and ADR-0019 requires every logged set to stay visible.

## Decision

- Every plan exercise card contains its own set form (weight, reps, optional RPE). The
  form is prefilled from that exercise's defaults and submits for the card's exercise;
  the exercise cannot be changed inside the form.
- The global set form is removed.
- Free sessions use the same card model. A free session renders one card per exercise
  that has a logged set, plus one card per exercise added through an "Add exercise"
  control. Added exercises are view state and are deduplicated against logged sets.
- Sets for exercises outside the plan stay visible in read-only cards (ADR-0019).
- A planned card collapses automatically once its logged set count reaches `targetSets`
  and shows a visible done state; every card has a manual expand/collapse toggle that
  overrides the automatic behavior. Collapsing hides the set form but never removes the
  card or its sets (ADR-0019).
- Free and ad-hoc cards have no target and collapse only when the user toggles them.
- A single pending flag still disables every set form, the add-exercise control, and the
  finish action. A failed log keeps the typed values and shows the error inside that
  card.
- Weight suggestions as grey placeholders are deferred to the separate change for #26.

## Consequences

- A set is logged without leaving its exercise card or re-selecting the exercise.
- The API and session contracts do not change.
- Planned sessions cannot create sets for exercises outside the plan from the UI; such
  sets remain display-only. Free sessions can, by adding an exercise card first.
- Adding a free-session exercise is not persisted by itself; after a reload, only
  exercises with logged sets reappear.
