-- Phase 2: make ProductVariant the purchasable unit for cart and orders.
-- The Product commercial fields remain in place during the progressive migration.

-- CartItem: add the variant reference as nullable first so existing rows can be backfilled.
ALTER TABLE "CartItem"
ADD COLUMN "productVariantId" TEXT;

-- Existing carts are mapped explicitly to the default variant for the same product.
UPDATE "CartItem" AS cart_item
SET "productVariantId" = variant."id"
FROM "ProductVariant" AS variant
WHERE variant."productId" = cart_item."productId"
  AND variant."optionKey" = 'default';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CartItem"
    WHERE "productVariantId" IS NULL
  ) THEN
    RAISE EXCEPTION 'CartItem backfill failed: missing default ProductVariant';
  END IF;
END
$$;

DROP INDEX IF EXISTS "CartItem_userId_productId_key";

ALTER TABLE "CartItem"
ALTER COLUMN "productVariantId" SET NOT NULL;

CREATE UNIQUE INDEX "CartItem_userId_productVariantId_key"
ON "CartItem"("userId", "productVariantId");

CREATE INDEX "CartItem_productId_idx"
ON "CartItem"("productId");

CREATE INDEX "CartItem_productVariantId_idx"
ON "CartItem"("productVariantId");

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_productVariantId_fkey"
FOREIGN KEY ("productVariantId")
REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- OrderItem: historical orders are mapped to the default variant.
-- Existing rows predate commercial variants, so their option snapshot is an empty array.
ALTER TABLE "OrderItem"
ADD COLUMN "productVariantId" TEXT,
ADD COLUMN "variantOptionsAtPurchase" JSONB;

UPDATE "OrderItem" AS order_item
SET "productVariantId" = variant."id",
    "variantOptionsAtPurchase" = '[]'::jsonb
FROM "ProductVariant" AS variant
WHERE variant."productId" = order_item."productId"
  AND variant."optionKey" = 'default';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "OrderItem"
    WHERE "productVariantId" IS NULL
       OR "variantOptionsAtPurchase" IS NULL
  ) THEN
    RAISE EXCEPTION 'OrderItem backfill failed: missing default ProductVariant';
  END IF;
END
$$;

DROP INDEX IF EXISTS "OrderItem_orderId_productId_key";

ALTER TABLE "OrderItem"
ALTER COLUMN "productVariantId" SET NOT NULL,
ALTER COLUMN "variantOptionsAtPurchase" SET NOT NULL;

CREATE UNIQUE INDEX "OrderItem_orderId_productVariantId_key"
ON "OrderItem"("orderId", "productVariantId");

CREATE INDEX "OrderItem_productId_idx"
ON "OrderItem"("productId");

CREATE INDEX "OrderItem_productVariantId_idx"
ON "OrderItem"("productVariantId");

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_productVariantId_fkey"
FOREIGN KEY ("productVariantId")
REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
