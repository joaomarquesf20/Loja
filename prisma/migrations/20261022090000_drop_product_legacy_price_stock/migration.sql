-- Phase 3: drop the legacy product-level price and stockQuantity fields.
-- ProductVariant is the single source of truth for price and stock;
-- the storefront lists the cheapest active variant price and any
-- active variant in stock straight from its variants.

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
DROP COLUMN "stockQuantity";
