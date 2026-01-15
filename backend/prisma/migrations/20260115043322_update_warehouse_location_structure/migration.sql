-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "bin" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "rack" TEXT;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "description" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PHYSICAL';
