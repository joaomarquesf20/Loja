# Checkpoint - 23/10/2026

Ramo:
design/storefront-foundation (etapas 1-7 commitadas e pushed;
etapa 8 — polimento final — em progresso, não commitada)

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
  rápida: commitada (2ea2eb7); ver `knowledge.md` §20.
- Etapa 8 — Polimento final, auditoria de performance e SEO
  base: **em progresso** (código + gate concluídos; falta
  commit); ver `knowledge.md` §21.

Alterações não commitadas (`git status`, etapa 8):
- new: src/server/catalog-request.ts
  (getCatalogCategories = cache(listCatalogCategories) — dedupe
  por request entre layout e páginas)
- new: src/app/seo.ts
  (SITE_NAME/SITE_DESCRIPTION + buildPageMetadata: título,
  descrição, canonical, Open Graph)
- modified: src/app/layout.tsx
  (metadataBase/template/OG/Twitter + categorias memoizadas)
- modified: src/app/page.tsx
  (metadata da home com absoluteTitle + og:image hero)
- modified: src/app/produtos/[slug]/page.tsx
  (generateMetadata por produto + leitura única via cache)
- modified: src/app/categorias/[slug]/page.tsx
  (generateMetadata por categoria, canonical sem filtros)
- modified: src/app/checkout/page.tsx
  (dynamic = 'force-dynamic' — resolve DYNAMIC_SERVER_USAGE
  — e título 'Finalizar compra')
- modified: src/app/carrinho/page.tsx (título 'Carrinho de compras')
- modified: src/app/sitemap.ts
  (force-dynamic → revalidate = 3600 + fallback só-da-home)

Validações concluídas (2026-10-23):
- Typecheck passou (tsc --noEmit)
- 1979 testes a passar (130 ficheiros) + 3 skipped (vitest run)
- ESLint passou (0 avisos)
- Build de produção SEM avisos:
  - log 'Checkout cart check failed' / DYNAMIC_SERVER_USAGE
    já não aparece; /checkout permanece ƒ (por sessão)
  - /sitemap.xml passou a prerender com ISR de 1h (1h 1y)
  - /api/admin/inventory permanece no mapa de rotas ƒ
- Sem migração; sem novos testes (metadados cobertos pelo build)

Fase de fundação da vitrine: completa (etapas 1-8) exceto o
commit da etapa 8.

Próximos passos:
1. Commitar a etapa 8 em bloco próprio, p.ex.
   `feat(storefront): seo baseline, request dedupe and build polish`.
2. Abrir PR de `design/storefront-foundation` para `main`.
