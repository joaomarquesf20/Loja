# Checkpoint - 22/10/2026

Ramo:
design/storefront-foundation (etapa 5 por commitar; etapas 1-4
commitadas e pushed)

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
  **por commitar**; ver `knowledge.md` §18.

Alterações não commitadas (`git status`):
- new: src/server/analytics.ts + src/server/analytics.test.ts
- new: src/components/admin/sales-dashboard.tsx(+.test.tsx)
- new: src/app/admin/page.test.tsx
- modified: src/app/admin/page.tsx (injeta SalesDashboard)

Validações concluídas (2026-10-22):
- Typecheck passou (tsc --noEmit)
- 1890 testes a passar (127 ficheiros) + 3 skipped (vitest run)
- ESLint passou (0 avisos)
- Build de produção passou
  (aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é pré-existente;
  `/admin` fica dinâmico `ƒ` por ler a BD na visita)

Próximos passos:
1. Commitar a etapa 5 em bloco próprio, p.ex.
   `feat(admin): sales dashboard with paid-order analytics`.
2. Revisão do diff fica ao encargo do utilizador.
