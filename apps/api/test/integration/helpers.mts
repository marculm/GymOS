import { prisma } from "../../src/config/prisma-client.mts";

export const TEST_EMAIL = `test-${crypto.randomUUID()}@gymos.app`;
let testUserId: string | null = null;
let fallbackExerciseId: string | null = null;

export async function createTestUser() {
  process.env.GYMOS_USER_EMAIL = TEST_EMAIL;
  const user = await prisma.user.create({ data: { email: TEST_EMAIL, name: "Test User" } });
  testUserId = user.id;
}

export async function createUser(email: string, name = "Other User") {
  return prisma.user.create({ data: { email, name } });
}

export async function deleteUser(id: string) {
  await prisma.user.deleteMany({ where: { id } });
}

export async function clearTestUserData() {
  if (!testUserId) return;
  await prisma.workoutSession.deleteMany({ where: { userId: testUserId } });
  await prisma.workoutPlan.deleteMany({ where: { userId: testUserId } });
}

export async function cleanupTestUser() {
  if (testUserId) {
    await prisma.user.deleteMany({ where: { id: testUserId } });
  }
  if (fallbackExerciseId) {
    await prisma.exercise.deleteMany({ where: { id: fallbackExerciseId } });
    fallbackExerciseId = null;
  }
  delete process.env.GYMOS_USER_EMAIL;
  await prisma.$disconnect();
}

export async function firstExercise() {
  const active = await prisma.exercise.findFirst({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
  if (active) return active;

  const created = await prisma.exercise.create({
    data: {
      name: `Test Exercise ${crypto.randomUUID()}`,
      muscleGroup: "chest",
    },
  });
  fallbackExerciseId = created.id;
  return created;
}
