# Advance to the Next Open Exercise

## Status

Accepted

## Context

The workout pager shows one exercise at a time (ADR-0056). Logging a set appends it to
the current page; the page changes only through explicit navigation. After the set that
finishes an exercise, the user therefore taps Next even though the next open exercise is
already known and the rest timer is running.

## Decision

- After a successful set log, the pager advances to the first page after the current one
  whose logged sets are below its target set count. Pages that are already done are
  skipped.
- The decision uses the pre-log state: the view advances only when the current page was
  open before the log and the logged set reaches its target set count. An extra set on a
  page that was already done leaves the view in place.
- If no later page is open, the view stays on the current page, so Finish remains
  reachable. The pager never wraps to an earlier open exercise; Back and the switcher
  still reach it.
- A failed log stays on the current page and shows the existing error.
- The rule applies to plan exercises and to exercises added to a free workout, because
  both are pager pages. The target is identified by exercise, not by page position: a
  free exercise's first set moves its page into the session-set section, so a position
  captured before the log no longer points at the same exercise afterwards.
- The advance reuses `goToPage`, including its focus on the exercise heading. The rest
  timer starts as before, immediately after the successful log.

## Consequences

- Finishing an exercise needs no extra tap; the next open exercise is shown while the
  rest timer runs.
- Extra sets, a failed log, deletion, and editing never move the view.
- The last open exercise keeps the existing Finish action; skipping the remaining
  exercises stays a manual navigation choice.
