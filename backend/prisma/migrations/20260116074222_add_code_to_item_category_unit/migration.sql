/*
  Warnings:

  - You are about to drop the column `unit` on the `Item` table. All the data in the column will be lost.
  - Added the required column `baseUnit` to the `Item` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Item" DROP COLUMN "unit",
ADD COLUMN     "baseUnit" TEXT NOT NULL,
ALTER COLUMN "qrCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TransactionDetail" ADD COLUMN     "inputQuantity" DOUBLE PRECISION,
ADD COLUMN     "inputUnit" TEXT;

-- CreateTable
CREATE TABLE "ItemUnitConversion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "barcode" TEXT,

    CONSTRAINT "ItemUnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnitConversion_itemId_unitName_key" ON "ItemUnitConversion"("itemId", "unitName");

-- AddForeignKey
ALTER TABLE "ItemUnitConversion" ADD CONSTRAINT "ItemUnitConversion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
