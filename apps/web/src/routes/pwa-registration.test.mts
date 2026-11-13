import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/svelte";
import { registerSW } from "virtual:pwa-register";
import Harness from "../test/SessionShellHarness.svelte";

vi.mock("$app/state", () => ({
  page: { url: { pathname: "/gym" } },
}));

vi.mock("virtual:pwa-register", () => ({
  registerSW: vi.fn(),
}));

vi.mock("../api/gym.mts", () => ({
  listAllExercises: vi.fn().mockResolvedValue([]),
  listAllPlans: vi.fn().mockResolvedValue([]),
  getRotation: vi.fn().mockResolvedValue({ plans: [], nextPlanId: null }),
  getActiveSession: vi.fn().mockResolvedValue(null),
  createPlan: vi.fn(),
  setRotation: vi.fn(),
  startSession: vi.fn(),
  addSet: vi.fn(),
  deleteSet: vi.fn(),
  completeSession: vi.fn(),
}));

describe("PWA registration", () => {
  it("registers the service worker once", async () => {
    render(Harness);

    await waitFor(() =>
      expect(registerSW).toHaveBeenCalledWith({ immediate: true }),
    );
    expect(registerSW).toHaveBeenCalledOnce();
  });
});
