# AI Recipe Import Flow

## Status

Accepted

## Context

The nutrition spec (slice 3, ADR-0057) adds a recipe extractor that fills the editable
recipe form. Ticket #155 covers the pasted-text path; the URL extractor stays in #3.
ADR-0059 fixes the provider and harness, and ADR-0060 the meal estimation flow.

Real recipe texts use fractions (`1/2 tsp`), ranges (`2-3 cloves`), no unit
(`1 onion`), or no amount (`salt to taste`). `RecipeIngredientSchema` requires a positive
numeric `amount` and a non-empty `unit`, and the recipe form and database mapping follow
it. Three decisions were open: the macro basis, the ingredient normalization, and the
entry point.

## Decision

- `POST /api/nutrition/recipes/extract` accepts `{ "text": string }` (trimmed, 1–8000
  characters) and returns a `RecipeInput`-shaped draft: title, servings, per-serving
  macros, ingredients, and instructions. It persists nothing.
- The prompt asks for the recipe totals plus the servings. The parser validates the
  payload and computes the per-serving macros as total ÷ servings, rounded to one
  decimal. The returned per-serving values therefore stay checkable against the totals.
- The prompt normalizes ingredients to the existing schema: fractions become decimals,
  ranges pick a value within the range, and a missing amount or unit gets a plausible
  one (`1 pinch`, `1 piece`). The shared schema, the database mapping, and the form stay
  unchanged.
- The prompt asks for the title, ingredients, and instructions in the input language.
- The recipe manager gets an `Import from text` step before the form, mirroring the
  Describe step: paste the text, `Extract`, then the existing form opens prefilled.
  The text survives a failure, and nothing is saved before `Save recipe`.
- The failure policy matches ADR-0060: at most two provider calls, a 503 when the
  provider is missing or fails, a 502 for an unreadable response, and a 70-second client
  timeout.
- The JSON completion request may carry an output-token budget. Recipe extraction asks
  for 2048 tokens. The client keeps its larger thinking cap (4096) and its 300-token
  meal default. Without this, an import with `DEEPSEEK_THINKING=false` would be cut off
  at 300 tokens.
- The pasted text is neither logged nor stored.

## Consequences

- Text import depends on `DEEPSEEK_API_KEY`; without it the endpoint returns 503 and
  manual entry still works.
- Recipe text leaves the server for DeepSeek; prompts are neither logged nor stored.
- The URL extractor (#3) and photo estimation (#150) can reuse the import step and the
  harness with their own prompts and inputs.
- The model can still return implausible values; the user confirms every field in the
  form before saving.
- The 8000-character bound keeps the provider call bounded; a very long recipe can still
  exhaust the 2048-token output budget, which fails visibly with a 502 instead of
  returning partial data.
