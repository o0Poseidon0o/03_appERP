-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockTransaction" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
