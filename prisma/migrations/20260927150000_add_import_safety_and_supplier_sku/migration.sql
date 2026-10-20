-- supplierSku: referência do fornecedor guardada separadamente
-- do SKU interno (identificador estável da loja).
ALTER TABLE "ProductVariant" ADD COLUMN "supplierSku" TEXT;

CREATE INDEX "ProductVariant_supplierSku_idx" ON "ProductVariant"("supplierSku");

-- failureMode: "abort" (por defeito) ou "partial" (escolha
-- explícita do admin para importar linhas válidas apesar de
-- produtos com falha).
ALTER TABLE "ProductImport" ADD COLUMN "failureMode" TEXT NOT NULL DEFAULT 'abort';

-- changes: registo de auditoria das alterações aplicadas
-- (variantes criadas/atualizadas com SKU interno e de fornecedor),
-- suficiente para reverter um import recente com segurança.
ALTER TABLE "ProductImport" ADD COLUMN "changes" JSONB NOT NULL DEFAULT '[]';
