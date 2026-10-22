# Checkpoint - 22/10/2026

Ramo:
design/storefront-foundation (trabalho AINDA NÃO COMMITADO)

Estado:
- Etapa 1 — Webhook de pagamento (validação de segurança):
  ver `knowledge.md` §14.
- Etapa 2 — Fase 3 da migração Product → ProductVariant
  (remoção definitiva de `Product.price`/`Product.stockQuantity`):
  ver `knowledge.md` §7 e §15.

Validações concluídas (2026-10-22):
- Migration 20261022090000_drop_product_legacy_price_stock aplicada
  (23 migrações na BD `pfautoparts`)
- Prisma Client gerado
- Typecheck passou (tsc --noEmit)
- 1836 testes a passar (118 ficheiros) + 3 skipped (vitest run)
- ESLint passou
- Build de produção passou
  (aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é pré-existente)

Próximo passo:
Rever o diff das duas etapas e commitar.
