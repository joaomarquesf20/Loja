-- Alinhamento de drift: "Product"."images" era NOT NULL no schema,
-- mas em bases criadas antes do array scalar NOT NULL do Prisma 7 a
-- coluna ficou nullable e sem default (o importador gravava produtos
-- sem images, que depois falhavam nas variantes). Backfill e NOT NULL.
UPDATE "Product" SET "images" = ARRAY[]::text[] WHERE "images" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "images" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "images" SET DEFAULT ARRAY[]::text[];
