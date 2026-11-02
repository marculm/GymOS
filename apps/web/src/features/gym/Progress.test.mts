import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
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
    expect(screen.getByText("5 × 90 kg")).toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
    expect(screen.getByText("1500 kg")).toBeInTheDocument();
    expect(screen.getByText("1000 kg")).toBeInTheDocument();
  });

  it("displays weights with up to two decimals", async () => {
    vi.mocked(getProgress).mockResolvedValue({
      personalRecords: progress.personalRecords.map((record, index) => ({
        ...record,
        weightKg: index === 0 ? 90.25 : 120.5,
      })),
      volume: progress.volume.map((entry, index) => ({
        ...entry,
        totalVolumeKg: index === 0 ? 1500.75 : 1000.5,
      })),
    });

    render(Progress);

    expect(await screen.findByText("5 × 90.25 kg")).toBeInTheDocument();
    expect(screen.getByText("3 × 120.5 kg")).toBeInTheDocument();
    expect(screen.getByText("1500.75 kg")).toBeInTheDocument();
    expect(screen.getByText("1000.5 kg")).toBeInTheDocument();
  });

  it("shows at most ten volume points", async () => {
    vi.mocked(getProgress).mockResolvedValue({
      personalRecords: [],
      volume: Array.from({ length: 12 }, (_, index) => ({
        sessionId: `session-${index}`,
        title: `Workout ${index}`,
        startedAt: "2026-10-27T18:00:00.000Z",
        totalVolumeKg: (index + 1) * 100,
      })),
    });

    render(Progress);

    expect(await screen.findAllByText(/^\d+ kg$/)).toHaveLength(10);
  });

  it("retries after a failed load", async () => {
    vi.mocked(getProgress)
      .mockRejectedValueOnce(new Error("Backend unavailable"))
      .mockResolvedValueOnce(progress);

    render(Progress);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable"
    );
    await fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Bench Press")).toBeInTheDocument();
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
