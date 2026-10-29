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
  const exercisesByName = new Map<string, { id: string }>();
  for (const exercise of DEFAULT_EXERCISES) {
    const seeded = await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {},
      create: exercise,
    });
    exercisesByName.set(seeded.name, seeded);
  }
  console.log(`🏋️ Seeded ${DEFAULT_EXERCISES.length} default exercises.`);

  const requireExercise = (name: string) => {
    const exercise = exercisesByName.get(name);
    if (!exercise) {
      throw new Error(`Missing seeded exercise: ${name}`);
    }
    return exercise;
  };

  // 3. Seed demo training plan
  const pushDay = await prisma.workoutPlan.upsert({
    where: { userId_name: { userId: demoUser.id, name: "Push Day" } },
    update: {},
    create: {
      userId: demoUser.id,
      name: "Push Day",
      description: "Chest, shoulders, and triceps",
      exercises: {
        create: [
          { exerciseId: requireExercise("Barbell Bench Press").id, position: 0, targetSets: 4, targetReps: 8, targetWeightKg: 80 },
          { exerciseId: requireExercise("Overhead Shoulder Press").id, position: 1, targetSets: 3, targetReps: 10, targetWeightKg: 40 },
          { exerciseId: requireExercise("Tricep Rope Pushdown").id, position: 2, targetSets: 3, targetReps: 12 },
        ],
      },
    },
  });
  console.log(`🏋️ Demo plan: ${pushDay.name}`);

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
