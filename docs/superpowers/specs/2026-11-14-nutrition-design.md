# Nutrition Design

**Status:** Approved
**Date:** 2026-11-14
**Related:** ADR-0057

## Goal

The Nutrition space becomes the daily fueling loop: see today's calories and macros
against a manual daily target, log a meal in a few taps, and correct entries later.
Recipes are saved once for repeat logging and for cooking inspiration. The first slice
is deterministic and works without an LLM; estimations and the recipe extractor follow.

## Slices

1. **Manual logging and saved meals (this slice)**
   - Manual daily targets in Settings.
   - Log a saved recipe portion, or enter a meal's macros manually.
   - Today's log with edit and delete.
   - Minimal recipe management in Settings (title, servings, per-serving macros,
     ingredients, instructions, source URL).
   - Home gauge and macro strip from real data.
2. **AI estimation:** Describe and Photo paths fill the same focus logger with estimated
   values; every value stays editable before logging.
3. **Recipe extractor:** import a recipe from a link into the editable recipe form.
4. **Cooking view:** recipe detail with ingredients and instructions for inspiration.

Mealprep and weekly planning are out of scope.

## Screens and grammar

The app has three layers. Reuse them instead of inventing a fourth.

- **Space layer (home and workout):** 20px gutter, `Today` eyebrow, large title,
  meta line, hero, actions at the bottom. Primary action is the inverse high-contrast
  button (black 58px in the light space, white 58px in the dark space).
- **Sheet layer (session sheets):** the only bottom sheet in Nutrition is the Log food
  choice: grabber, compact header, 64px option rows, Cancel.
- **Settings layer (full-screen steps):** 2.125rem title, 44px back and close, white
  groups with 0.5px separators, 56px rows, 44px blue primary, ghost secondary for
  alternative actions, muted text for Cancel/Done.
- **Session layer (logging):** the final Log meal is a focus screen in the set-logger
  grammar: 2rem title, source line, 3rem metric values in a 2x2 grid, uppercase
  0.5625rem labels, tap-to-edit, one black 58px primary, no form cards.

### Home

- `Today` eyebrow, fixed gear top right.
- Title `Nutrition` (2.375rem, 700, -0.04em), meta line `1,180 of 2,400 kcal eaten`.
- 270° gauge (190px) with the remaining calories in the center; the filled arc is the
  eaten share of the target, the grey arc is the remainder.
- Macro strip: three columns with a food icon, remaining grams, eaten-of-target, and a
  3px bar.
- Actions: `Log food` (black 58px), `Today's log` (muted 44px), Training space hint.

### Log flow

1. `Log food` opens the Log sheet: Saved meal, Describe, Photo.
2. Each option opens a full-screen Settings step (saved recipe list, describe input,
   photo capture). In slice 1, Describe opens the manual entry path; Photo is hidden
   until slice 2.
3. The final step is the focus logger: meal name, source, portion stepper for a saved
   recipe, 2x2 metrics (calories, protein, carbs, fat), tap-to-edit, `Log meal`.
4. Today's log lists the entries. Tapping one reopens the focus logger with
   `Save changes` and `Delete`; deletion is confirmed there.

A log entry is a snapshot of name and macros. Editing an entry never changes a recipe.
A saved meal's macros are the recipe's per-serving macros multiplied by the portion.

## Visual tokens

- Light space: `#f2f2f7` background, `#ffffff` surfaces, `#1c1c1e` text, `#5a5a5f`
  muted, `#d1d1d6` separators.
- Data palette (Blue mono): protein `#003f7f`, carbs `#0066cc`, fat `#66a3ff`.
  The colors are fills only; labels and values are ink.
- Accent blue `#0066cc` is for Settings form actions and interactive controls only.
  The space and session primaries are black in the light space.
- Numerals use the rounded font stack; labels use the system font.
- Icons are Lucide: Beef (protein), Wheat (carbs), Droplet (fat), plus the existing UI
  icons.

## Data model

Existing tables stay:

- `recipes`: title, sourceUrl, servings, calories/protein/carbs/fat per serving,
  ingredients JSON, instructions JSON, timestamps.
- `nutrition_logs`: loggedAt, name, calories/protein/carbs/fat, createdAt.

Add:

- `nutrition_targets`: userId (unique), calories, proteinGrams, carbsGrams, fatGrams,
  updatedAt.

The API remains single-user until authentication. Targets are optional; without them the
home shows a setup prompt instead of a gauge.

## API

All responses are JSON; errors use the existing problem-details shape. No fabricated
data.

- `GET /api/nutrition/summary?from=<iso>&to=<iso>` → totals, targets (or null), remaining
  (or null).
- `GET /api/nutrition/logs?from=<iso>&to=<iso>` → log entries.
- `POST /api/nutrition/logs` `{ name, loggedAt?, macros }` → created entry.
- `PATCH /api/nutrition/logs/:id` `{ name?, loggedAt?, macros? }`.
- `DELETE /api/nutrition/logs/:id` → 204.
- `GET /api/nutrition/recipes` → recipes.
- `POST /api/nutrition/recipes` `{ title, sourceUrl?, servings, macrosPerServing,
  ingredients, instructions }`.
- `PATCH /api/nutrition/recipes/:id`; `DELETE /api/nutrition/recipes/:id`.
- `GET /api/nutrition/targets` → targets or null.
- `PUT /api/nutrition/targets` `{ calories, proteinGrams, carbsGrams, fatGrams }`.

The client sends the local day boundaries as `from`/`to`, so the day does not depend on
the server timezone.

## States and errors

- **No targets:** the home shows a short setup prompt and a `Set daily targets` action
  that opens Settings.
- **Empty day:** the gauge shows the full grey track, the macro strip shows the full
  targets, and Today's log is empty with an invitation to log.
- **Over target:** the affected gauge segment and the macro bar switch to the danger red;
  the center shows an over state. No fourth palette.
- **Loading/error:** skeleton or muted loading text; API errors render the problem
  message with Retry. No fake values.
- **Delete:** the focus logger's `Delete` asks for confirmation inline, like the set
  deletion.

## Testing

- API: summary ranges and totals, target upsert, log CRUD, recipe CRUD, validation and
  problem details.
- Web: home with and without targets, log sheet paths, saved-meal portion math, manual
  entry, Today's log edit/delete, error and empty states.
- Accessibility: WCAG AA for labels and focus; 44px touch targets; tap-only fallbacks
  for every gesture; labels remain ink regardless of the data palette.
