/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `ItemCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `ItemCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ItemCategory_name_key";

-- AlterTable
ALTER TABLE "ItemCategory" ADD COLUMN     "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_code_key" ON "ItemCategory"("code");
