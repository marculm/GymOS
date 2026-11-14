# Nutrition Logging and Saved Meals

## Status

Accepted

## Context

The Nutrition space was a placeholder and `GET /api/nutrition/summary` returned `501`
(ADR-0017). The shared nutrition and recipe schemas and the `recipes` and
`nutrition_logs` tables existed, but the product decisions were open: API contract,
data model changes, mealprep scope, and where the daily macro targets come from.

The design process settled the space as the light counter-space to the dark Training
space and reused the Instrument grammar. The owner chose the blue-mono data palette,
a 270° gauge for the day, a focused meal logger in the set-logger grammar, and manual
daily targets. The full visual and behavioral specification is in
`docs/superpowers/specs/2026-11-14-nutrition-design.md`.

## Decision

- Nutrition stays the light space. The home shows a `Nutrition` title, the remaining
  calories in a 270° gauge, and a three-column macro strip. The primary action is
  `Log food`; `Today's log` holds the entries.
- Daily targets are manual in Settings and stored per user in a new
  `nutrition_targets` table. They are optional; without them the home shows a setup
  prompt.
- The Log food sheet is the only bottom sheet. Selection and management use the
  full-screen Settings grammar. The final Log meal uses the session grammar: large
  tap-to-edit values and one black 58px primary.
- A saved meal logs the recipe's per-serving macros multiplied by the portion. A log
  entry is a snapshot; editing it never changes the recipe.
- The API implements summary, log CRUD, recipe CRUD, and target read/upsert. The
  client sends local day boundaries; no endpoint returns fabricated data.
- The data palette is blue mono (`#003f7f`, `#0066cc`, `#66a3ff`) used only on data.
  The accent blue is reserved for Settings form actions; space and session primaries
  are black in the light space.
- The first slice is manual logging and saved meals. Describe and Photo with LLM
  estimation, the recipe extractor, and the cooking view follow in later slices.
  Mealprep is out of scope.

## Consequences

- The `501` stub is replaced by real endpoints and tests; the existing schemas/tables
  are used.
- The UI and API agree on targets, totals, and portion math; a user can log and correct
  a day without an LLM.
- The space has no fake values: missing targets, empty days, over-target days, and API
  errors each have an explicit state.
- The design adds one new shape (the gauge) and reuses the existing space, sheet,
  Settings, and session grammars; new components should not invent a fifth layer.
- The bright macro palette is data-only; changing it does not affect interactive
  controls or contrast for labels.
- The LLM paths and the extractor will reuse the same focus logger and API; no
  migration of log entries is needed because entries are snapshots.
