-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "factoryId" TEXT,
ADD COLUMN     "name_content" TEXT NOT NULL DEFAULT 'Chưa có nội dung';

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
