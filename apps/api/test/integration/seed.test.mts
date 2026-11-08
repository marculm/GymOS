import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/prisma-client.mts";

const apiRoot = fileURLToPath(new URL("../..", import.meta.url));
const email = `seed-${crypto.randomUUID()}@gymos.app`;
const SEEDED_EXERCISE = "Barbell Bench Press";
const STARTER_PLAN = "Push Day";

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
      await prisma.workoutPlan.count({ where: { user: { email }, name: STARTER_PLAN } })
    ).toBe(1);
    expect(
      await prisma.workoutPlanExercise.count({
        where: { plan: { user: { email }, name: STARTER_PLAN } },
      })
    ).toBe(3);
  });

  it("does not recreate a deleted starter plan on a later run", async () => {
    runSeed();
    await prisma.workoutPlan.deleteMany({ where: { user: { email } } });

    runSeed();

    expect(await prisma.workoutPlan.count({ where: { user: { email } } })).toBe(0);
  });

  it("provisions the starter data on first owner creation", async () => {
    runSeed();

    expect(
      await prisma.workoutPlan.count({ where: { user: { email }, name: STARTER_PLAN } })
    ).toBe(1);
    expect(
      await prisma.exercise.count({ where: { name: SEEDED_EXERCISE } })
    ).toBeGreaterThan(0);
  });

  it("does not recreate renamed starter rows on a later run", async () => {
    runSeed();

    const exercise = await prisma.exercise.findUniqueOrThrow({
      where: { name: SEEDED_EXERCISE },
    });
    const plan = await prisma.workoutPlan.findFirstOrThrow({
      where: { user: { email }, name: STARTER_PLAN },
    });
    const renamedExercise = `renamed-${crypto.randomUUID()}`;
    const renamedPlan = `Renamed Plan ${crypto.randomUUID()}`;

    try {
      await prisma.exercise.update({
        where: { id: exercise.id },
        data: { name: renamedExercise },
      });
      await prisma.workoutPlan.update({
        where: { id: plan.id },
        data: { name: renamedPlan },
      });
      const exerciseCount = await prisma.exercise.count();

      runSeed();

      expect(await prisma.exercise.count({ where: { name: SEEDED_EXERCISE } })).toBe(0);
      expect(await prisma.exercise.count()).toBe(exerciseCount);
      expect(await prisma.workoutPlan.count({ where: { user: { email } } })).toBe(1);
      expect(
        await prisma.workoutPlan.count({ where: { user: { email }, name: STARTER_PLAN } })
      ).toBe(0);
    } finally {
      await prisma.exercise.update({
        where: { id: exercise.id },
        data: { name: exercise.name },
      });
    }
  });
});
