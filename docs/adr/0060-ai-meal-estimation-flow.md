# AI Meal Estimation Flow

## Status

Accepted

## Context

The nutrition spec (slice 2, ADR-0057) adds AI estimation: a described meal yields
calories and macros, prefilled into the editable logger. ADR-0059 fixes the provider
and harness. Ticket #149 requires the Describe path: nothing is logged before the user
confirms, manual entry stays available, and a failure is visible instead of falling back
to zero values.

## Decision

- `POST /api/nutrition/estimate` accepts `{ "description": string }` (trimmed, 1–2000
  characters) and returns `{ "name"?: string, "macros": {...} }`. It persists nothing.
- The nutrition module calls a provider-agnostic `AiService`. The service owns the
  prompt and the Zod response schema; the DeepSeek client only performs JSON-mode chat
  completions through `fetch`.
- The service makes at most two provider calls per estimate: one retry covers both a
  retryable provider error (429, 5xx, network failure, or timeout) and an unreadable or
  spaces-only completion. Each call times out after 20 seconds. Output is capped at
  4096 tokens with thinking enabled (the default, ADR-0059) and at 300 tokens without
  it. Prompt text and meal descriptions are never logged.
- The Describe choice opens a full-screen text step. `Estimate` pre-fills the existing
  focus logger and labels the source `AI estimate`; every value stays editable and
  `Log meal` remains the only write. `Enter manually` reaches the same logger without
  AI.
- A failed estimate stays on the text step with the description preserved and an alert.
  Missing configuration or provider failure returns 503; an unreadable response returns
  502. The UI points to manual entry, and no zero values are logged silently.
- The AI name is optional; without it the trimmed description (up to 120 characters)
  becomes the meal name.
- The web client allows 50 seconds for the estimate, covering the two provider calls and
  their 20-second timeouts.

## Consequences

- The Describe path depends on `DEEPSEEK_API_KEY`; without it the endpoint returns 503
  and manual entry still works.
- Meal text leaves the server for DeepSeek; prompts are neither logged nor stored.
- `AiService` is the shared seam for #150 and #3; they add a prompt and response schema
  without another provider integration.
- Estimates are advisory values the user confirms, not nutrition data the app vouches
  for.
