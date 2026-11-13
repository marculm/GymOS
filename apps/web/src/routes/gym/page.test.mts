import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import {
  getActiveSession,
  getRotation,
  listAllExercises,
  listAllPlans,
} from "../../api/gym.mts";
import GymPage from "./+page.svelte";

vi.mock("../../api/gym.mts", () => ({
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

beforeEach(() => {
  vi.mocked(getActiveSession).mockResolvedValue(null);
});

describe("Gym route", () => {
  it("renders the Gym start screen", async () => {
    render(GymPage);

    expect(await screen.findByText("No workout scheduled")).toBeInTheDocument();
    expect(getRotation).toHaveBeenCalled();
    expect(listAllExercises).toHaveBeenCalled();
    expect(listAllPlans).toHaveBeenCalled();
  });
});
