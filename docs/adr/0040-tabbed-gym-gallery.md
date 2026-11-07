# Tabbed Gym Gallery

## Status

Accepted

## Context

The Gym start screen kept the rotation, plans, and the exercise register inside one
collapsible "My training plan" section, and history behind a separate Show/Hide toggle.
Every setup task needed the global Manage toggle, and the three areas could not be
browsed independently. Issue #72 asks for separate gallery tabs below the next-workout
card while keeping the primary start action prominent.

## Decision

- The next-workout card and the "Other workout" action stay above the browsing area.
- Three tabs below them: Exercises, Plans, and Workouts. Exercises is selected by
  default.
- The tabs follow the WAI-ARIA tabs pattern: `tablist`, `tab`, and `tabpanel` roles,
  `aria-selected`, `aria-controls`, and a roving tabindex. Left and Right arrows move
  and activate the next tab with wrap-around; Home and End jump to the first and last
  tab.
- Panel content mounts when selected; the three panel containers stay in the DOM so
  every tab's `aria-controls` always resolves. Switching away discards the panel's
  transient state, including unsaved create/edit form input, so the history and
  progress requests only run while the Workouts tab is open and reopening it loads the
  first page again.
- Exercises shows a card grid with name, muscle group, defaults, and edit/delete actions,
  with "New exercise" at the bottom.
- Plans shows the rotation order controls, plan cards with name, exercise count, and
  start/edit/delete actions, and "New plan" at the bottom.
- Workouts shows the Progress view followed by history cards with date, plan, duration,
  and set count, the plan and date filters, and the inline session detail. The
  Show/Hide toggle is removed.
- The empty next-workout card's "Set up training plan" action selects the Plans tab and
  focuses its tab.

## Consequences

- Each area is one tab away and no longer hidden behind one global Manage toggle.
- History and progress requests are lazy and repeat when the Workouts tab is reopened.
- The active session still replaces the whole start screen until it is completed.
- ADR-0033's collapsed history section is superseded by the Workouts tab, and the
  collapsible management section in ADR-0027 is replaced by the gallery tabs. This
  refines ADR-0032's placement: history moves into the Workouts tab, while its content
  and analytics decisions still apply.
- The API, shared contracts, and database do not change.
