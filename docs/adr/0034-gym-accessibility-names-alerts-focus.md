# Gym Accessibility Names, Alerts, and Focus

## Status

Accepted

## Context

The Gym flow has three accessibility gaps (known issue 3):

- The plan list renders one "Start plan" button per plan, so screen-reader and voice
  users cannot tell the actions apart by name.
- Several error messages render as plain text: the top-level load error, the plan form
  error, and the exercise register error. Screen readers only discover them if the user
  navigates there.
- The start screen and the session screen replace each other. Starting a session destroys
  the start button that had focus, and finishing destroys the finish button, so focus
  falls to the document body and the new context is not announced.

The other Gym errors, the picker, and the history and progress sections already use
`role="alert"`.

## Decision

- Each plan card's primary action uses visible text `Start <plan name>`. The visible
  label and the accessible name are the same and include the plan name.
- Every Gym error renders in a `role="alert"` element, which is an implicit assertive
  live region. This covers the top-level load error, plan form, exercise register,
  session, picker, history, and progress.
- Starting a session moves focus to the session heading. Finishing moves focus to the
  next-workout heading, or to the "No workout scheduled" heading when the rotation is
  empty. Both headings are focusable targets (`tabindex="-1"`).
- Focus moves only after the new view has rendered (`await tick`) and only when the
  action succeeded. Failure paths keep focus on the control the user used and announce
  the error instead.
- Initial page loads and direct navigation do not move focus.
- Component tests assert the plan-specific button names, the alert roles, and the focus
  transfer after starting and finishing a session.

## Consequences

- Screen-reader and voice users can distinguish plan start actions and hear errors
  without a page reload.
- Focus changes are tied to user actions and always land on a heading that names the new
  context.
- Plan start buttons show the plan name instead of the generic "Start plan", so long
  names make longer buttons.
- No API, shared contract, or database change.
