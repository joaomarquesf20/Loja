# Checkpoint - 23/10/2026

Ramo:
design/storefront-foundation (etapas 1-6 commitadas e pushed;
etapa 7 em progresso)

Estado:
- Etapa 1 — Webhook de pagamento (validação de segurança):
  commitada (ee49f8b); ver `knowledge.md` §14.
- Etapa 2 — Fase 3 da migração Product → ProductVariant
  (remoção definitiva de `Product.price`/`Product.stockQuantity`):
  commitada (7a32c20); ver `knowledge.md` §7 e §15.
- Etapa 3 — Emails transacionais Resend/React Email:
  commitada (código das templates); ver `knowledge.md` §16.
- Etapa 4 — Área de cliente / histórico de encomendas:
  commitada (9b30328); ver `knowledge.md` §17.
- Correção do rebase (marcadores de conflito):
  commitada (7869db9). Detalhes no fim da §17.
- Etapa 5 — Painel admin: resumo de vendas e analytics:
  commitada (7d21479); ver `knowledge.md` §18.
- Etapa 6 — Motor de envio dinâmico + método de envio no
  checkout (expresso end-to-end):
  commitada (2f171fc); ver `knowledge.md` §19.
- Etapa 7 — Inventário: alertas de stock baixo e correção
  rápida: **em progresso** (código + testes + gate concluídos;
  documentação a seguir); ver `knowledge.md` §20.

Alterações não commitadas (`git status`, etapa 7):
- new: src/server/inventory.ts(+.test.ts)
  (consulta de stock baixo + updateVariantStock; §13)
- new: src/app/api/admin/inventory/route.ts(+.test.ts)
  (GET ?threshold= / PATCH { variantId, stock }; requireAdmin)
- new: src/components/admin/inventory-alerts.tsx(+.test.tsx)
  (widget 'Alertas de ruptura' com correção rápida inline)
- modified: src/app/admin/page.tsx(+.test.tsx)
  (injeta InventoryAlerts via Promise.all com listLowStockVariants)
- modified: knowledge.md, CHECKPOINT.md
  (§20 nova; etapa 6 marcada como commitada 2f171fc)

Validações concluídas (2026-10-23):
- Typecheck passou (tsc --noEmit)
- 1979 testes a passar (130 ficheiros) + 3 skipped (vitest run)
- ESLint passou (0 avisos)
- Build de produção passou
  (aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é pré-existente;
  `/api/admin/inventory` agora no mapa de rotas ƒ)
- Sem alteração de schema (sem migração)

Próximos passos:
1. Commitar a etapa 7 em bloco próprio, p.ex.
   `feat(admin): low stock alerts with inline stock fix`.
2. Revisão do diff fica ao encargo do utilizador.
