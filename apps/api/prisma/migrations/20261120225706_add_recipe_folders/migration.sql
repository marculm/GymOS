-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "recipe_folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_folders_userId_parentId_position_idx" ON "recipe_folders"("userId", "parentId", "position");

-- CreateIndex
CREATE INDEX "recipes_userId_folderId_idx" ON "recipes"("userId", "folderId");

-- AddForeignKey
ALTER TABLE "recipe_folders" ADD CONSTRAINT "recipe_folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_folders" ADD CONSTRAINT "recipe_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "recipe_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "recipe_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
