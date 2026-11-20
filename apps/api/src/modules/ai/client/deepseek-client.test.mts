import { describe, expect, it, vi } from "vitest";
import { AiProviderError } from "../service/errors.mts";
import { DeepSeekClient } from "./deepseek-client.mts";

const config = {
  apiKey: "test-key",
  baseUrl: "https://deepseek.test",
  textModel: "deepseek-flash",
  visionModel: "deepseek-flash",
  thinking: true,
};

function completion(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function failed(status: number) {
  return new Response(JSON.stringify({ error: "nope" }), { status });
}

function createClient(fetchMock: ReturnType<typeof vi.fn>) {
  return new DeepSeekClient(config, fetchMock as unknown as typeof fetch);
}

async function capture(promise: Promise<unknown>): Promise<AiProviderError> {
  try {
    await promise;
  } catch (error) {
    return error as AiProviderError;
  }
  throw new Error("Expected the completion to fail");
}

describe("DeepSeekClient.completeJson", () => {
  it("sends a JSON-mode chat completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"ok":true}'));
    const client = createClient(fetchMock);

    await expect(
      client.completeJson({ system: "system prompt", user: "meal text" })
    ).resolves.toBe('{"ok":true}');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://deepseek.test/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-key",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: "deepseek-flash",
      messages: [
        { role: "system", content: "system prompt" },
        { role: "user", content: "meal text" },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "enabled" },
      reasoning_effort: "high",
      max_tokens: 4096,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends an image with the vision model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"ok":true}'));
    const client = new DeepSeekClient(
      { ...config, visionModel: "vision-model" },
      fetchMock as unknown as typeof fetch
    );

    await client.completeJson({
      system: "system prompt",
      user: "what is this",
      image: "data:image/jpeg;base64,AAAA",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "vision-model",
      messages: [
        { role: "system", content: "system prompt" },
        {
          role: "user",
          content: [
            { type: "text", text: "what is this" },
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,AAAA" },
            },
          ],
        },
      ],
    });
  });

  it("sends only the image when there is no text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"ok":true}'));
    const client = createClient(fetchMock);

    await client.completeJson({
      system: "s",
      user: "",
      image: "data:image/jpeg;base64,AAAA",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.messages[1].content).toEqual([
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
    ]);
  });

  it("uses the small cap when thinking is disabled", async () => {    const fetchMock = vi.fn().mockResolvedValue(completion('{"ok":true}'));
    const client = new DeepSeekClient(
      { ...config, thinking: false },
      fetchMock as unknown as typeof fetch
    );

    await client.completeJson({ system: "s", user: "u" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      thinking: { type: "disabled" },
      max_tokens: 300,
    });
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("uses the requested output budget", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"ok":true}'));
    const client = new DeepSeekClient(
      { ...config, thinking: false },
      fetchMock as unknown as typeof fetch
    );

    await client.completeJson({ system: "s", user: "u", maxTokens: 2048 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ max_tokens: 2048 });
  });

  it("keeps the larger thinking budget", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"ok":true}'));
    const client = createClient(fetchMock);

    await client.completeJson({ system: "s", user: "u", maxTokens: 2048 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ max_tokens: 4096 });
  });

  it("reports a server error without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failed(500));
    const client = createClient(fetchMock);

    const error = await capture(
      client.completeJson({ system: "s", user: "u" })
    );

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.status).toBe(500);
    expect(error.retryable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a network error without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const client = createClient(fetchMock);

    const error = await capture(
      client.completeJson({ system: "s", user: "u" })
    );

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.status).toBeUndefined();
    expect(error.retryable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a timeout without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    const client = createClient(fetchMock);

    const error = await capture(
      client.completeJson({ system: "s", user: "u" })
    );

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.retryable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks an authentication error as not retryable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failed(401));
    const client = createClient(fetchMock);

    const error = await capture(
      client.completeJson({ system: "s", user: "u" })
    );

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.status).toBe(401);
    expect(error.retryable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns empty content when the completion is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 })
    );
    const client = createClient(fetchMock);

    await expect(
      client.completeJson({ system: "s", user: "u" })
    ).resolves.toBe("");
  });
});
