-- Phase 2: move cart and order lines to ProductVariant.
--
-- Product remained the commercial source of truth between Phase 1 and
-- this cutover. Reconcile the default variants one last time so edits
-- made through the legacy admin during that interval are preserved.
--
-- Temporarily move existing default SKUs out of the way. This makes SKU
-- swaps/reuse between products safe while ProductVariant_sku_key remains
-- enforced throughout the migration.
UPDATE "ProductVariant"
SET "sku" =
  '__PFA_PHASE2_SYNC__' || "id"
WHERE "optionKey" = 'default';

-- Defensive backfill for a product created after the Phase 1 migration
-- but before the transitional default-variant bridge was pulled locally.
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
    WHERE
      variant."productId" = product."id"
      AND variant."optionKey" = 'default'
);

-- At the cutover boundary the legacy Product values are still the
-- authoritative values for the single/default variant.
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
