# AI Meal Estimation Flow

## Status

Accepted

## Context

The nutrition spec (slice 2, ADR-0057) adds AI estimation: a described or photographed
meal yields calories and macros, prefilled into the editable logger. ADR-0059 fixes the
provider and harness. Ticket #149 requires the Describe path: nothing is logged before
the user confirms, manual entry stays available, and a failure is visible instead of
falling back to zero values. Ticket #150 adds a photo to the same step, alone or with a
description.

## Decision

- `POST /api/nutrition/estimate` accepts `{ "description"?: string, "image"?: string }`
  with at least one of the two. The description is trimmed (1–2000 characters); the
  image is a base64 `data:` URL of a JPEG compressed in the browser to about 1536px,
  and decoded images over 2 MB are rejected. The response is `{ "name"?: string,
  "macros": {...} }`. It persists nothing.
- The nutrition module calls a provider-agnostic `AiService`. The service owns the
  prompts and the Zod response schema; the DeepSeek client only performs JSON-mode chat
  completions through `fetch`. With an image the service uses the photo prompt and the
  client selects `DEEPSEEK_VISION_MODEL`; text-only requests keep the text prompt and
  `DEEPSEEK_TEXT_MODEL`.
- The service makes at most two provider calls per estimate: one retry covers both a
  retryable provider error (429, 5xx, network failure, or timeout) and an unreadable or
  spaces-only completion. Each call times out after 30 seconds. Output is capped at
  4096 tokens with thinking at high effort (the default, ADR-0059) and at 300 tokens
  without it. Prompt text and meal descriptions are never logged.
- The Describe choice opens a full-screen step that accepts a description, a photo, or
  both. The photo is picked from the camera or gallery, re-encoded in the browser (which
  strips EXIF metadata and bakes orientation), and sent as a `data:` URL. `Estimate`
  pre-fills the existing focus logger and labels the source `AI estimate`; every value
  stays editable and `Log meal` remains the only write. The Log food sheet also offers a
  direct `Manual` choice that opens the same logger without the Describe step; `Enter
  manually` in the Describe step stays as the fallback.
- A failed estimate stays on the Describe step with the description and photo preserved
  and an alert. Missing configuration or provider failure returns 503; an unreadable
  response returns 502. The UI points to manual entry, and no zero values are logged
  silently.
- The AI name is optional; without it the trimmed description (up to 120 characters)
  becomes the meal name, or `Photo meal` when the request has no description. The prompt
  asks for the name in the description's language, so a German description returns a
  German name.
- The web client allows 70 seconds for the estimate, covering the two provider calls and
  their 30-second timeouts.

## Consequences

- The Describe path depends on `DEEPSEEK_API_KEY`; without it the endpoint returns 503
  and manual entry still works.
- Meal text and photos leave the server for DeepSeek; prompts and content are neither
  logged nor stored.
- `AiService` remains the shared seam for recipe work (#3) and future AI tasks; each
  task adds a prompt and response schema without another provider integration.
- Estimates are advisory values the user confirms, not nutrition data the app vouches
  for.
