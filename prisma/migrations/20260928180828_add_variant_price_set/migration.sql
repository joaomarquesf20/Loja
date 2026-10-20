-- DropIndex
DROP INDEX "ProductVariant_supplierSku_idx";

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "priceSet" DECIMAL(10,2);
