# Collapsed History Section

## Status

Superseded by ADR-0040

## Context

ADR-0032 put history at the bottom of the Gym start screen, but it renders expanded:
the filters and the first page of sessions appear as soon as the screen loads, and the
history request is sent immediately. Issue #27 requires history to be secondary and
collapsed by default so the start screen stays focused on the next workout. Session
detail, filters, pagination, progress analytics, and the loading, empty, and error states
already exist (ADR-0032); this decision changes when history is visible and loaded, not
its content.

## Decision

- History sits at the bottom of the Gym start screen under a "History" heading with a
  Show/Hide toggle, collapsed by default. The toggle follows the "My training plan"
  pattern: `aria-expanded`, `aria-controls`, and a labelled button.
- The History list mounts on first expansion, so no session-list request is sent while
  the section has never been opened. Hiding it afterward keeps the loaded pages and
  filters, and showing it again does not refetch.
- Expanding shows the existing plan and date filters, load-more list, and per-session
  detail from ADR-0032. The loading, empty, error, and retry states render inside the
  section.
- The Gym screen owns the section heading and toggle; the History component renders only
  the filters and list.
- Progress analytics stays a separate section above history and is not part of the
  collapse.

## Consequences

- The start screen leads with the next workout, and opening history costs no request
  until it is requested.
- History is still one tap away. The collapsed state is view state: it resets on reload
  or when the Gym view remounts (for example, switching tabs), not when a workout starts
  or finishes.
- The API, shared contracts, and database do not change.
- Progress analytics remains visible above history; it is compact and was delivered
  separately (ADR-0032).
