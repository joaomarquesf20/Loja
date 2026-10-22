# Checkpoint - 22/10/2026

Ramo:
design/storefront-foundation (trabalho por commitar: etapa 4 + correção
dos marcadores de rebase)

Estado:
- Etapa 1 — Webhook de pagamento (validação de segurança):
  commitada (ee49f8b); ver `knowledge.md` §14.
- Etapa 2 — Fase 3 da migração Product → ProductVariant
  (remoção definitiva de `Product.price`/`Product.stockQuantity`):
  commitada (7a32c20); ver `knowledge.md` §7 e §15.
- Etapa 3 — Emails transacionais Resend/React Email:
  commitada (código das templates); ver `knowledge.md` §16.
- Etapa 4 — Área de cliente / histórico de encomendas:
  **por commitar** (3 ficheiros alterados + 4 novos); ver `knowledge.md` §17.

Correção pendente de commit (importante):
- O `git pull --rebase` do utilizador deixou marcadores de conflito
  `<<<<<<<…` commitados em 7 ficheiros (os commits 3dc04e5/7a32c20 não
  compilavam: catalog.ts, products.ts, checkout-payment.test.ts,
  admin/products/products-client.tsx e testes).
- Foi restaurada a versão validada dos 7 ficheiros a partir do `cc3eb93`
  (lado local da mesma migração):
  `git restore --source=cc3eb93 --worktree -- <ficheiros>`. `git status`
  mostra-os como `modified` — é esta a correção por commitar.

Alterações não commitadas (`git status`):
- modified: src/app/conta/orders-client.test.tsx, src/app/conta/orders-client.tsx,
  src/emails/order-status-update.tsx
- untracked: src/components/storefront/order-status-badge.tsx(+.test.tsx),
  src/lib/order-status-labels.ts(+.test.ts)
- modified (restauro do rebase): src/app/admin/products/products-client.test.tsx,
  src/app/admin/products/products-client.tsx, src/server/catalog.test.ts,
  src/server/catalog.ts, src/server/checkout-payment.test.ts,
  src/server/products.test.ts, src/server/products.ts

Validações concluídas (2026-10-22):
- Typecheck passou (tsc --noEmit)
- 1876 testes a passar (124 ficheiros) + 3 skipped (vitest run)
- ESLint passou
- Build de produção passou
  (aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é pré-existente)

Próximos passos:
1. Commitar primeiro a correção do rebase (os 7 ficheiros restaurados),
   p.ex. `fix: restore validated catalog/product files after conflicted
   rebase`.
2. Depois commitar a etapa 4 em bloco próprio, p.ex.
   `feat: order status badges and shared pt-PT labels in customer area`.
3. Revisão do diff fica ao encargo do utilizador (posição de "theirs/ours"
   nos 7 ficheiros restaurados).
