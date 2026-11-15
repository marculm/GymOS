import { beforeEach, describe, expect, it, vi } from "vitest";

const { estimateMeal, getUser } = vi.hoisted(() => ({
  estimateMeal: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("./config/prisma-client.mts", () => ({
  prisma: { user: { count: vi.fn() } },
}));
vi.mock("./container.mts", () => ({
  container: {
    currentUserService: { get: getUser },
    nutritionService: {},
    aiService: { estimateMeal },
  },
}));

import { app } from "./app.mts";
import {
  AiInvalidResponseError,
  AiNotConfiguredError,
  AiProviderError,
} from "./modules/ai/service/errors.mts";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ id: "user-1" });
});

function estimateRequest() {
  return app.request("/api/nutrition/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "toast" }),
  });
}

async function expectProblem(error: Error, status: number) {
  estimateMeal.mockRejectedValueOnce(error);

  const response = await estimateRequest();

  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain(
    "application/problem+json"
  );
  expect(await response.json()).toMatchObject({
    status,
    detail: error.message,
  });
}

describe("AI estimate errors", () => {
  it("maps a missing configuration to 503", async () => {
    await expectProblem(new AiNotConfiguredError(), 503);
  });

  it("maps a provider failure to 503", async () => {
    await expectProblem(new AiProviderError(500), 503);
  });

  it("maps an invalid response to 502", async () => {
    await expectProblem(new AiInvalidResponseError(), 502);
  });
});
