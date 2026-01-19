/*
  Warnings:

  - You are about to drop the column `code` on the `Department` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Department_code_key";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "code";
