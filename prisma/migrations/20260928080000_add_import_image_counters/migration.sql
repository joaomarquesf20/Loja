-- Contadores de imagens no histórico de importação
-- (imagens criadas vs. já existentes e reutilizadas).
ALTER TABLE "ProductImport" ADD COLUMN "createdImages" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductImport" ADD COLUMN "matchedImages" INTEGER NOT NULL DEFAULT 0;
