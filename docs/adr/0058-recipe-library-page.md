# Recipe Library Page

## Status

Accepted

## Context

Recipes were managed in Settings → Recipes (ADR-0057). The settings sheet is a flex
column, and the recipe form rendered inside a `group` card with `overflow: hidden`.
As a flex item the card shrank to the sheet height, so the lower half of the form was
clipped: ingredient rows were cut off, Save and Cancel were unreachable, and
validation errors rendered outside the visible area.

Recipes are used often — for cooking and for logging portions — while Settings is a
place for occasional configuration. Managing them there also hid the recipe library
behind a settings tree.

## Decision

Recipes get their own page at `/nutrition/recipes`, opened from an extra `Recipes`
button on the nutrition home. The page lists all saved recipes as a glossary, reuses
the existing cooking view and recipe form, and is the only place where recipes are
created, edited and deleted. The Settings entry is removed.

Adding an ingredient focuses the new row and scrolls it into view. Recipe entry stays
manual; AI-assisted adding is a later slice.

## Consequences

- The recipe form lives in a normally scrolling page, so tall content is never
  clipped by the settings layout.
- The nutrition home gains a third action, `Recipes`.
- Settings no longer duplicates the recipe list; one navigation path leads to the
  library.
- The recipe routes stay under `/nutrition`, so the nutrition space keeps ownership
  of its features and the existing API and data model are unchanged.
- The page's right swipe returns to the nutrition home, matching its visible back
  control; it is paused while a recipe form is open so a gesture cannot discard a
  draft.
