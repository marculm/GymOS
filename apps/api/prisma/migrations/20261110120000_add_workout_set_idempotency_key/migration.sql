ALTER TABLE "workout_sets" ADD COLUMN "idempotencyKey" TEXT;
UPDATE "workout_sets" SET "idempotencyKey" = gen_random_uuid()::text WHERE "idempotencyKey" IS NULL;
ALTER TABLE "workout_sets" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "workout_sets_workoutSessionId_idempotencyKey_key" ON "workout_sets"("workoutSessionId", "idempotencyKey");
