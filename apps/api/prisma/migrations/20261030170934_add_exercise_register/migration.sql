-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "defaultReps" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "defaultSets" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "defaultWeightKg" DOUBLE PRECISION,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "exercises_deletedAt_idx" ON "exercises"("deletedAt");
