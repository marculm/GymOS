import type { DeepSeekConfig } from "../../../config/env.mts";
import type {
  JsonCompletionClient,
  JsonCompletionRequest,
} from "../service/ai-service.mts";
import { AiProviderError } from "../service/errors.mts";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 300;

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
  }: JsonCompletionRequest): Promise<string> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
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
