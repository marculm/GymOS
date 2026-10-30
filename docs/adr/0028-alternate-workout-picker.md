# Alternate Workout Picker

## Status

Accepted

## Context

The start screen's secondary "Other workout" action started an ad-hoc session directly.
Users also need to deviate to a different plan without going through management, and the
previous redesign deferred the alternate picker. The rotation already treats any
completed planned session as a deviation and free sessions as ignored (ADR-0026), so the
picker only needs to choose what to start.

## Decision

- "Other workout" opens a modal picker; it never starts a session by itself.
- The picker lists every plan plus a free-workout option. Selecting a plan starts a
  planned session with that plan; the rotation suggestion continues from that plan's
  position. Selecting the free-workout option starts an ad-hoc session, which never
  advances the rotation.
- The picker is a native `<dialog>` opened modally, so focus stays inside, Escape
  cancels, and focus returns to the trigger. It also has an explicit Cancel action.
- Choices are disabled while a start request is pending, with a status message; a
  failed start is shown inside the picker with an alert and the picker stays open.
- The trigger remains a small ghost action below the primary next-workout card, and the
  start screen keeps its hierarchy from ADR-0027.
- No API changes: plan-or-free sessions and deviation rules already exist.

## Consequences

- Users can deviate from the rotation in two taps without cluttering the primary CTA.
- Free workouts remain possible but secondary and still never advance the rotation.
- The picker duplicates the plans already loaded on the start screen; it does not fetch
  or paginate on its own.
