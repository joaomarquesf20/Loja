-- ProductImport: histórico de importações em massa do catálogo.
CREATE TABLE "ProductImport" (
    "id"               TEXT NOT NULL,
    "fileName"         TEXT NOT NULL,
    "mode"             TEXT NOT NULL,
    "status"           TEXT NOT NULL,
    "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"       TIMESTAMP(3),
    "createdBy"        TEXT,
    "createdProducts"  INTEGER NOT NULL DEFAULT 0,
    "updatedProducts"  INTEGER NOT NULL DEFAULT 0,
    "createdVariants"  INTEGER NOT NULL DEFAULT 0,
    "updatedVariants"  INTEGER NOT NULL DEFAULT 0,
    "errorCount"       INTEGER NOT NULL DEFAULT 0,
    "errors"           JSONB NOT NULL DEFAULT '[]',
    "warnings"         JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ProductImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductImport_startedAt_idx" ON "ProductImport"("startedAt");
