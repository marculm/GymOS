import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/prisma-client.mts";

const apiRoot = fileURLToPath(new URL("../..", import.meta.url));
const email = `seed-${crypto.randomUUID()}@gymos.app`;

function runSeed() {
  execFileSync("bun", ["prisma/seed.mts"], {
    cwd: apiRoot,
    env: { ...process.env, GYMOS_USER_EMAIL: email },
    stdio: "pipe",
    timeout: 30_000,
  });
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("seed", () => {
  it("provisions the configured owner idempotently", async () => {
    runSeed();
    runSeed();

    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(
      await prisma.workoutPlan.count({ where: { user: { email }, name: "Push Day" } })
    ).toBe(1);
    expect(
      await prisma.workoutPlanExercise.count({
        where: { plan: { user: { email }, name: "Push Day" } },
      })
    ).toBe(3);
  });
});
