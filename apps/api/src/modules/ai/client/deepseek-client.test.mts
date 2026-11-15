import { describe, expect, it, vi } from "vitest";
import { AiProviderError } from "../service/errors.mts";
import { DeepSeekClient } from "./deepseek-client.mts";

const config = {
  apiKey: "test-key",
  baseUrl: "https://deepseek.test",
  model: "deepseek-flash",
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
      thinking: { type: "disabled" },
      max_tokens: 300,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
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
