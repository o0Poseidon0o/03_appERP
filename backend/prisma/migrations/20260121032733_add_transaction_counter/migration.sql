-- CreateTable
CREATE TABLE "TransactionCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCounter_pkey" PRIMARY KEY ("key")
);
