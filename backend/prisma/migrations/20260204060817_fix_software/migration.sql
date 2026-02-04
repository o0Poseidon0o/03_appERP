-- DropForeignKey
ALTER TABLE "AssetComponent" DROP CONSTRAINT "AssetComponent_assetId_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceLog" DROP CONSTRAINT "MaintenanceLog_assetId_fkey";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "domainUser" TEXT;

-- CreateIndex
CREATE INDEX "InstalledSoftware_assetId_idx" ON "InstalledSoftware"("assetId");

-- CreateIndex
CREATE INDEX "InstalledSoftware_name_idx" ON "InstalledSoftware"("name");

-- AddForeignKey
ALTER TABLE "AssetComponent" ADD CONSTRAINT "AssetComponent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
