/*
  Warnings:

  - You are about to drop the column `code` on the `Department` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Department_code_key";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "code",
ADD COLUMN     "name_content" TEXT NOT NULL DEFAULT 'Chưa có nội dung';
