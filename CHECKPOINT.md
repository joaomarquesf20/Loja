# Checkpoint - 23/10/2026

Ramo:
design/storefront-foundation — **épico COMPLETO**: 8 etapas
commitadas e pushed, e a branch mergeada em `main` com
`--no-ff` (mensagem "Merge branch 'design/storefront-foundation':
Complete Storefront Foundation Epic (Stages 1-8)").

Estado final por etapa:
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
  base: **commitada (c4b4f9a)**; ver `knowledge.md` §21.

Nota final:
A fase de fundação da vitrine está completa, production-ready e
mergeada em `main`. Gate final verde: typecheck limpo; 1979
testes a passar (130 ficheiros) + 3 skipped; ESLint limpo; build de
produção SEM avisos (DYNAMIC_SERVER_USAGE no /checkout resolvido,
/checkout ƒ por sessão, /sitemap.xml com ISR de 1h). SEO base com
Open Graph/canonical em todas as páginas públicas; leituras de
catálogo deduplicadas por request (React cache); validação de
stock/preço autoritativa no checkout (páginas de comércio
mantêm force-dynamic).

Conteúdo commitado na etapa 8 (c4b4f9a):
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

Próximos passos (pós-épico):
- Desenhar e executar o próximo bloco do roadmap a partir de
  `main` (nova branch de fases).
- Registar no `knowledge.md` novas secções por etapa nova.
