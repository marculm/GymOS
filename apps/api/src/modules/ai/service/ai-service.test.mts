import { describe, expect, it, vi } from "vitest";
import { AiService } from "./ai-service.mts";
import {
  AiInvalidResponseError,
  AiNotConfiguredError,
  AiProviderError,
} from "./errors.mts";

const estimate = {
  name: "Skyr bowl",
  macros: {
    calories: 410,
    proteinGrams: 38,
    carbsGrams: 44,
    fatGrams: 6,
  },
};

function fakeClient(...responses: (string | Error)[]) {
  const completeJson = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) {
      completeJson.mockRejectedValueOnce(response);
    } else {
      completeJson.mockResolvedValueOnce(response);
    }
  }
  return { completeJson };
}

describe("AiService.estimateMeal", () => {
  it("parses a JSON meal estimate", async () => {
    const client = fakeClient(JSON.stringify(estimate));
    const service = new AiService(client);

    await expect(service.estimateMeal("300g skyr with berries")).resolves.toEqual(
      estimate
    );
    expect(client.completeJson).toHaveBeenCalledWith({
      system: expect.stringMatching(/json/i),
      user: "300g skyr with berries",
    });
  });

  it("ignores an unusable AI name", async () => {
    const client = fakeClient(
      JSON.stringify({ name: null, macros: estimate.macros })
    );
    const service = new AiService(client);

    await expect(service.estimateMeal("toast")).resolves.toEqual({
      macros: estimate.macros,
    });
  });

  it("truncates an overlong AI name", async () => {
    const client = fakeClient(
      JSON.stringify({ name: "a".repeat(130), macros: estimate.macros })
    );
    const service = new AiService(client);

    await expect(service.estimateMeal("toast")).resolves.toEqual({
      name: "a".repeat(120),
      macros: estimate.macros,
    });
  });

  it("retries an unreadable completion once", async () => {
    const client = fakeClient("   ", JSON.stringify(estimate));
    const service = new AiService(client);

    await expect(service.estimateMeal("toast")).resolves.toEqual(estimate);
    expect(client.completeJson).toHaveBeenCalledTimes(2);
  });

  it("retries a retryable provider error once", async () => {
    const client = fakeClient(
      new AiProviderError(500),
      JSON.stringify(estimate)
    );
    const service = new AiService(client);

    await expect(service.estimateMeal("toast")).resolves.toEqual(estimate);
    expect(client.completeJson).toHaveBeenCalledTimes(2);
  });

  it("does not retry an authentication error", async () => {
    const client = fakeClient(new AiProviderError(401));
    const service = new AiService(client);

    await expect(service.estimateMeal("toast")).rejects.toMatchObject({
      status: 401,
    });
    expect(client.completeJson).toHaveBeenCalledTimes(1);
  });

  it("fails after two retryable provider errors", async () => {
    const client = fakeClient(
      new AiProviderError(),
      new AiProviderError(503)
    );
    const service = new AiService(client);

    await expect(service.estimateMeal("toast")).rejects.toBeInstanceOf(
      AiProviderError
    );
    expect(client.completeJson).toHaveBeenCalledTimes(2);
  });

  it("fails after a second unreadable completion", async () => {
    const client = fakeClient("not json", "[]");
    const service = new AiService(client);

    await expect(service.estimateMeal("toast")).rejects.toBeInstanceOf(
      AiInvalidResponseError
    );
    expect(client.completeJson).toHaveBeenCalledTimes(2);
  });

  it("fails when no provider is configured", async () => {
    const service = new AiService(null);

    await expect(service.estimateMeal("toast")).rejects.toBeInstanceOf(
      AiNotConfiguredError
    );
  });
});
