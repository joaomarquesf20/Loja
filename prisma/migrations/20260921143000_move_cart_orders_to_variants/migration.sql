-- Reconcile every existing default variant with the current
-- legacy Product commercial fields before variants become authoritative.
--
-- Phase 1 deliberately left the old commercial flow active, so Product
-- may have changed since the initial backfill. Default SKUs are first
-- moved to deterministic temporary values to make SKU swaps/reuse safe
-- while preserving ProductVariant_sku_key throughout the migration.
UPDATE "ProductVariant"
SET "sku" =
  '__PFA_PHASE2_SYNC__' || "id"
WHERE "optionKey" = 'default';

UPDATE "ProductVariant" AS variant
SET
    "sku" = product."sku",
    "price" = product."price",
    "stockQuantity" = product."stockQuantity",
    "isActive" = product."isActive"
FROM "Product" AS product
WHERE
    variant."productId" = product."id"
    AND variant."optionKey" = 'default';

-- Defensive Phase 1 backfill.
-- Products created after the first variant migration but before this
-- migration receive the same single/default variant contract.
INSERT INTO "ProductVariant" (
    "id",
    "productId",
    "sku",
    "price",
    "stockQuantity",
    "isActive",
    "images",
    "position",
    "optionKey"
)
SELECT
    'pv_default_' || product."id",
    product."id",
    product."sku",
    product."price",
    product."stockQuantity",
    product."isActive",
    ARRAY[]::TEXT[],
    0,
    'default'
FROM "Product" AS product
WHERE NOT EXISTS (
    SELECT 1
    FROM "ProductVariant" AS variant
    WHERE variant."productId" = product."id"
);

-- Cart items become variant-aware while retaining productId for
-- catalogue context and transitional compatibility.
ALTER TABLE "CartItem"
ADD COLUMN "productVariantId" TEXT;

UPDATE "CartItem" AS cart
SET "productVariantId" = variant."id"
FROM "ProductVariant" AS variant
WHERE
    variant."productId" = cart."productId"
    AND variant."optionKey" = 'default';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CartItem"
    WHERE "productVariantId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill productVariantId for every CartItem';
  END IF;
END $$;

ALTER TABLE "CartItem"
ALTER COLUMN "productVariantId" SET NOT NULL;

DROP INDEX "CartItem_userId_productId_key";

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

-- Existing order lines are also attached to the default variant.
-- Their historical option snapshot is empty because these purchases
-- predate selectable variants.
ALTER TABLE "OrderItem"
ADD COLUMN "productVariantId" TEXT,
ADD COLUMN "variantOptionsAtPurchase" JSONB;

UPDATE "OrderItem" AS item
SET
    "productVariantId" = variant."id",
    "variantOptionsAtPurchase" = '[]'::jsonb
FROM "ProductVariant" AS variant
WHERE
    variant."productId" = item."productId"
    AND variant."optionKey" = 'default';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "OrderItem"
    WHERE
      "productVariantId" IS NULL
      OR "variantOptionsAtPurchase" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill variant data for every OrderItem';
  END IF;
END $$;

ALTER TABLE "OrderItem"
ALTER COLUMN "productVariantId" SET NOT NULL,
ALTER COLUMN "variantOptionsAtPurchase" SET NOT NULL;

DROP INDEX "OrderItem_orderId_productId_key";

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
