# Session Screen Behavior

## Status

Accepted

## Context

The session screen renders one card per exercise in the session's plan. The API accepts
sets for any valid exercise, including exercises that are not part of the plan, so such a
set is stored and counted in history but never displayed. Separately, when starting a
session returns `409`, the screen reloads the active session; if another device finishes
that session in between, the reload returns no active session and the tap silently does
nothing.

## Decision

- The session screen displays every logged set. After the plan cards, it renders one card
  for each exercise that appears in `session.sets` but is not covered by the plan.
- When a start request returns `409`, the screen reloads the active session. If an active
  session exists, it is shown. If none exists, the screen retries the start once; if the
  retry fails, it shows an error message instead of silently doing nothing.
- The set form and the controls that trigger a request are disabled while a request is
  pending.
- A planned exercise card auto-collapses when the number of logged sets reaches its
  `targetSets`. The collapsed card shows a compact summary and a visible "Done" label in
  addition to muted styling, so completion does not rely on color alone.
- Every card, planned or free, has an accessible expand/collapse toggle with
  `aria-expanded` and `aria-controls`. A manual toggle overrides the automatic behavior
  for that card: an expanded card stays expanded when more sets are logged, including
  sets beyond the target, and a manually collapsed card stays collapsed until it is
  expanded again.
- Expanding a done card keeps the done state and its set form, so extra sets can still be
  logged. Free and ad-hoc exercises have no target and are only manually collapsible.

## Consequences

- No logged set is invisible, including sets for exercises outside the plan.
- A rare two-device race no longer loses a tap without feedback.
- The session screen remains the single place that groups sets by exercise; the API
  contract does not change.
- A long session no longer requires scrolling past finished exercises. The manual toggle
  stays in control after the first user interaction, and the done state remains readable
  when the card is collapsed.
