import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_EXERCISES = [
  {
    name: "Barbell Bench Press",
    muscleGroup: "chest",
    description: "Compound chest exercise targeting pectoral muscles, anterior deltoids, and triceps.",
  },
  {
    name: "Barbell Back Squat",
    muscleGroup: "legs",
    description: "Compound lower body exercise targeting quadriceps, glutes, and core.",
  },
  {
    name: "Conventional Deadlift",
    muscleGroup: "back",
    description: "Posterior chain exercise targeting lower back, glutes, hamstrings, and traps.",
  },
  {
    name: "Overhead Shoulder Press",
    muscleGroup: "shoulders",
    description: "Compound shoulder exercise targeting anterior and lateral deltoids.",
  },
  {
    name: "Pull-Up",
    muscleGroup: "back",
    description: "Upper body pulling exercise targeting latissimus dorsi and biceps.",
  },
  {
    name: "Barbell Bent-Over Row",
    muscleGroup: "back",
    description: "Compound back exercise targeting lats, rhomboids, and rear deltoids.",
  },
  {
    name: "Barbell Bicep Curl",
    muscleGroup: "arms",
    description: "Isolation exercise targeting the biceps brachii.",
  },
  {
    name: "Tricep Rope Pushdown",
    muscleGroup: "arms",
    description: "Cable isolation exercise targeting all three heads of the triceps.",
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create default demo user
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@gymos.app" },
    update: {},
    create: {
      email: "demo@gymos.app",
      name: "Demo Athlete",
    },
  });
  console.log(`👤 Demo User: ${demoUser.email} (${demoUser.id})`);

  // 2. Seed exercises
  for (const exercise of DEFAULT_EXERCISES) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {},
      create: exercise,
    });
  }
  console.log(`🏋️ Seeded ${DEFAULT_EXERCISES.length} default exercises.`);

  console.log("✅ Database seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
