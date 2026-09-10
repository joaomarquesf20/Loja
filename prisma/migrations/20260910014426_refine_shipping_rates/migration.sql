-- AlterEnum
ALTER TYPE "ShippingClass" ADD VALUE 'SMALL';

-- AlterTable
ALTER TABLE "ShippingRule" ADD COLUMN     "maximumShippingCost" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "ProductShippingRate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "region" "CheckoutRegion" NOT NULL,
    "shippingCost" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductShippingRate_region_idx" ON "ProductShippingRate"("region");

-- CreateIndex
CREATE UNIQUE INDEX "ProductShippingRate_productId_region_key" ON "ProductShippingRate"("productId", "region");

-- AddForeignKey
ALTER TABLE "ProductShippingRate" ADD CONSTRAINT "ProductShippingRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
