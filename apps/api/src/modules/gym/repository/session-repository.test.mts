import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionRepository } from "./session-repository.mts";

const { deleteMany } = vi.hoisted(() => ({ deleteMany: vi.fn() }));

vi.mock("../../../config/prisma-client.mts", () => ({
  prisma: { workoutSession: { deleteMany } },
}));

describe("SessionRepository.deleteCompleted", () => {
  beforeEach(() => {
    deleteMany.mockReset();
  });

  it("deletes only the user's completed session", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    const repository = new SessionRepository();

    await expect(
      repository.deleteCompleted("user-1", "session-1")
    ).resolves.toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        completedAt: { not: null },
      },
    });
  });

  it("reports a session outside the user's completed history as not found", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    const repository = new SessionRepository();

    await expect(
      repository.deleteCompleted("user-1", "session-1")
    ).resolves.toBe(false);
  });
});
