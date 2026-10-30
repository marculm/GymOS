import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ConcurrentUpdateError } from "../service/errors.mts";
import { withRotationReplaceRetry } from "./rotation-repository.mts";

function uniqueConflict() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("withRotationReplaceRetry", () => {
  it("returns the operation result when it succeeds", async () => {
    await expect(withRotationReplaceRetry(async () => "ok")).resolves.toBe("ok");
  });

  it("retries unique conflicts", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(uniqueConflict())
      .mockRejectedValueOnce(uniqueConflict())
      .mockResolvedValueOnce("ok");

    await expect(withRotationReplaceRetry(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("maps exhausted conflicts to a concurrent update error", async () => {
    const operation = vi.fn().mockRejectedValue(uniqueConflict());

    await expect(withRotationReplaceRetry(operation)).rejects.toBeInstanceOf(
      ConcurrentUpdateError
    );
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("rethrows other errors", async () => {
    const error = new Error("boom");
    const operation = vi.fn(async () => {
      throw error;
    });

    await expect(withRotationReplaceRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
