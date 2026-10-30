-- CreateTable
CREATE TABLE "workout_rotation_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "workout_rotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_rotation_items_userId_position_key" ON "workout_rotation_items"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "workout_rotation_items_userId_planId_key" ON "workout_rotation_items"("userId", "planId");

-- CreateIndex
CREATE INDEX "workout_rotation_items_planId_idx" ON "workout_rotation_items"("planId");

-- AddForeignKey
ALTER TABLE "workout_rotation_items" ADD CONSTRAINT "workout_rotation_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_rotation_items" ADD CONSTRAINT "workout_rotation_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
