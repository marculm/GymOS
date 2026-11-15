import type {
  JsonCompletionClient,
  JsonCompletionRequest,
} from "../service/ai-service.mts";
import { AiProviderError } from "../service/errors.mts";

const REQUEST_TIMEOUT_MS = 20_000;

export type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: unknown } }[];
};

export class DeepSeekClient implements JsonCompletionClient {
  constructor(
    private readonly config: DeepSeekConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async completeJson(request: JsonCompletionRequest): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.send(request);
      } catch (error) {
        if (attempt === 0 && isRetryable(error)) continue;
        throw error instanceof AiProviderError ? error : new AiProviderError();
      }
    }

    throw new AiProviderError();
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

function isRetryable(error: unknown): boolean {
  if (error instanceof AiProviderError) {
    return error.status === 429 || (error.status ?? 0) >= 500;
  }
  return error instanceof TypeError;
}
