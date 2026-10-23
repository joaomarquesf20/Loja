CREATE TYPE "ShippingMethod" AS ENUM (
  'STANDARD',
  'EXPRESS'
);

ALTER TABLE "CheckoutRegionRule"
ADD COLUMN "expressShippingCost" DECIMAL(10,2);

ALTER TABLE "Order"
ADD COLUMN "shippingMethod" "ShippingMethod";
