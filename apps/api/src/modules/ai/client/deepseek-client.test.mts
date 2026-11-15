import { describe, expect, it, vi } from "vitest";
import { AiProviderError } from "../service/errors.mts";
import { DeepSeekClient } from "./deepseek-client.mts";

const config = {
  apiKey: "test-key",
  baseUrl: "https://deepseek.test",
  model: "deepseek-chat",
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
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "system prompt" },
        { role: "user", content: "meal text" },
      ],
      response_format: { type: "json_object" },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries a server error once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failed(500))
      .mockResolvedValueOnce(completion('{"ok":true}'));
    const client = createClient(fetchMock);

    await expect(
      client.completeJson({ system: "s", user: "u" })
    ).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error once", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(completion('{"ok":true}'));
    const client = createClient(fetchMock);

    await expect(
      client.completeJson({ system: "s", user: "u" })
    ).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails after a second server error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failed(502));
    const client = createClient(fetchMock);

    await expect(
      client.completeJson({ system: "s", user: "u" })
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an authentication error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failed(401));
    const client = createClient(fetchMock);

    await expect(
      client.completeJson({ system: "s", user: "u" })
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a timeout", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    const client = createClient(fetchMock);

    await expect(
      client.completeJson({ system: "s", user: "u" })
    ).rejects.toBeInstanceOf(AiProviderError);
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
