# Gym Start Screen Hierarchy

## Status

Accepted

## Context

The Gym tab stacked a prominent free-workout card, the rotation, every plan, the
exercise register, and recent workouts. Nothing was primary, and the next planned
workout competed with setup and maintenance controls. History is being moved to its own
section in a separate issue, and the alternate-workout picker is not built yet.

## Decision

- The start screen leads with the suggested next rotation workout: plan name,
  description, exercise count, and per-exercise targets, with one primary
  "Start workout" action.
- When the rotation has no suggestion, the card states that no workout is scheduled and
  offers one primary action that opens management.
- Free workouts stay reachable through a small secondary "Other workout" action. It
  opens the alternate-workout picker (ADR-0028), which offers every plan and a free
  session.
- Rotation management, plan management, and the exercise register are browsable below
  the primary card in gallery tabs (ADR-0040); no new bottom tab.
- Recent workouts are not shown on the start screen. A separate issue adds history to
  the Workouts tab (ADR-0032, ADR-0040).
- An active session still replaces the start screen until it is completed.
- The screen keeps the warm light theme and the existing single-column, mobile-first
  layout.

## Consequences

- The start screen has one obvious action: start the suggested workout.
- Setup and maintenance remain one tap away in the Plans and Exercises tabs without
  leaving the Gym flow.
- Ad-hoc workouts remain possible but visually secondary.
- History is temporarily unavailable in the UI until the follow-up issue lands.
