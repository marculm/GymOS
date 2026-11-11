# In-Place Gallery Form Editing

## Status

Accepted

## Context

The Plans and Exercises gallery tabs rendered one shared create/edit form below the
card grid. Editing a card and creating an item both moved attention away from the card
the form changed. SessionView and History already render their edit forms inside the
card or row they edit. ADR-0040 defines the tabs and card-grid placement but not where
gallery forms render.

## Decision

- Plan and exercise create/edit forms render inside the card grid. An edit form replaces
  the content of the card it edits; a new-item form is the first card in the grid.
- Only one card is in edit mode at a time. Opening another card's editor closes the
  current one, and the rest of the grid stays visible.
- The form card spans the full grid width so its fields and actions stay usable inside
  the narrow auto-fill columns.
- Cancel restores the card view. Saving replaces the card with the updated item;
  creating inserts a new card in the existing order.
- The form focuses its first field when it opens. Save and cancel return focus to the
  edited card's Edit button, or to the new item's Edit button after creation. Canceling
  a new item returns focus to the new-item button.
- Validation, pending and error states, delete behavior, and the API and shared schemas
  do not change. Submit errors render inside the editing card.

## Consequences

- Editing stays attached to its card while the rest of the gallery provides context.
- The grid now contains the create form, so "No plans yet" only shows when no form is
  open and no plans exist.
- ADR-0040's bottom placement is refined: the New plan and New exercise actions stay
  below the grid, but their forms open as the first card.
- SessionView and History keep their existing inline forms.
