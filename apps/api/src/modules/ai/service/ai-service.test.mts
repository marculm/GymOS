import { describe, expect, it, vi } from "vitest";
import { AiService } from "./ai-service.mts";
import { AiInvalidResponseError, AiNotConfiguredError } from "./errors.mts";

const estimate = {
  name: "Skyr bowl",
  macros: {
    calories: 410,
    proteinGrams: 38,
    carbsGrams: 44,
    fatGrams: 6,
  },
};

function fakeClient(...responses: string[]) {
  const completeJson = vi.fn();
  for (const response of responses) {
    completeJson.mockResolvedValueOnce(response);
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

  it("retries an unreadable completion once", async () => {
    const client = fakeClient("   ", JSON.stringify(estimate));
    const service = new AiService(client);

    await expect(service.estimateMeal("toast")).resolves.toEqual(estimate);
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
