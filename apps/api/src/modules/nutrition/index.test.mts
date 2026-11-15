import { beforeEach, describe, expect, it, vi } from "vitest";

const { estimateMeal, getUser } = vi.hoisted(() => ({
  estimateMeal: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("../../config/prisma-client.mts", () => ({ prisma: {} }));
vi.mock("../../container.mts", () => ({
  container: {
    currentUserService: { get: getUser },
    nutritionService: {},
    aiService: { estimateMeal },
  },
}));

import { nutritionModule } from "./index.mts";

const estimate = {
  name: "Skyr bowl",
  macros: {
    calories: 410,
    proteinGrams: 38,
    carbsGrams: 44,
    fatGrams: 6,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ id: "user-1" });
});

function postEstimate(body: unknown) {
  return nutritionModule.request("/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /estimate", () => {
  it("estimates a described meal", async () => {
    estimateMeal.mockResolvedValue(estimate);

    const response = await postEstimate({
      description: "  300g skyr with berries  ",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(estimate);
    expect(estimateMeal).toHaveBeenCalledWith("300g skyr with berries");
  });
});
