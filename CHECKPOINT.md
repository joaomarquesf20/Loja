# Checkpoint - 22/10/2026

Ramo:
design/storefront-foundation (etapas 1-5 commitadas e pushed;
etapa 6 por commitar)

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
  checkout (expresso end-to-end): **por commitar**;
  ver `knowledge.md` §19.

Alterações não commitadas (`git status`):
- new: prisma/migrations/20261022120000_shipping_method/
  (migração já aplicada no BD local `pfautoparts`)
- new: src/lib/shipping-methods.ts(+.test.ts)
  (catálogo partilhado de rótulos/estimativas)
- modified: prisma/schema.prisma
  (enum `ShippingMethod`; `CheckoutRegionRule.expressShippingCost`)
- modified: src/server/shipping-pricing.ts(+.test.ts)
  (suplemento expresso por cima dos portes calculados)
- modified: src/server/checkout.ts(+.test.ts)
  (`normalizeShippingMethod`, `getExpressAvailability`,
  fingerprint v5, encomenda guarda `shippingMethod`)
- modified: src/app/api/checkout/route.ts(+.test.ts) e
  src/app/api/checkout/preview/route.ts(+.test.ts)
  (campo literal validado; `INVALID_SHIPPING_METHOD`)
- modified: src/app/checkout/checkout-client.tsx(+.test.tsx) e
  src/app/checkout/checkout-payment-client.test.tsx
  (fieldset 'Velocidade de entrega'; expresso desativado quando
  `preview.expressAvailable === false`)
- modified: src/server/orders.ts(+.test.ts)
  (`shippingMethod` nulo-explícito; legacy mantém nulo)
- modified: src/app/conta/orders-client.tsx(+.test.tsx)
  (título/estimativa via catálogo; legacy → 'Envio standard')
- modified: src/server/email.ts(+.test.ts) e
  src/emails/order-confirmation.tsx(+.test.tsx)
  (rótulo + estimativa no email; legacy → standard;
  levantamento sem rótulo de envio)
- modified: src/server/commercial-settings.ts(+.test.ts) e
  src/app/admin/commercial-settings/commercial-settings-client.tsx
  (+.test.tsx) e src/app/api/admin/commercial-settings/route.test.ts
  (campo 'Suplemento expresso (€)'; vazio = desativado; '9.90'
  em instalação nova)
- modified: src/server/products.test.ts
  (fixture de `bulkySettings` com campos novos)

Validações concluídas (2026-10-22):
- Typecheck passou (tsc --noEmit)
- 1947 testes a passar (127 ficheiros) + 3 skipped (vitest run)
- ESLint passou (0 avisos)
- Build de produção passou
  (aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é pré-existente;
  `/admin/commercial-settings` fica dinâmico por ler a BD)

Próximos passos:
1. Commitar a etapa 6 em bloco próprio, p.ex.
   `feat(checkout): dynamic shipping engine with express method`.
2. Revisão do diff fica ao encargo do utilizador.
