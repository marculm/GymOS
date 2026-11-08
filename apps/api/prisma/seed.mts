import { PrismaClient } from "@prisma/client";
import { currentUserEmail } from "../src/config/env.mts";

const prisma = new PrismaClient();

const DEFAULT_EXERCISES = [
  {
    name: "Barbell Bench Press",
    muscleGroup: "chest",
    description: "Compound chest exercise targeting pectoral muscles, anterior deltoids, and triceps.",
    defaultSets: 4,
    defaultReps: 8,
    defaultWeightKg: 80,
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
    defaultSets: 3,
    defaultReps: 10,
    defaultWeightKg: 40,
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
    defaultSets: 3,
    defaultReps: 12,
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create the user the API resolves from GYMOS_USER_EMAIL
  const ownerEmail = currentUserEmail();
  const ownerData = {
    email: ownerEmail,
    name: ownerEmail === "demo@gymos.app" ? "Demo Athlete" : "GymOS Owner",
  };
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });

  if (existingOwner) {
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: ownerData,
    });
    console.log(`👤 Owner: ${owner.email} (${owner.id})`);
    // Seeded rows are editable (ADR-0024): a rename or delete must survive reruns.
    console.log("🌱 Starter data already provisioned; leaving exercises and plans as-is.");
    return;
  }

  // First provision commits as one transaction, so a failed run cannot leave an
  // owner without starter data.
  await prisma.$transaction(async (tx) => {
    const owner = await tx.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: ownerData,
    });
    console.log(`👤 Owner: ${owner.email} (${owner.id})`);

    // 2. Seed exercises
    const exercisesByName = new Map<string, { id: string }>();
    for (const exercise of DEFAULT_EXERCISES) {
      const seeded = await tx.exercise.upsert({
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

    // 3. Seed starter training plan
    const pushDay = await tx.workoutPlan.upsert({
      where: { userId_name: { userId: owner.id, name: "Push Day" } },
      update: {},
      create: {
        userId: owner.id,
        name: "Push Day",
        description: "Chest, shoulders, and triceps",
        exercises: {
          create: [
            { exerciseId: requireExercise("Barbell Bench Press").id, position: 0 },
            { exerciseId: requireExercise("Overhead Shoulder Press").id, position: 1 },
            { exerciseId: requireExercise("Tricep Rope Pushdown").id, position: 2 },
          ],
        },
      },
    });
    console.log(`🏋️ Starter plan: ${pushDay.name}`);
  });

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
