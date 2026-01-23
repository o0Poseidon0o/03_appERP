/*
  Warnings:

  - You are about to drop the column `transactionId` on the `ApprovalLog` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `StockTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `StockTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `StockTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `StockTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `currentStep` on the `StockTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `StockTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `workflowId` on the `StockTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `documentType` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `specificUserId` on the `WorkflowStep` table. All the data in the column will be lost.
  - You are about to drop the `TransactionStep` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[ticketId]` on the table `StockTransaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ticketId` to the `ApprovalLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ticketId` to the `StockTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ApprovalLog" DROP CONSTRAINT "ApprovalLog_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransaction" DROP CONSTRAINT "StockTransaction_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransaction" DROP CONSTRAINT "StockTransaction_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransaction" DROP CONSTRAINT "StockTransaction_warehouseKeeperId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransaction" DROP CONSTRAINT "StockTransaction_workflowId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionStep" DROP CONSTRAINT "TransactionStep_actorId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionStep" DROP CONSTRAINT "TransactionStep_stepId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionStep" DROP CONSTRAINT "TransactionStep_transactionId_fkey";

-- DropIndex
DROP INDEX "StockTransaction_code_key";

-- AlterTable
ALTER TABLE "ApprovalLog" DROP COLUMN "transactionId",
ADD COLUMN     "ticketId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockTransaction" DROP COLUMN "code",
DROP COLUMN "completedAt",
DROP COLUMN "createdAt",
DROP COLUMN "creatorId",
DROP COLUMN "currentStep",
DROP COLUMN "status",
DROP COLUMN "workflowId",
ADD COLUMN     "ticketId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Workflow" DROP COLUMN "documentType",
ADD COLUMN     "targetType" TEXT NOT NULL DEFAULT 'STOCK';

-- AlterTable
ALTER TABLE "WorkflowStep" DROP COLUMN "specificUserId";

-- DropTable
DROP TABLE "TransactionStep";

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStep" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actorId" TEXT,
    "note" TEXT,
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "TicketStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TicketStep_ticketId_stepId_key" ON "TicketStep"("ticketId", "stepId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransaction_ticketId_key" ON "StockTransaction"("ticketId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStep" ADD CONSTRAINT "TicketStep_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStep" ADD CONSTRAINT "TicketStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStep" ADD CONSTRAINT "TicketStep_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
