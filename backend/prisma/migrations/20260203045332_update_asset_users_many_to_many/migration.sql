/*
  Warnings:

  - You are about to drop the column `currentUserId` on the `Asset` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_currentUserId_fkey";

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "currentUserId";

-- CreateTable
CREATE TABLE "_AssetToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_AssetToUser_AB_unique" ON "_AssetToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_AssetToUser_B_index" ON "_AssetToUser"("B");

-- AddForeignKey
ALTER TABLE "_AssetToUser" ADD CONSTRAINT "_AssetToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetToUser" ADD CONSTRAINT "_AssetToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
