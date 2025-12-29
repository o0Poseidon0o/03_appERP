/*
  Warnings:

  - You are about to drop the column `departmentId` on the `posts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "posts" DROP COLUMN "departmentId",
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true;
