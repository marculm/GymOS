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

describe("AiService.extractRecipe", () => {
  const completion = {
    title: "Pancakes",
    servings: 2,
    macrosTotal: {
      calories: 820,
      proteinGrams: 24,
      carbsGrams: 120,
      fatGrams: 26,
    },
    ingredients: [{ name: "Flour", amount: 200, unit: "g" }],
    instructions: ["Mix the batter.", "Fry the pancakes."],
  };

  it("requests a recipe draft with a larger output budget", async () => {
    const client = fakeClient(JSON.stringify(completion));
    const service = new AiService(client);

    await expect(service.extractRecipe("Mix the batter.")).resolves.toEqual({
      title: "Pancakes",
      servings: 2,
      macrosPerServing: {
        calories: 410,
        proteinGrams: 12,
        carbsGrams: 60,
        fatGrams: 13,
      },
      ingredients: completion.ingredients,
      instructions: completion.instructions,
    });
    expect(client.completeJson).toHaveBeenCalledWith({
      system: expect.stringMatching(/recipe/i),
      user: "Mix the batter.",
      maxTokens: 2048,
    });
  });

  it("fails when no provider is configured", async () => {
    const service = new AiService(null);

    await expect(service.extractRecipe("Mix the batter.")).rejects.toBeInstanceOf(
      AiNotConfiguredError
    );
  });
});

describe("AiService.estimateMeal", () => {
  it("parses a JSON meal estimate", async () => {
    const client = fakeClient(JSON.stringify(estimate));
    const service = new AiService(client);

    await expect(
      service.estimateMeal({ description: "300g skyr with berries" })
    ).resolves.toEqual(estimate);
    expect(client.completeJson).toHaveBeenCalledWith({
      system: expect.stringMatching(/json/i),
      user: "300g skyr with berries",
    });
    const request = client.completeJson.mock.calls[0]?.[0] as
      | { system: string; user: string }
      | undefined;
    expect(request?.system).toContain(
      "same language as the description"
    );
  });

  it("uses the photo prompt for an image", async () => {
    const client = fakeClient(JSON.stringify(estimate));
    const service = new AiService(client);

    await expect(
      service.estimateMeal({ image: "data:image/jpeg;base64,AAAA" })
    ).resolves.toEqual(estimate);
    expect(client.completeJson).toHaveBeenCalledWith({
      system: expect.stringMatching(/photo/i),
      user: "",
      image: "data:image/jpeg;base64,AAAA",
    });
  });

  it("passes a description alongside the photo", async () => {
    const client = fakeClient(JSON.stringify(estimate));
    const service = new AiService(client);

    await service.estimateMeal({
      description: "half portion",
      image: "data:image/jpeg;base64,AAAA",
    });

    expect(client.completeJson).toHaveBeenCalledWith({
      system: expect.stringMatching(/photo/i),
      user: "half portion",
      image: "data:image/jpeg;base64,AAAA",
    });
  });

  it("ignores an unusable AI name", async () => {
    const client = fakeClient(
      JSON.stringify({ name: null, macros: estimate.macros })
    );
    const service = new AiService(client);

    await expect(service.estimateMeal({ description: "toast" })).resolves.toEqual({
      macros: estimate.macros,
    });
  });

  it("truncates an overlong AI name", async () => {
    const client = fakeClient(
      JSON.stringify({ name: "a".repeat(130), macros: estimate.macros })
    );
    const service = new AiService(client);

    await expect(service.estimateMeal({ description: "toast" })).resolves.toEqual({
      name: "a".repeat(120),
      macros: estimate.macros,
    });
  });

  it("retries an unreadable completion once", async () => {
    const client = fakeClient("   ", JSON.stringify(estimate));
    const service = new AiService(client);

    await expect(service.estimateMeal({ description: "toast" })).resolves.toEqual(estimate);
    expect(client.completeJson).toHaveBeenCalledTimes(2);
  });

  it("retries a retryable provider error once", async () => {
    const client = fakeClient(
      new AiProviderError(500),
      JSON.stringify(estimate)
    );
    const service = new AiService(client);

    await expect(service.estimateMeal({ description: "toast" })).resolves.toEqual(estimate);
    expect(client.completeJson).toHaveBeenCalledTimes(2);
  });

  it("does not retry an authentication error", async () => {
    const client = fakeClient(new AiProviderError(401));
    const service = new AiService(client);

    await expect(service.estimateMeal({ description: "toast" })).rejects.toMatchObject({
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

    await expect(service.estimateMeal({ description: "toast" })).rejects.toBeInstanceOf(
      AiProviderError
    );
    expect(client.completeJson).toHaveBeenCalledTimes(2);
  });

  it("fails after a second unreadable completion", async () => {
    const client = fakeClient("not json", "[]");
    const service = new AiService(client);

    await expect(service.estimateMeal({ description: "toast" })).rejects.toBeInstanceOf(
      AiInvalidResponseError
    );
    expect(client.completeJson).toHaveBeenCalledTimes(2);
  });

  it("fails when no provider is configured", async () => {
    const service = new AiService(null);

    await expect(service.estimateMeal({ description: "toast" })).rejects.toBeInstanceOf(
      AiNotConfiguredError
    );
  });
});
