-- CreateEnum
CREATE TYPE "ShippingClass" AS ENUM ('UNASSIGNED', 'STANDARD', 'BULKY', 'HEAVY', 'QUOTE_REQUIRED');

-- CreateEnum
CREATE TYPE "CheckoutRegion" AS ENUM ('PORTUGAL_MAINLAND', 'MADEIRA', 'AZORES', 'INTERNATIONAL');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pricesIncludeTax" BOOLEAN,
ADD COLUMN     "shippingClassApplied" "ShippingClass",
ADD COLUMN     "shippingRegion" "CheckoutRegion",
ADD COLUMN     "taxRatePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "shippingClassAtPurchase" "ShippingClass";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shippingClass" "ShippingClass" NOT NULL DEFAULT 'UNASSIGNED';

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'store',
    "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutRegionRule" (
    "region" "CheckoutRegion" NOT NULL,
    "checkoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "taxRatePercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutRegionRule_pkey" PRIMARY KEY ("region")
);

-- CreateTable
CREATE TABLE "ShippingRule" (
    "id" TEXT NOT NULL,
    "region" "CheckoutRegion" NOT NULL,
    "shippingClass" "ShippingClass" NOT NULL,
    "checkoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingCost" DECIMAL(10,2),
    "freeShippingThreshold" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingRule_shippingClass_idx" ON "ShippingRule"("shippingClass");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingRule_region_shippingClass_key" ON "ShippingRule"("region", "shippingClass");

-- CreateIndex
CREATE INDEX "Product_shippingClass_idx" ON "Product"("shippingClass");

-- AddForeignKey
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_region_fkey" FOREIGN KEY ("region") REFERENCES "CheckoutRegionRule"("region") ON DELETE RESTRICT ON UPDATE CASCADE;
