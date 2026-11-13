import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type { WorkoutSessionDetail } from "@gymos/shared";
import { getActiveSession } from "../api/gym.mts";
import { shell } from "../lib/shell.svelte.ts";
import Harness from "../test/SessionShellHarness.svelte";

vi.mock("$app/state", () => ({
  page: { url: { pathname: "/gym" } },
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

const activeSession: WorkoutSessionDetail = {
  id: "session-1",
  title: "Free workout",
  planId: null,
  startedAt: "2026-11-13T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

beforeEach(() => {
  shell.sessionActive = false;
  vi.mocked(getActiveSession).mockResolvedValue(null);
});

describe("session shell", () => {
  it("shows the tab bar when no session is active", async () => {
    render(Harness);

    expect(await screen.findByText("No workout scheduled")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /main navigation/i }),
    ).toBeInTheDocument();
  });

  it("hides the tab bar while a session is active", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(activeSession);
    render(Harness);

    expect(
      await screen.findByRole("button", { name: /finish workout/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /main navigation/i }),
    ).not.toBeInTheDocument();
  });
});
