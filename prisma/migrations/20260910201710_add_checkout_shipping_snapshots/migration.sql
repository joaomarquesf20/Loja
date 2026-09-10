-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "bulkyShippingCost" DECIMAL(10,2),
ADD COLUMN     "freeShippingApplied" BOOLEAN,
ADD COLUMN     "freeShippingThreshold" DECIMAL(10,2),
ADD COLUMN     "nonVolumousShippingCost" DECIMAL(10,2),
ADD COLUMN     "nonVolumousSubtotal" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "shippingCostAtPurchase" DECIMAL(10,2);
