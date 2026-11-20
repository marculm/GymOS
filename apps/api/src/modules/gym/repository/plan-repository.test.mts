import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../generated/prisma/client";
import { PlanRepository } from "./plan-repository.mts";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("../../../config/prisma-client.mts", () => ({
  prisma: { $transaction: transaction },
}));

function recordNotFound() {
  return new Prisma.PrismaClientKnownRequestError("Record not found", {
    code: "P2025",
    clientVersion: "test",
  });
}

describe("PlanRepository.update", () => {
  it("returns null when the plan is deleted during the write", async () => {
    transaction.mockRejectedValueOnce(recordNotFound());

    const repository = new PlanRepository();

    await expect(
      repository.update("user-1", "plan-1", {
        name: "Push",
        exercises: [{ exerciseId: "00000000-0000-4000-8000-000000000001" }],
      })
    ).resolves.toBeNull();
  });
});
