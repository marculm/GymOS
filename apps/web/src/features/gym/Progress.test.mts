import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type { WorkoutProgress } from "@gymos/shared";
import Progress from "./Progress.svelte";
import { getProgress } from "../../api/gym.mts";

vi.mock("../../api/gym.mts", () => ({
  getProgress: vi.fn(),
}));

const progress: WorkoutProgress = {
  personalRecords: [
    {
      exerciseId: "exercise-1",
      exerciseName: "Bench Press",
      weightKg: 90,
      reps: 5,
      achievedAt: "2026-10-26T18:05:00.000Z",
    },
    {
      exerciseId: "exercise-2",
      exerciseName: "Squat",
      weightKg: 120,
      reps: 3,
      achievedAt: "2026-10-27T18:05:00.000Z",
    },
  ],
  volume: [
    {
      sessionId: "session-2",
      title: "Push A",
      startedAt: "2026-10-27T18:00:00.000Z",
      totalVolumeKg: 1500,
    },
    {
      sessionId: "session-1",
      title: "Push B",
      startedAt: "2026-10-26T18:00:00.000Z",
      totalVolumeKg: 1000,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Progress", () => {
  it("renders personal records and volume", async () => {
    vi.mocked(getProgress).mockResolvedValue(progress);

    render(Progress);

    expect(await screen.findByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("90 kg × 5")).toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
    expect(screen.getByText("1500 kg")).toBeInTheDocument();
    expect(screen.getByText("1000 kg")).toBeInTheDocument();
  });

  it("shows empty states without history", async () => {
    vi.mocked(getProgress).mockResolvedValue({
      personalRecords: [],
      volume: [],
    });

    render(Progress);

    expect(await screen.findByText("No records yet")).toBeInTheDocument();
    expect(screen.getByText("No completed workouts yet")).toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    vi.mocked(getProgress).mockRejectedValueOnce(new Error("Backend unavailable"));

    render(Progress);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable"
    );
  });
});
