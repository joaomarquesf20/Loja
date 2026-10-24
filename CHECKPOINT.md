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

---

# Checkpoint - 24/10/2026 — Epic 2: Vehicle Search

Épico: Vehicle Search
Etapa 1-2 — Database Schema and Migration: **COMPLETA** (não
commitada; em `master` @ `7e6ba79` + trabalho novo sem commit).

Estado:
- `prisma/schema.prisma`: adicionado o modelo M2M
  `ProductVariantVehicleCompatibility`
  (`productVariantId` + `vehicleConfigurationId`, FKs com
  `onDelete: Cascade`, `@@unique` composto e índice), com as
  relações `ProductVariant.vehicleCompatibilities` e
  `VehicleConfiguration.variantCompatibilities`. Reutilizada a
  hierarquia existente (`VehicleBrand`/`VehicleModel`/
  `VehicleGeneration`/`VehicleConfiguration`) — não foi criada uma
  segunda hierarquia Make/Engine (nomes do cliente: `VehicleBrand`
  ≙ make; `VehicleConfiguration` ≙ engine, com `engineCode`,
  `displacementCc`, `powerKw`, `bodyType`, `yearFrom`/`yearTo`).
- Reparação incidental: linha em branco restaurada em
  `model Product` entre `createdAt` e o bloco `@@index` (dano
  deixado por edição interrompida anterior).
- Migração aplicada: `20261024145434_add_vehicle_compatibility`
  (25 em `prisma/migrations`; `migrate status`: schema up to date).
- Seed idempotente: `scripts/seed-vehicle-fits.mjs`
  (npm: `npm run dev:vehicles:seed`):
  - Opel / Corsa B / 1993-2000 com configurações
    "1.5 TD Sport" (X15DT) e "1.5 TD" (4EC1-T), ambos
    1488cc/50kW/3-door hatchback/1994→2000 — os dois códigos do
    motor entram como configurações irmãs (1 código por
    configuração, lookups por igualdade continuam a funcionar);
  - BMW / Série 1 (reutilizado o modelo admin `serie-1`) /
    geração F20 com configuração "116d" (N47D20C1, 1995cc,
    85kW, 2011→2015);
  - Ligações M2M criadas:
    `BM-2-44-MPACK-SD1G` (difusor BMW real) → 116d F20;
    `bicos` → Corsa B 1.5 TD Sport.
- Doubles: `src/server/variant-vehicle-compatibility.test.ts`
  ("Pick<PrismaClient, 'productVariant' |
  'productVariantVehicleCompatibility'>" + shape
  variante→configuração→geração→modelo→marca via fakes). Sem
  `__mocks__` no projeto: os doubles da casa são Typed `Pick`
  por serviço (§13); o novo modelo já está coberto.
- Gate: `tsc --noEmit` limpo; 1981 testes a passar
  (132 ficheiros: 131 + 1 skipped) + 3 skipped pré-existentes.

Lições desta etapa (para `knowledge.md`):
- `migrate dev` do Prisma 7 (com `prisma.config.ts`) NÃO corre
  `prisma generate` — o accessor novo ficou `undefined` no seed
  até `npx prisma generate` manual.
- Checksums em `_prisma_migrations` = SHA-256 dos bytes do
  `migration.sql` (verificado em 3 migrações de controlo).
  Migração aplicada com conteúdo diferente do ficheiro (fixes
  cutover `5aea435`/`9c1870d`/`36d7420`) ⇒ "modified after it was
  applied" e reset proposto. Resolvido SEM reset/perda de dados
  sincronizando o checksum do registo para o ficheiro atual
  (UPDATE bookkeeping; equivalente ao `migrate resolve --applied`,
  bloqueado por P3008).
- Regra de segurança: `migrate reset` é proibido em BDs com
  dados reais; investigar sempre com `git log` do
  `migration.sql` + hashes antes de qualquer resolução.

Próximos passos (pós-etapa):
- Commit do épico quando o utilizador pedir (ficheiros: schema,
  migração, seed, teste de doubles, package.json npm script).

---

# Checkpoint - 24/10/2026 — Epic 2: Vehicle Search (cont.)

Etapa 3 — Vehicle Search API & Services: **COMPLETA** (não
commitada; commit da base schema/seed feito em `253ca7c` e
pushed para `master`).

- Serviço: `src/server/vehicle-search.ts` (§13: cliente
  injetável via `Pick<PrismaClient, 'vehicleBrand' |
  'vehicleModel' | 'vehicleGeneration' |
  'vehicleConfiguration' |
  'productVariantVehicleCompatibility'>`, erros de domínio
  `ValidationError`/`NotFoundError`, validação antes das
  leituras). Funções:
  - `listVehicleMakes` — marcas ordenadas por nome;
  - `listVehicleModelOptions(makeSlug)` — modelos por
    slug da marca (slug global da marca via `@unique`;
    404 se não existir; marca sem modelos devolve `[]`);
  - `listVehicleGenerationOptions(modelSlug)` — gerações
    com configurações aninhadas vía `findFirst` por slug
    (`@@unique([brandId, slug])` não garante unicidade
    global — `findFirst` ordenado por marca é
    determinístico);
  - `findCompatibleVariantsForVehicleConfiguration(id)`
    — ligações M2M variant→config com `where` embutido
    (só variantes ativas de produtos ativos), ordering
    composto (nome do produto, posição da variante);
    404 se a configuração não existir; mapeia
    `link.variant` e usa `compatibleVariantSelect`
    (`satisfies Prisma.ProductVariantSelect`).
- Rotas públicas (todas dinâmicas no route map):
  - GET `/api/vehicles/makes`
  - GET `/api/vehicles/makes/[makeSlug]/models`
  - GET `/api/vehicles/models/[modelSlug]/generations`
  - GET `/api/vehicles/configurations/[configurationId]/variants`
  Cada rota com `handleError` local (Validation → 400
  genérico, NotFound → 404 com mensagem, inesperado → 500 +
  `console.error` com tag própria).
- Testes: `src/server/vehicle-search.test.ts` (12 testes:
  happy paths, 400/404/500 por consulta, where/order/select
  exatos, listas vazias de marca/modelo/config sem
  ligações) + 4 `route.test.ts` co-localizados (14 testes,
  mocks do serviço com classes de erro locais).
- Gate: `tsc --noEmit` limpo; `vitest run`: **2007 passed**
  (137 ficheiros: 136 + 1 skipped) + 3 skipped;
  `npm run lint` limpo; `npm run build` limpo com sitemap
  ISR intacto (○ 1h). Nota: `Prisma.Decimal` (não
  `Prisma.DecimalValue`) é o tipo de `powerKw`/`price` no
  client gerado do Prisma 7; route mocks usam cast único
  `as unknown as <tipo exportado>` para literais com
  Decimal.

Next steps (pós-etapa 3): commit da etapa 3 quando o
utilizador pedir; seguinte: integração no storefront
(seletor de veículo na ficha de produto/listagem usando as
novas rotas).


