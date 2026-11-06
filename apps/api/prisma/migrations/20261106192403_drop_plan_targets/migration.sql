/*
  Warnings:

  - You are about to drop the columns `targetSets`, `targetReps`, and `targetWeightKg` on the `workout_plan_exercises` table. All the data in these columns will be lost.

*/
-- AlterTable
ALTER TABLE "workout_plan_exercises" DROP COLUMN "targetSets",
DROP COLUMN "targetReps",
DROP COLUMN "targetWeightKg";
