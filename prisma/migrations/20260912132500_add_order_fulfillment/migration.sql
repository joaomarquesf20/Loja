CREATE TYPE "FulfillmentMethod" AS ENUM (
  'DELIVERY',
  'PICKUP'
);

ALTER TYPE "OrderStatus"
ADD VALUE 'READY_FOR_PICKUP';

ALTER TYPE "OrderStatus"
ADD VALUE 'PICKED_UP';

ALTER TABLE "Order"
ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'DELIVERY',
ALTER COLUMN "shippingAddressLine1" DROP NOT NULL,
ALTER COLUMN "shippingCity" DROP NOT NULL,
ALTER COLUMN "shippingPostalCode" DROP NOT NULL,
ALTER COLUMN "shippingCountry" DROP NOT NULL;
