/*
  Warnings:

  - You are about to drop the `ApprovalStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TransactionApproval` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TransactionCounter` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ApprovalStep" DROP CONSTRAINT "ApprovalStep_roleId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionApproval" DROP CONSTRAINT "TransactionApproval_approverId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionApproval" DROP CONSTRAINT "TransactionApproval_stepId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionApproval" DROP CONSTRAINT "TransactionApproval_transactionId_fkey";

-- AlterTable
ALTER TABLE "StockTransaction" ADD COLUMN     "currentStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workflowId" TEXT;

-- DropTable
DROP TABLE "ApprovalStep";

-- DropTable
DROP TABLE "TransactionApproval";

-- DropTable
DROP TABLE "TransactionCounter";

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'STOCK_TRANSACTION',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL DEFAULT 'ROLE',
    "roleId" TEXT,
    "specificUserId" TEXT,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionStep" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actorId" TEXT,
    "note" TEXT,
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "TransactionStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_code_key" ON "Workflow"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionStep_transactionId_stepId_key" ON "TransactionStep"("transactionId", "stepId");

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionStep" ADD CONSTRAINT "TransactionStep_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "StockTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionStep" ADD CONSTRAINT "TransactionStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionStep" ADD CONSTRAINT "TransactionStep_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
