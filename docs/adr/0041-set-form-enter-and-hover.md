# Set Form Enter Submission and Guarded Hover

## Status

Accepted

## Context

The inline set form (ADR-0029) places Reps before Weight and shows the exercise default as
the weight placeholder (ADR-0030, ADR-0039). Pressing Enter in the empty weight field
accepted the placeholder but moved focus to Reps, which comes before Weight, so focus
jumped backwards in the keyboard order. On touch devices, the primary button kept its
hover color after a tap because the hover rule also applied to the emulated hover state
of a touch.

## Decision

- Enter in the weight field submits the set. With an empty weight field and a default,
  the keypress fills the default into the field before submitting; without a default, the
  form's normal constraint validation applies.
- Enter does not move focus back to Reps after submitting; focus stays in the weight
  field. Interactive validation may still focus the first invalid field, including Reps.
- The keyboard order stays Reps → Weight → Add set.
- Hover styles apply only inside `@media (hover: hover) and (pointer: fine)`, so touch
  devices never see a sticky hover state.
- This replaces the Enter rule of ADR-0030; ADR-0039's reference to it is updated. The
  placeholder and default rules are otherwise unchanged.

## Consequences

- Logging a set with a default weight takes one keypress, and focus stays in the weight
  field while the set is submitted.
- Enter no longer offers a quick way back to Reps; keyboard users can Shift+Tab instead.
- Mouse and trackpad users keep the hover color; touch taps no longer leave the button
  in its hover color.
- Future hover rules must be placed inside the same media query.
