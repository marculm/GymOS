# AI Estimation Harness

## Status

Accepted

## Context

The nutrition spec (slice 2, ADR-0057) adds AI estimation: a described meal or a
photo yields calories and macros, prefilled into the editable logger. Ticket #149
left the provider and the harness open. The owner chose DeepSeek and no vendor SDK,
and asked that the same mechanism cover recipe AI — the extractor (#3) and later
recipe macro estimation — so the app has one AI integration instead of one per
feature.

DeepSeek exposes an OpenAI-compatible Chat Completions API. The current model IDs are
`deepseek-flash` (text and vision, lower cost) and `deepseek-v4-pro` (text, higher
cost); the older `deepseek-chat` alias was retired on 2026-07-24. JSON output is
available via `response_format: { type: "json_object" }`, with two caveats: the prompt
must mention `json` and show an example of the expected structure, and output that
cannot be parsed may come back as spaces-only content.

## Decision

- The provider is DeepSeek at `https://api.deepseek.com`. Text tasks default to
  `deepseek-flash`; `DEEPSEEK_TEXT_MODEL` can select `deepseek-v4-pro` for
  higher-quality text. Image tasks use the multimodal `deepseek-flash`. Estimation
  enables thinking by default (`thinking: { "type": "enabled" }`) with
  `reasoning_effort: "high"` so vague descriptions get a more careful estimate;
  `DEEPSEEK_THINKING=false` trades accuracy for lower latency and cost. Thinking output
  is capped at 4096 tokens, non-thinking output at 300.
- The harness is a plain `fetch` wrapper in `apps/api/src/modules/ai` behind a
  provider-agnostic `AiService`. No vendor SDK is added.
- Every task — meal text, meal photo, recipe extraction, recipe macro estimation —
  goes through the shared service, with one prompt module and one Zod-validated
  response per task.
- Requests use JSON mode plus an explicit JSON example in the prompt. Responses are
  parsed and validated with Zod; invalid or spaces-only content gets one retry, then
  a mapped provider error.
- Calls time out after about 30 seconds. 429 and 5xx are retried once, then surface as
  503; an unreadable response surfaces as 502. The UI keeps manual entry as the
  fallback.
- Images are compressed in the browser (JPEG, about 1536px) and sent as `data:` URLs
  in `image_url` content blocks. The API stores no images and only passes them on.
- Configuration is server-side only: `DEEPSEEK_API_KEY`, optional
  `DEEPSEEK_BASE_URL`, `DEEPSEEK_TEXT_MODEL=deepseek-flash`, `DEEPSEEK_THINKING=true`;
  the photo slice adds `DEEPSEEK_VISION_MODEL=deepseek-flash` (#150). Prompt content —
  meal text and image data — is never logged.

## Consequences

- One small integration instead of an SDK lock-in. The provider can be replaced behind
  `AiService` without touching the UI or the task modules.
- JSON-mode parsing must be defensive: blank content and truncated JSON are expected
  failure modes, covered by validation and tests with a stubbed fetch.
- Every estimation sends user content to DeepSeek; privacy and retention depend on
  DeepSeek's terms and must stay documented.
- The API key must exist in the user's `.env` for manual verification; agents never
  read or edit `.env`.
- Cost and latency stay small for text; an image costs up to roughly a thousand input
  tokens at Flash rates.
