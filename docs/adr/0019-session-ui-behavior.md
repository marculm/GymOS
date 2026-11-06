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
- Every exercise card starts collapsed. The exercise name is the toggle; there is no
  separate show/hide control. The toggle is a native button with `aria-expanded` and
  `aria-controls`, so it works with a keyboard and assistive technology.
- A collapsed card shows the exercise name and, when it is done, a visible "Done" label.
  The target line and set summary are hidden, so every collapsed card has the same
  compact height.
- A planned exercise card auto-collapses when the number of logged sets reaches its
  target set count (`targetSets`, derived from the exercise's `defaultSets` in the
  exercise-driven plan model). Re-expanding a done card keeps it expanded while extra
  sets are logged; only a new transition to done collapses it again.
- Done cards use a muted background and muted text in addition to the "Done" label, so
  completion does not rely on color alone.
- Expanding a done card keeps the done state and its set form, so extra sets can still be
  logged. Free and ad-hoc exercises have no target, start collapsed, and are only toggled
  manually.

## Consequences

- No logged set is invisible, including sets for exercises outside the plan.
- A rare two-device race no longer loses a tap without feedback.
- The session screen remains the single place that groups sets by exercise; the API
  contract does not change.
- A long session no longer requires scrolling past finished exercises. A manual expansion
  made after the card is done stays in control while extra sets are logged, and the done
  state remains readable when the card is collapsed.
- A session opens as a compact list of exercise names; a set is logged after opening its
  card.
