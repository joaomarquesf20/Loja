-- CreateTable
CREATE TABLE "GuestCartMerge" (
    "id" TEXT NOT NULL,
    "mergeKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "mergedItemCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestCartMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestCartMerge_mergeKey_key" ON "GuestCartMerge"("mergeKey");

-- CreateIndex
CREATE INDEX "GuestCartMerge_userId_idx" ON "GuestCartMerge"("userId");

-- AddForeignKey
ALTER TABLE "GuestCartMerge" ADD CONSTRAINT "GuestCartMerge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
