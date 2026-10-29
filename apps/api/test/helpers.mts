import { prisma } from "../src/db/client.mts";

export const TEST_EMAIL = `test-${crypto.randomUUID()}@gymos.app`;
let testUserId: string | null = null;

export async function createTestUser() {
  process.env.GYMOS_USER_EMAIL = TEST_EMAIL;
  const user = await prisma.user.create({ data: { email: TEST_EMAIL, name: "Test User" } });
  testUserId = user.id;
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
  delete process.env.GYMOS_USER_EMAIL;
  await prisma.$disconnect();
}

export async function firstExercise() {
  return prisma.exercise.findFirstOrThrow({ orderBy: { name: "asc" } });
}
