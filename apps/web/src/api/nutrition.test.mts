import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateMeal } from "./nutrition.mts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("estimateMeal", () => {
  it("posts a meal description and parses the estimate", async () => {
    const estimate = {
      name: "Skyr bowl",
      macros: {
        calories: 410,
        proteinGrams: 38,
        carbsGrams: 44,
        fatGrams: 6,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(estimate), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      estimateMeal({ description: "300g skyr with berries" })
    ).resolves.toEqual(estimate);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/nutrition/estimate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      description: "300g skyr with berries",
    });
  });
});
