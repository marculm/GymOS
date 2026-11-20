import type { DeepSeekConfig } from "../../../config/env.mts";
import type {
  JsonCompletionClient,
  JsonCompletionRequest,
} from "../service/ai-service.mts";
import { AiProviderError } from "../service/errors.mts";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 300;
const MAX_THINKING_OUTPUT_TOKENS = 4096;
const REASONING_EFFORT = "high";

type ChatCompletionResponse = {
  choices?: { message?: { content?: unknown } }[];
};

export class DeepSeekClient implements JsonCompletionClient {
  constructor(
    private readonly config: DeepSeekConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async completeJson(request: JsonCompletionRequest): Promise<string> {
    try {
      return await this.send(request);
    } catch (error) {
      throw error instanceof AiProviderError ? error : new AiProviderError();
    }
  }

  private async send({
    system,
    user,
    image,
    maxTokens,
  }: JsonCompletionRequest): Promise<string> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const thinking = this.config.thinking;
    const outputTokens = thinking
      ? MAX_THINKING_OUTPUT_TOKENS
      : MAX_OUTPUT_TOKENS;
    const userContent = image
      ? [
          ...(user ? [{ type: "text", text: user }] : []),
          { type: "image_url", image_url: { url: image } },
        ]
      : user;
    const response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: image ? this.config.visionModel : this.config.textModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        thinking: { type: thinking ? "enabled" : "disabled" },
        ...(thinking ? { reasoning_effort: REASONING_EFFORT } : {}),
        max_tokens: Math.max(maxTokens ?? 0, outputTokens),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw new AiProviderError(response.status);

    let body: ChatCompletionResponse;
    try {
      body = (await response.json()) as ChatCompletionResponse;
    } catch {
      return "";
    }

    const content = body.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  }
}
