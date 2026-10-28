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

---

# Checkpoint - 24/10/2026 — Epic 2: Vehicle Search (cont.)

Etapa 4 — Storefront Vehicle Selector and Compatibility
Filtering: **COMPLETA** (não commitada) —
**ÉPICO 2 COMPLETO** (etapas 1–4).

Estado:
- Serviço (`src/server/vehicle-search.ts`): 2 funções
  novas sobre a união das duas fontes de
  compatibilidade (M2M variante↔configuração +
  linhas de `ProductVehicleCompatibility` ao nível
  do produto):
  - `findCompatibleProductsForVehicleConfiguration(id)`
    — produtos deduplicados por `id`, ordenados por
    `slug` (locale `pt-PT`), só variantes ativas de
    produtos ativos; 404 se a configuração não
    existir;
  - `getProductVehicleCompatibility(productSlug, id)`
    — `{ configurationId, compatible }`;
    validações antes das leituras; NotFoundError
    para produto/configuração inexistentes.
  `VehicleSearchClient` Pick estendido com
  `'productVehicleCompatibility'` e `'product'`.
- Rotas públicas (co-laboradas com testes):
  - GET
    `/api/vehicles/configurations/[configurationId]/products`
    → `{ products: [{ id, slug }] }`
  - GET
    `/api/vehicles/products/[productSlug]/compatibility?configurationId=`
    → `{ configurationId, compatible }`
    (parâmetro em falta → 400)
  Mesmo padrão `handleError` local
  (400/404/500 + `console.error` com tag).
- Persistência do veículo selecionado:
  `src/components/storefront/vehicle-selection.ts`
  — 'use client' lib com localStorage (chave
  `pfa-veiculo`), evento DOM custom
  (`pfa-veiculo-mudou`) + evento `storage`
  (outros tabs): `readVehicleSelection`/
  `writeVehicleSelection`/
  `clearVehicleSelection`/
  `subscribeVehicleSelection`/
  `buildVehicleSelectionLabel` ("Opel Corsa B 1.5
  TD Sport") e hook `useVehicleSelection` cwd
  `useSyncExternalStore` (snapshot cacheado pela
  string crua de storage — identidade estável e
  invalidação automática; `getServerSnapshot` →
  null, seguro em SSR).
- Selector em cascata:
  `vehicle-selector.tsx` (Marca → Modelo →
  Configuração com `optgroup` por geração),
  consome os endpoints do passo 3; guarda
  `configurationId` + etiqueta + slugs da cadeia
  no storage aquando da escolha da configuração;
  chip "Veículo guardado: {etiqueta}" + botão
  Limpar; pré-seleção da cadeia guardada (marca →
  modelo → configuração); guards de sequência
  (`makeRequestRef`/`modelRequestRef`) contra
  respostas fora de ordem; erros com
  `role="alert"` + "Tentar novamente".
- Filtro/indicador da categoria:
  `vehicle-compatible-products.tsx` — wrapper
  client da grelha de produtos (reusa
  `ProductCard`, server-safe mas embedável em
  árvore client). Banner "A mostrar peças
  compatíveis para: {etiqueta}" + contagem
  ("1 peça compatível"/"N peças compatíveis
  nesta categoria") + botões "Mudar veículo"
  (abre o selector embebido) e "Limpar". Enquanto
  verifica: grelha escondida + "A verificar
  compatibilidade…" (sem flash de catálogo).
  Ready: filtra por ids compatíveis; 0 matches →
  painel vazio dedicado "Nenhuma peça compatível
  com {etiqueta}" + Limpar. Erro: fail-open —
  catálogo completo + nota de erro (a loja nunca
  fica vazia por causa da verificação). Sem
  veículo guardado: comportamento idêntico ao
  servidor (incl. estado vazio original com
  "Remover filtros" via `clearFiltersHref`).
- Badge na ficha de produto:
  `vehicle-compatibility-badge.tsx` após o
  parágrafo "Referência" — "Compatível com o teu
  veículo" (esmeralda) / "Não compatível"
  (vermelho); silencioso sem seleção, em 4xx
  (ex.: 404 produto/configuração removida) e em
  erro de rede.
- Páginas tocadas: `src/app/page.tsx` (nova
  secção `id="teu-veiculo"` antes de
  `#categorias`), `src/app/categorias/[slug]/page.tsx`
  (grelha substituída pelo wrapper; import
  `ProductCard` removido), `src/app/produtos/[slug]/page.tsx`
  (badge após "Referência").
- Decisão de arquitetura: persistência via
  localStorage + eventos (NÃO via URL) — a página
  de categoria já tem o seu próprio sistema
  server-side de filtro veicular por parâmetros de
  URL (`make`/`model`/`generation`); o filtro por
  configuração compõe por cima, no cliente, sem
  alterar o servidor.
- Testes: serviço +12 em
  `vehicle-search.test.ts` (24 no ficheiro: união/
  dedup/ordenado, filtros de ativos nas duas
  fontes, 404s, status verdadeiro/falso, rejeições
  de validação) + 2 ficheiros de teste de rota
  (10 testes) + 4 ficheiros de teste de
  componente (33 testes: lib 12, selector 6,
  wrapper 9, badge 6 — fetch roteado por URL com
  `vi.stubGlobal`, storage semeado antes do
  render).
- Gate: `npx tsc --noEmit` limpo; `vitest run`:
  **2062 passed** (142 ficheiros + 1 skipped) + 3
  skipped (linha base 2007 → +55 testes novos);
  `npm run lint` limpo; `npm run build` limpo —
  route map com as 2 rotas novas (ƒ) e sitemap
  ○ 1h intacto.

Lições desta etapa (para `knowledge.md`):
- O lint `react-hooks/set-state-in-effect` proíbe
  `setState` síncrono no corpo de efeitos. Padrão
  aplicável na casa para fetches derivados de um
  "estado de sessão": num único state
  `{ configurationId, ...resultado }` e derive o
  estado "a verificar" por comparação de ids —
  `setState` apenas dentro de callbacks async.
- `useSyncExternalStore` é o encaixe natural para
  estado de sessão com persistência (localStorage
  + eventos DOM): `getSnapshot` com cache da
  string crua dá identidade estável entre renders
  e invalidação automática perante mutações
  externas; exige `getServerSnapshot`.
- `ProductCard` é server-safe mas embedável em
  árvore client (importa `AddToCartButton`
  'use client'; nenhum módulo server-only) —
  reutilização direta dentro de wrappers client
  sem duplicar markup.
- Em ambiente jsdom `localStorage` funciona
  nativamente; para fetch, `vi.stubGlobal` +
  roteamento por URL (função com `String(input)`)
  seguido de `vi.unstubAllGlobals`.
- Corpos não-array vindos de mocks (ex.: abrir o
  selector com fetch mockado a um só payload)
  rebentam `list.map` — normalizar com
  `Array.isArray` nos setters de listas.

Próximos passos (pós-épico):
- Commit da etapa 4 quando o utilizador pedir
  (ficheiros novos: 2 rotas + 2 route tests, lib
  de seleção + test, 4 componentes + 3 test files
  —i.e. selector/wrapper/badge + seus testes;
  modificados: serviço + service tests, home,
  categoria, ficha, CHECKPOINT.md).
- Registar as lições em `knowledge.md` (§ nova).

---


# Checkpoint - 24/10/2026 — Epic 3: Stripe Checkout & Real Transactions

Etapa 1 — Order Schema & Stripe Service Foundation: **COMPLETA**
(commitada (`5090c5e`) e pushed; alterações em 16 ficheiros,
+4619/−407).

Estado:
- `prisma/schema.prisma`: campo aditivo `Order.paidAt DateTime?`
  (bloco de pagamento, com comentário) — data da confirmação
  efetiva do pagamento para tracking de fulfillment sem
  depender de OrderEvent. O ID da sessão Stripe não precisou de
  colunas novas: o par existente `paymentProvider` +
  `paymentReference` (`@@unique([paymentProvider,
  paymentReference])`) já suporta
  `paymentProvider='STRIPE'` + `paymentReference=cs_…`.
- Migração aplicada: `20261024162651_add_stripe_order_fields`
  (26 em `prisma/migrations`; alter-add column, sem dados
  tocados; `npx prisma generate` manual — Prisma 7 não gera no
  `migrate dev`).
- `recordVerifiedPayment` (order-lifecycle) agora grava
  `paidAt: now` no caminho PAID (captura única no início da
  função); a asserção exata do teste de sucesso foi atualizada
  (`paidAt: expect.any(Date)`). Repetições idempotentes do
  webhook continuam a não re-escrita (early return quando já
  PAID).
- Modelo de stock CLARIFICADO: `createCheckoutOrder` decresce o
  stock das variantes na CRIAÇÃO da encomenda
  (`updateMany` com guard `stockQuantity >= quantity` dentro
  de `runSerializableTransaction`) — reserva-on-order.
  Consequentemente o webhook do Stripe NÃO decresce stock de
  novo (evitaria dupla decresção); "decrement safely" =
  transição PAID idempotente via `recordVerifiedPayment`.
- SDK: `npm install stripe` (stripe@23.0.1 em dependencies).
  Efeito lateral corrigido: o install podou 46 pacotes
  extraneous (resend/@react-email/… usados pelos emails
  existentes) — reinstalados com `npm install --no-save` para
  restaurar o estado anterior (tsc/build voltaram a compilar
  os módulos de email).
- Serviço novo `src/server/stripe.ts` (§13): cliente
  estrutural mínimo `StripeClient`
  (`checkout.sessions.create` + `webhooks.constructEvent`) —
  SDK real inicializada preguiçosamente de `STRIPE_SECRET_KEY`
  com cache por chave; fakes nos testes injetados por
  parâmetro. Erros de domínio: `StripeConfigurationError`,
  `StripeValidationError` (field), `StripeSessionRequestError`
  (502), `StripeCheckoutConflictError` (409),
  `StripeCheckoutOrderNotFoundError` (404),
  `StripeWebhookAuthenticationError` (400). Função principal
  `initiateStripeCheckoutForOrder(orderId, userId, urls,
  deps)`: `loadStripeCheckoutProjection` (guard: encomenda
  pagável, PENDING, provider/reference null, SÓ a própria,
  soma artigos+portes === total) → `createStripeCheckoutSession`
  (line_items com unit_amount EM CÊNTIMOS, linha "Portes de
  envio" quando > 0, metadata orderId/orderNumber/
  paymentProvider, client_reference_id, customer_email,
  locale 'pt', currency 'eur') → persistência guard via
  `updateMany` (where status+PENDING+provider/reference null+
  userId). Helpers: `centsToDecimalString`,
  `decimalMoneyToCents` (string inteiros, sem floats),
  `buildStripeCheckoutSessionParams`,
  `verifyStripeWebhookEvent` (payload cru + header
  stripe-signature + STRIPE_WEBHOOK_SECRET),
  `mapConfirmedCheckoutSession` (payment_status === 'paid',
  senão null; amount_total/currency/metadata validados; 'eur'
  → 'EUR').
- Rota nova `POST /api/checkout/stripe`:
  `requireActiveUserId` → corpo idêntico ao /api/checkout →
  `createCheckoutOrder` (valida carrinho/stock/preços e cria
  encomenda com stock reservado) → sessão Stripe → 201
  `{ order, checkoutSession: { id, url } }`. URLs: sucesso
  `/checkout/sucesso?order={orderNumber}&session_id=
  {CHECKOUT_SESSION_ID}` (placeholder substituído pelo
  Stripe), cancelamento `/checkout?pagamento=cancelado`,
  base `NEXTAUTH_URL` com fallback localhost. Erros:
  401/400/409/404/500 dos códigos de checkout existentes +
  400 INVALID_REQUEST (StripeValidationError), 404
  ORDER_NOT_FOUND, 409 CHECKOUT_CONFLICT, 502
  STRIPE_UNAVAILABLE, 500 STRIPE_NOT_CONFIGURED.
- Rota nova `POST /api/webhooks/stripe` (`runtime = 'nodejs'`):
  corpo cru com limites de content-length/bytes (64KB,
  TextEncoder compatível com jsdom), verificação REAL da
  assinatura (constructEvent, sem mocking no teste), eventos
  ≠ checkout.session.completed e sessões unpaid → 200
  `{ received: true }` (reentrega indesejada evitada);
  sessão paga → `recordVerifiedPayment` (orderId dos
  metadados, provider STRIPE, referência cs_…, amount em
  string decimal, currency maiúscula) → 200 `{ received,
  orderId, paymentStatus }`. Mapeamento: assinatura 400,
  validação 400, NotFound 404, Conflict 409 (reentrega do
  Stripe resolve por idempotência), config 500, inesperado
  500.
- Refatoração compartilhada: novo
  `src/app/api/checkout/checkout-request.ts` com o parsing e
  mapeamento de erros ANTES duplicados entre rotas de checkout
  (`parseCheckoutRequestBody`, `mapCheckoutDomainError`,
  `handleCheckoutError`, `errorResponse`,
  `CHECKOUT_JSON_LIMIT_BYTES`); `src/app/api/checkout/route.ts`
  simplificado para importar deste módulo (comportamento e
  testes/asserções idênticos).
- Env: `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
  adicionadas ao `.env` (gitignored, vazias — preencher com
  chaves do dashboard antes de usar) + `.env.example` criado
  (o .gitignore já tinha `!.env.example`).
- Testes: `src/server/stripe.test.ts` (42 testes em fakes
  tipados: mapping de line_items/cesta/metadata/urls, erros de
  config/validação, sessão síncrona constructEvent throw nos
  fakes, projeção (portes, pickup, guards, soma total),
  iniciação/persistência/rollback sem guard por falha
  Stripe), `src/app/api/checkout/stripe/route.test.ts` (16
  testes: 401/400 x5/409/201 + assersões de chamada de
  iniciação + 502/409/404/500 STRIPE NOT CONFIGURED/
  INVALID_REQUEST/inesperado), `src/app/api/webhooks/stripe/
  route.test.ts` (14 testes com assinatura REAL via
  `new Stripe(sk_test).webhooks.generateTestHeaderString` —
  HMAC offline: happy path + idempotência (2 eventos),
  body manipulado após assinar → 400, segredo errado → 400,
  sem header → 400, outros eventos → 200 ack, unpaid → 200
  ack, sessão sem metadata/valor/moeda → 400, record → 404/
  409/400, 500 do erro de configurado, 413 com padding > 64KB).
- Gate: `npx tsc --noEmit` limpo; `npx vitest run`: **2134
  passed** (146 ficheiros: 142 pré-existentes + 3 novos, um
  deles skipped) + 3 skipped (baseline 2062 → +72);
  `npm run lint` limpo;
  `npm run build` limpo com `/api/checkout/stripe` e
  `/api/webhooks/stripe` novas no route map (ƒ).
- Nota final do gate: apenas um aviso de lint
  apareceu durante a etapa (alias `StripeApiErrorCode` sem
  uso); removido e a suite de gates ficou sem avisos.

Lições desta etapa (para `knowledge.md`):
- `npm install <novo-dependência>` PODE podar pacotes
  extraneous (instalados manualmente sem gravar): baselines
  de tsc que compilam módulos dessas dependências falham a
  seguir. Restaurar com `npm install --no-save <pkg…>`
  recria o estado anterior sem tocar package.json.
- Fakes de contrato síncrono (constructEvent lança) têm de
  usar `mockImplementation(() => { throw … })`.
  `mockRejectedValue` devolvia uma Promise (contrato async) e
  a falha nunca era lançada — o fluxo seguia com o valor
  Promise e errava noutra linha.
- unit_amount do Stripe é EM CÊNTIMOS inteiros: converter
  Decimal da BD para string → regex inteiros → cêntimos com
  aritmética inteira (nunca aritmética de float dividindo
  por 100).
- A sessão Stripe cobra a SOMA dos line_items: os portes têm
  de entrar como linha própria ("Portes de envio") para que a
  sessão === total da encomenda; a divergência é guardada no
  serviço (projeção) antes de abrir a sessão.

Próximos passos (pós-etapa):
- Commit da etapa 1 quando o utilizador pedir (novos:
  stripe.ts + test, /api/checkout/stripe + test,
  /api/webhooks/stripe + test, checkout-request.ts,
  migração, .env.example; modificados: schema, order-
  lifecycle(+test), checkout/route.ts, package.json,
  package-lock.json, CHECKPOINT.md).
- Etapa 2 do épico: frontend do checkout com Stripe
  (redireção para a sessão) e página /checkout/sucesso,
  consumindo `checkoutSession.url`, e finalização do fluxo.

---

# Checkpoint - 24/10/2026 — Epic 3: Stripe Checkout & Real Transactions (cont.)

Etapa 2 — Front-end Checkout Integration & Success/Cancel Flows:
**COMPLETA** (não commitada; commit da etapa 1 feito em `5090c5e`
e pushed para `master`).

Estado:
- Cliente de checkout (`checkout-client.tsx`) movido ao fluxo
  Stripe real. O botão "Criar encomenda" faz
  `POST /api/checkout/stripe` com o mesmo corpo de sempre
  (fulfillment + payment + `expectedFingerprint` do preview
  vigente). Em 201 o corpo
  `{ order, checkoutSession: { id, url } }` é validado por
  parser estrito (`isCheckoutOrder` + `isSafeCheckoutUrl`
  http/https — nunca esquemas do tipo `javascript:`) e o browser
  é navegado integralmente para `checkoutSession.url` via
  `redirectToExternalUrl` — novo módulo
  `src/lib/redirect.ts` isolado
  (`window.location.href = url`) para os testes poderem mockar
  a navegação sem tocar no `location` do jsdom
  (propriedade unforgeable).
- Feedback e estados: erro do servidor (stock esgotado,
  carrinho alterado, Stripe indisponível, rede) mostrado em
  `role="alert"` com o `error`/`code` da API; o botão fica
  "A redirecionar para o pagamento..." durante a navegação
  (sem `finally` no sucesso, para não reativar o botão antes de
  a página sair). 409 limpa o preview e volta a exigir
  "Calcular total" explícito, mantendo a fila anti-duplo-registo
  (`pendingAction`).
- Fluxo simulado REMOVIDO do cliente: estados
  `order`/`payment`/`paymentError`, `requestPaymentInitiation`,
  `handleRetryPayment`, `PendingAction 'payment'`, parser
  `PaymentInitiation` e o bloco de UI "Encomenda criada" /
  "Pagamento iniciado em modo de demonstração" foram eliminados.
  As APIs simuladas (POST /api/checkout, /api/payments/initiate,
  /api/payments/simulate) continuam disponíveis para dev,
  apenas já não são chamadas pelo checkout UI.
- URLs de retorno da rota Stripe (`POST /api/checkout/stripe`)
  apontam agora para as páginas novas do epic: cancelamento
  `/checkout/cancelado` (o `?pagamento=cancelado` foi retirado;
  teste da rota atualizado). Sucesso mantém
  `/checkout/sucesso?order={orderNumber}&session_id=
  {CHECKOUT_SESSION_ID}`.
- Página de sucesso `src/app/checkout/sucesso/page.tsx`
  (force-dynamic + metadata) com `sucesso-client.tsx`:
  valida os parâmetros do retorno (`order` no formato
  `^[A-Za-z0-9-]{1,64}$`, `session_id` a começar por `cs_`) —
  qualquer falha dá "Confirmação inválida" SEM tocar na API;
  carrega o detalhe em `GET /api/orders/{orderNumber}`
  (401 → "Sessão expirada" com `callbackUrl` da mesma
  confirmação; 404/500 → `role="alert"` com mensagem da API e
  links de escape); painel de confirmação (`role="status"`)
  com número da encomenda, estado do pagamento (PAID →
  "Pagamento confirmado"; PENDING → "A aguardar confirmação do
  Stripe" + nota de que o webhook pode demorar alguns segundos
  — a racing-condition do redirect é tratada sem polling),
  itens (qty × nome, SKU, opções de variante, subtotal de
  linha) e totais (subtotal/portes/IVA/total em EUR
  pt-PT). Ao aterrar com 200 válido chama
  `clearGuestCart()`.
- Página de cancelamento `src/app/checkout/cancelado/page.tsx`
  (estática ○ no build): painel amarelo "Pagamento cancelado"
  com links "Continuar a comprar" (/), "Voltar ao carrinho"
  (/carrinho) e "Ver as minhas encomendas" (/conta), e nota
  honesta de que a encomenda criada antes do redirect ficou
  PENDING na conta (reserve-on-order; o carrinho do servidor
  já tinha sido esvaziado na criação da encomenda).
- Serviço novo: `getUserOrder(userId, orderNumber, client?)`
  em `src/server/orders.ts` (§13 — `OrderClient.findFirst`
  adicionado à interface, `OrderField` estendido com
  'orderNumber', `normalizeOrderNumber` trim/≤64) — seleciona
  por `where: { userId, orderNumber }` com o `orderSelect`
  existente (itens + eventos), devolve null quando não é da
  própria conta. Rota `GET /api/orders/[id]`
  (`src/app/api/orders/[id]/route.ts`) com o padrão da casa
  (401/400/404/500 + `console.error` com tag própria) — 404
  encomendas de outras contas, sem revelar a sua existência.
- Carrinho local: `clearGuestCart()` nova em
  `src/lib/guest-cart.ts` — remove apenas a chave
  `pfautoparts:guest-cart` (sem reagir a tentativa de fusão
  pendente, que é mantida intacta).
- Stack de testes: `sucesso-client.test.tsx` (8: 3 de
  validação de parâmetros sem fetch; confirmação + limpeza do
  carrinho; PENDING; 401 com callbackUrl exato; 404 mantém
  carrinho local; shape inválido → erro genérico),
  `/api/orders/[id]/route.test.ts` (5: 401/200/404/400/500),
  `guest-cart.test.ts` (+3 clearGuestCart: limpa/ignora vazio/
  preserva merge receipt), `cancelado/page.test.tsx` (1), e
  reescritas no fluxo do checkout: `checkout-client.test.tsx`
  (mock `@/lib/redirect`; testes de entrega/levantamento →
  POST stripe + redirect asserted; conflito 409 → preview
  invalidado + recurso com fingerprint fresh; NOVO "permite
  nova tentativa depois de o Stripe devolver erro temporário"
  (502 → alert + re-POST ao stripe); NOVO "não navega quando o
  URL da sessão Stripe não é http(s)" (`javascript:` → erro e
  sem redirect); asserts "sem /api/checkout nem
  /api/payments/initiate"), `checkout-payment-client.test.tsx`
  (termos de prestações validados no POST stripe + redirect
  mockado) e `stripe/route.test.ts` (cancelUrl).
- Gate: `npx tsc --noEmit` limpo; `npx vitest run`: **2151
  passed** (149 ficheiros: 148 passed + 1 skipped) + 3 skipped
  (baseline 2134 → +17); `npm run lint` limpo; `npm run
  build` limpo — route map com `/checkout/sucesso` (ƒ),
  `/checkout/cancelado` (○ static), `/api/orders/[id]` (ƒ) e
  sitemap ○ 1h intacto.

Lições desta etapa (para `knowledge.md`):
- Next.js não permite dois nomes de segmento dinâmico
  diferentes ao mesmo nível: `/api/orders/[id]` já existia
  (cancel), por isso o detalhe por NÚMERO de encomenda ficou
  na mesma rota `[id]` — o nome do segmento é um placeholder;
  a semântica fica no serviço (`getUserOrder` por
  orderNumber).
- Navegação full-page para host externo (Stripe) deve viver
  num módulo próprio (`src/lib/redirect.ts`): o `location`
  do jsdom é unforgeable — mockar o módulo nos testes é
  neutro e firme, enquanto `window.location.href` direto é
  testável apenas por efeitos colaterais não observáveis.
- Não é preciso `useSearchParams`/Suspense nas páginas de
  retorno: a casa já lê `window.location.search`
  diretamente (padrão login/registar), e os testes controlam
  a query com `window.history.replaceState`.
- Com redirect no caminho de sucesso, o `finally` que
  reativa o botão é contraproducente (flash de UI antes da
  navegação): trata erro→`setPendingAction(null)` no catch e
  deixa o estado "pending" congelado no caminho feliz.

Próximos passos (pós-etapa):
- Commit da etapa 2 quando o utilizador pedir (novos:
  src/lib/redirect.ts, src/lib/guest-cart.ts clear,
  /api/orders/[id] + test, /checkout/sucesso page+client+test,
  /checkout/cancelado page+test; modificados:
  checkout-client.tsx e seus 2 test files, stripe route+test,
  server/orders.ts, src/lib/guest-cart.test.ts,
  CHECKPOINT.md).
- Preencher `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` no
  `.env` com chaves do dashboard e testar o fluxo real
  (cartão de teste 4242…, webhook local via tunnel) — as
  chaves continuam vazias, dev devolve 500
  STRIPE_NOT_CONFIGURED até lá.
- Possíveis continuações do épico: botão "pagar de novo"
  para encomendas PENDING (reutilizar
  `initiateStripeCheckoutForOrder`), middleware de
  verificação da sessão na página de sucesso, e registo das
  lições em `knowledge.md` (§ nova).

---

# Checkpoint - 25/10/2026 — Epic 3: Stripe Checkout & Real Transactions (cont.)

Etapa 3 — Order History & Retry Payment Flow:
**COMPLETA** (não commitada; commit da etapa 2 fica para
pedido do utilizador).

Estado:
- Página de histórico nova
  `src/app/conta/encomendas/page.tsx` ('use client' +
  `useSession` gate espelhando /conta: loading, coluna
  "Inicia sessão" com callbackUrl `%2Fconta%2Fencomendas`,
  shell autenticado com "← Voltar à conta") que renderiza o
  componente novo `OrdersHistoryClient`
  (`orders-history-client.tsx`). A secção de encomendas da
  `/conta` permanece intocada (OrdersClient).
- `OrdersHistoryClient`: carrega `GET /api/orders`
  (`cache: 'no-store'`) com shape guard própio e enxuto
  (id/orderNumber/total monetário/estado/paymentStatus/data
  válida/items array; resposta inválida → 'Resposta inválida
  do servidor'); lista ordenada por data (o serviço já
  devolve `createdAt desc`) com número, data (pt-PT
  `Europe/Lisbon`), count de artigos, badges de estado
  (OrderStatusBadge/PaymentStatusBadge) e total em EUR.
- Guard do botão em sincronia com o serviço: "Pagar agora"
  só em encomendas com estado PENDING/CONFIRMED/PROCESSING/
  READY_FOR_PICKUP **e** paymentStatus PENDING (paymentStatus
  FAILED não é retomável via Stripe nesta etapa: falhas
  assíncronas continuam a ter o caminho simulado em /conta, e
  a retoma após FAILED fica como possível continuação do
  épico). Encomendas iniciadas com PAYMENT_PROVIDER
  distinto (ex.: PFA_SIMULATED historicamente) passam o guard
  do cliente e recebem 409 do serviço com mensagem explícita.
- Ação de retoma: POST `/api/checkout/stripe/retry` com
  `{ orderId }`; resposta 201 validada por parser estrito
  (`checkoutSession.id` string + `url` http/https — nunca
  `javascript:`) e navegação integral via
  `redirectToExternalUrl` (mesmo módulo do checkout). Label
  "A redirecionar…" no botão com `redirectingOrderId`
  congelado no sucesso (sem `finally`); erros do servidor
  (409 conflito, 502 Stripe, rede) em `role="alert"` por
  encomenda com mensagem da API e fallback 'Não foi possível
  retomar o pagamento' quando não há corpo legível.
- Serviço novo: `retryStripeCheckoutForOrder(orderId,
  userId, urls, deps?)` em `src/server/stripe.ts` com
  `StripeRetryCheckoutUrls` (o URL de sucesso é função
  `buildSuccessUrl(orderNumber)` porque o número só é
  conhecido depois de carregar a projeção) e
  `StripeRetriedCheckoutSession { orderId, orderNumber,
  sessionId, sessionUrl }`. Projeção extraiu-se: loader
  partilhado `findStripeOrderProjection` (encomenda própria →
  StripeCheckoutOrderNotFoundError; estado pagável → 409;
  paymentStatus !== PENDING → 409) + helpers
  `buildStripeCheckoutLineItems` (artigos+portes em cêntimos,
  soma === total → integridade; CANCELLED já repôs stock e é
  recusado pelo estado) + `getStripeCheckoutProjection`;
  `loadStripeCheckoutProjection` mantém assinatura e
  mensagens (provider/reference null). A variante de retoma
  aceita paymentProvider null OU 'STRIPE' (sessão anterior
  expirada/abandonada é substituída) e recusa outros
  fornecedores; orderId chega "raw" do pedido e é normalizado
  (trim/≤64 → StripeValidationError 'orderId' → 400).
- Persistência da retoma: guard `updateMany`
  `{ id, userId, status, paymentStatus PENDING,
  paymentProvider in [null, 'STRIPE'] }` → data
  { paymentProvider STRIPE, paymentReference nova sessão };
  `StripeCheckoutDbClient.order.updateMany` alargado com
  `StripeOrderRetryUpdateManyArgs` (fakes inalterados); a
  troca de referência respeita `@@unique([paymentProvider,
  paymentReference])` porque cada sessão tem id fresco.
  count !== 1 → 409 'A encomenda foi alterada durante a
  retoma do pagamento' e a sessão externa fica sem efeito.
- Refactor partilhado: `checkout-config.ts` novo em
  `src/app/api/checkout/stripe/` — SUCCESS/CANCEL paths,
  placeholder `{CHECKOUT_SESSION_ID}`, base
  `NEXTAUTH_URL`/localhost:3000,
  `buildStripeCheckoutSuccessUrl(orderNumber)` +
  `buildStripeCheckoutCancelUrl()` e
  `handleStripeCheckoutError` (404/409/502/500
  STRIPE_NOT_CONFIGURED/400 INVALID_REQUEST). A rota de
  criação passou a importar daí (comportamento idêntico,
  teste da criação sem alterações).
- Rota nova: `src/app/api/checkout/stripe/retry/route.ts`
  (POST) — 401 `UNAUTHENTICATED`; corpo lido com
  `CHECKOUT_JSON_LIMIT_BYTES`; orderId passado crú ao
  serviço (corpo sem objeto → undefined → 400 pela
  normalização); 201 `{ orderNumber, checkoutSession:
  { id, url } }`.
- Stack de testes (+33): `stripe.test.ts` +10 (retoma com
  sessão anterior → nova sessão criada com metadata/params
  exatos e referência reposta com guard
  paymentProvider in [null, STRIPE]; primeira retoma sem
  referência + normalização de id; 404 de outra conta;
  CANCELLED; paymentStatus PAID; outro fornecedor —
  sem create/update; total divergente; persistência
  concorrente count 0; falha Stripe não persiste; orderId
  inválido 42/branco/comprido → findFirst/create não
  chamados), `retry/route.test.ts` 12 (401; JSON inválido;
  corpo array → 400 com mock a replicar a validação do
  serviço; orderId número; 404; 409 com mensagem; 201 +
  buildSuccessUrl('PFA-ABC123') → URL exato com placeholder;
  `NEXTAUTH_URL` com trim de barra; 502; 500
  STRIPE_NOT_CONFIGURED; 400 StripeValidationError; 500
  inesperado com console.error espiado),
  `orders-history-client.test.tsx` 8 (carregamento + guard
  'no-store'; botão só em pendentes; retoma com POST body +
  label "A redirecionar…" + redirect no URL; erro do
  servidor + botão reativado; URL não-http(s) → 'Resposta
  inválida do servidor'; 500 sem corpo → fallback; estado
  vazio; erro de carga → Tentar novamente), e
  `encomendas/page.test.tsx` 3 (loading, login com
  callbackUrl exato, autenticado com secção real mockada).
- Gate: `npx tsc --noEmit` limpo; `npx vitest run`: **2184
  passed** (152 ficheiros: 151 passed + 1 skipped) + 3
  skipped (baseline 2151 → +33); `npm run lint` limpo;
  `npm run build` limpo — route map com
  `/api/checkout/stripe/retry` (ƒ) e `/conta/encomendas`
  (○ static, client-only sob gate de sessão).

Lições desta etapa (para `knowledge.md`):
- Quando a rota delega a validação do corpo no serviço
  (precedente payments/simulate), o mock do serviço nos
  testes de rota tem de replicar essa validação — um mock
  "sempre resolve" deixa o mapeamento 400 sem cobertura.
- `getCheckoutBaseUrl` lê `NEXTAUTH_URL` em call-time; nos
  testes com `vi.stubEnv`, o URL buildable tem de ser
  avaliado ANTES de `unstubAllEnvs`, porque a função
  capturada é lazy.
- builders de URL em funções (vs strings fechadas)
  permitem a rota construir URLs dependentes de dados
  carregados depois — a rota mantém a responsabilidade de
  construir, o serviço de orquestrar.

Próximos passos (pós-etapa):
- Commit da etapa 3 quando o utilizador pedir (novos:
  src/app/api/checkout/stripe/checkout-config.ts,
  src/app/api/checkout/stripe/retry/route.ts + test,
  src/app/conta/encomendas/page.tsx + test,
  orders-history-client.tsx + test; modificados:
  src/server/stripe.ts + test, stripe route.ts, CHECKPOINT.md).
- Testar a retoma real com `STRIPE_SECRET_KEY` preenchido no
  `.env`: criar encomenda, abandonar o pagamento no Stripe e
  pagar pela página nova (incl. webhook local com
  `STRIPE_WEBHOOK_SECRET` do dashboard).
- Épico possível a seguir: retoma após paymentStatus FAILED
  (webhook de pagamento assíncrono falho → reaproveitar o
  fluxo com reset a PENDING + event PAYMENT_RETRIED), e
  registo das lições em `knowledge.md` (§ nova).


# Checkpoint - 25/10/2026 — Epic 4: Admin Backoffice & Management Dashboard

Etapa 1 — Admin Authentication, Layout & Core Shell:
**COMPLETA** (não commitada; commit fica para pedido do
utilizador).

Estado da exploração (o backoffice já existia — §18):
- Guard de autorização já estava implementado:
  `requireAdmin()` em `src/server/admin-auth.ts` (sessão →
  `prisma.user` role + isActive → `UnauthorizedError` 401 /
  `ForbiddenError` 403, com 9 testes em `admin-auth.test.ts`
  cobrindo sem sessão, id em branco, user removido, admin
  inativo, BUYER/SELLER → Forbidden, ADMIN ativo → ok).
  Layout e páginas admin repetem o check server-side:
  sem sessão → `redirect('/login')`; role ≠ ADMIN →
  `notFound()` (404, não revela existência do backoffice).
  Todas as rotas `/api/admin/**` chamam `requireAdmin()` e
  mapeiam os erros para 401/403 (padrão
  `handleError` em cada route.ts).
- **Decisão: NÃO adicionar `src/middleware.ts`** — um
  middleware edge não consegue validar role/isActive na
  base de dados por request; o padrão da casa (guard em
  server layout/components + `requireAdmin` nas APIs)
  cumpre o objetivo de bloquear não-admins com
  redirect/404/401/403.

Lacunas reais fechadas nesta etapa:
- Nav sem entrada explícita para o Dashboard: adicionado
  item **'Painel'** (`/admin`, `exact: true`) como primeira
  entrada do `AdminNavigation` (antes só o logo ligava à
  raiz).
- Breadcrumb global: componente cliente novo
  `src/app/admin/admin-breadcrumb.tsx` (`usePathname`) —
  "Admin › Produtos › Novo produto" p. ex. Map de segmentos
  estáveis (products, orders, catalog, categories,
  product-brands 'Marcas de produto', commercial-settings,
  vehicle-* com os títulos reais das páginas, new, import);
  ids de detalhe desconhecidos são ignorados (o título real
  vive na página); renderiza null no `/admin` e quando
  nenhum segmento é reconhecido. Ligado no `layout.tsx`
  acima do `{children}` (`space-y-5` não cria margem
  fantasma em children null).
- Métrica "produtos ativos" em falta no dashboard:
  `SalesOverview` ganhou `activeProducts: number` via
  `product.count({ where: { isActive: true } })` enxertado
  no `Promise.all` de `getSalesOverview` (7 queries em
  paralelo; `AnalyticsClient` estendido com o delegate
  `product`). Cartão novo **"Produtos ativos"** (hint
  "Visíveis na loja") como 5.º MetricCard no
  `SalesDashboard` (grid `md:grid-cols-2 xl:grid-cols-5`).
  As outras métricas do ponto 3 já existiam: encomendas
  totais, faturação (pagas não canceladas), pendentes a
  requerer atenção (hint "Pendentes: N" + InventoryAlerts
  de stock), valor médio, últimos 30 dias, tendência
  mensal.
- "Ver loja ↗" (href `/`, target _blank) e logout já
  existiam no header; responsividade da shell intacta
  (aside sticky 230px no lg, nav overflow-x no mobile).

Testes novos (+13 / 3 ficheiros):
- `admin-navigation.test.tsx` (4): renderiza as 6 áreas
  (incl. Painel) com hrefs; Painel ativo apenas no caminho
  exato (em subpáginas de secções exact não acende nada);
  ativação por prefixo nas subpáginas de Encomendas; Painel
  ativo na raiz.
- `admin-breadcrumb.test.tsx` (6): null na raiz; "Admin" +
  secção com `aria-current`; caminho completo
  (Produtos › Novo produto); ids desconhecidos
  skipados sem crumbs falsos; etiquetas de veículos e
  definições; null com nenhum segmento reconhecido.
- `layout.test.tsx` (3): sem sessão → `redirect('/login')`;
  role BUYER → `notFound()` (redirect não chamado); ADMIN →
  shell completa (nav com Painel/Produtos, breadcrumb
  "Caminho de navegação", Ver loja '/', botão Sair, conteúdo
  filho).
- Alterados: `analytics.test.ts` (fixture/asserção
  `activeProducts: 9` + `count` chamado 1× com
  `isActive: true`); `sales-dashboard.test.tsx` e
  `page.test.tsx` (stubs com `activeProducts: 12` +
  asserções do cartão "Produtos ativos").

Gate: `npx tsc --noEmit` limpo; `npx vitest run`: **2197
passed** (155 ficheiros: 154 passed + 1 skipped) + 3
skipped (baseline 2184/152 ficheiros → +13 testes, +3
ficheiros); `npm run lint` limpo; `npm run build` limpo —
route map intacto, todas as `/admin*` ƒ dynamic.

Lições desta etapa (para `knowledge.md` em § futura):
- Breadcrumb por `usePathname` + map de segmentos: mapear
  apenas segmentos estáveis e renderizar null quando nada
  é reconhecido — páginas de detalhe mantêm os seus
  títulos, nunca aparecem ids crus no caminho.
- O flag `exact` preexistente em "Produtos" muda as
  expetativas de `aria-current` por rota: nos testes de
  navegação não assumir prefix matching universal —
  `/admin/products/new` não acende a secção.
- `space-y-*` ignora children que renderizam null:
  componentes opcionais no layout (breadcrumb na raiz)
  podem renderizar null sem margens fantasma.

Próximos passos (pós-etapa):
- Commit da etapa 1 quando o utilizador pedir (novos:
  admin-breadcrumb.tsx + test, admin-navigation.test.tsx,
  layout.test.tsx; modificados: analytics.ts + test,
  sales-dashboard.tsx + test, admin-navigation.tsx,
  layout.tsx, page.test.tsx, CHECKPOINT.md).
- Etapa 2 do épico a definir com o utilizador (candidatos
  já no route map: gestão de encomendas API de transição,
  importação, definições comerciais) + atualização de
  `knowledge.md` com a § do épico.


# Checkpoint - 25/10/2026 — Epic 4: Admin Product Catalog & Variant Management (cont.)

Etapa 2 — Admin Product Catalog & Variant Management:
**COMPLETA** (não commitada; commit fica para pedido do
utilizador).

Estado da exploração (a gestão de catálogo já existia):
- Listagem `/admin/products` (guard redirect/notFound no
  page.tsx + `ProductsClient`): carrega
  `GET /api/admin/products/manage` (`requireAdmin()` →
  `listAdminProducts`) + categorias/fabricantes; pesquisa
  por nome/SKU/marca/categoria, filtros de categoria,
  fabricante e estado (Ativos/Inativos), métricas por
  linha (nº de variantes, stock total + variantes
  esgotadas), estado Ativo/Inativo, menu por linha
  (Editar, Preview, Duplicar, Ativar/Desativar, Eliminar
  com confirmação) e ações em massa (ativar/desativar/
  eliminar via `POST /api/admin/products/bulk`) com
  seleção que opera sobre o resultado filtrado.
- Editor/criador: `/admin/products/new` e
  `/admin/products/[id]` renderizam
  `ProductEditorClient` (`POST /api/admin/products` /
  `PATCH /api/admin/products/[id]`) com produto (nome,
  descrição, categoria, fabricante, estado, portes) e
  gestão completa no mesmo ecrã: variantes (SKU, preço,
  stock, especificações, imagens via
  `product-image-manager`) e compatibilidade veicular
  ligada/desligada (`ProductVehicleCompatibilityEditor` +
  `/api/admin/products/[id]/compatibilities`); duplicação
  (`[id]/duplicate`) e eliminar/arquivar
  (`[id]/manage` PATCH/DELETE preservando histórico de
  encomendas).
- Serviço `admin-products.ts`: schemas Zod por payload
  (produto/variantes/compatibilidades/imagens/bulk),
  transações atómicas no criar/atualizar/eliminar/bulk/
  duplicar (`$transaction`), erros tipados mapeados em
  401/403/400 (com `fieldErrors`)/409/500 e stacks de
  teste de serviço + rotas já extensivos.

Lacunas reais fechadas nesta etapa (só na listagem):
- **Preço por produto**: coluna nova "Preço" com
  intervalo min–max das variantes ("169,90 € –
  219,90 €") ou valor único quando só há um preço
  (`tabular-nums`); `AdminProduct.variants[].price` já
  vinha no payload — faltava exibi-lo.
- **Paginação**: cortes de 10 por página
  (`PRODUCTS_PAGE_SIZE`), `pageCount`/`currentPage` com
  clamp seguro no render (eliminações/ação em massa que
  encolhem a última página não deixam página fantasma),
  reset da página dentro dos handlers dos 4 filtros
  (pesquisa/categoria/fabricante/estado) — mount via
  effect foi rejeitado pelo lint
  (`react-hooks/set-state-in-effect`) — e controlos
  `nav[aria-label="Paginação dos produtos"]`
  (Anterior/Seguinte com disabled + "Página X de Y")
  apenas quando >1 página. "Selecionar todos os produtos
  visíveis" continua a cobrir o RESULTADO FILTRADO
  completo (inclui páginas além da atual, coerente com a
  toolbar em massa).

Testes (+1 teste, asserções novas):
- `products-client.test.tsx`: 10 testes (antes 9) —
  intervalo de preço nas duas linhas do fixture
  (multi-variante "169,90 € – 219,90 €" e valor único
  "289,90 €") + teste novo de paginação com 12 produtos
  (10 na pág. 1, Anterior disabled, Seguinte → "Página 2
  de 2" com Produto 11/12 e Seguinte disabled,
  contador "12 de 12 produtos", filtro de pesquisa
  recolhe para 1 página e esconde a nav).
- Autorização/validação/transações: cobertura
  pré-existente mantida (route.test.ts de products,
  `[id]`, manage, bulk, duplicate, compatibilities +
  `admin-products.test.ts`); nada duplicado nesta
  etapa — ver secção da Etapa 1 e §18 do knowledge.md.

Gate: `npx tsc --noEmit` limpo; `npx vitest run`: **2198
passed** (155 ficheiros: 154 passed + 1 skipped) + 3
skipped (baseline 2197 → +1 teste); `npm run lint` limpo;
`npm run build` limpo — route map intacto, produtos
admin ƒ.

Lições desta etapa (para `knowledge.md` em § futura):
- Paginação client-side sobre lista carregada em bloco:
  clamp de `currentPage` contra `pageCount` no render
  evita página fantasma quando as ações em massa
  encolhem a lista; reset de página deve viver nos
  handlers dos filtros, não num effect
  (`react-hooks/set-state-in-effect` é erro de lint).
- Métricas por linha "grátis": o payload admin já
  devolve variantes com price/stock — colunas de
  intervalo min–max derivam no cliente sem tocar na API
  (`Intl.NumberFormat('pt-PT', EUR)`).

Próximos passos (pós-etapa):
- Commit da etapa 2 quando o utilizador pedir
  (modificados: products-client.tsx,
  products-client.test.tsx, CHECKPOINT.md).
- Etapa 3 do épico a definir com o utilizador
  (candidatos: encomendas avançado, definições
  comerciais, importação) + § do épico no
  `knowledge.md` no fecho.

## Épico 4 — Etapa 3 (concluída): Gestão de encomendas e fulfillment

Data: 2026-10-25 · Branch: `master` · Sem commit (aguarda
pedido do utilizador).

Pedido do utilizador: vista admin de gestão de encomendas
com listagem por recência + filtros/pesquisa/paginação,
detalhe com desdobramento completo e ações de fulfillment
seguras, endpoints protegidos por `requireAdmin()` com
transações atómicas, testes e gate completo.

Exploração (o que já existia — não duplicar):
- Ordenação por recência ✓: `listAdminOrders`
  (`admin-orders.ts`) já faz `orderBy: { createdAt: 'desc' }`.
- Segurança ✓: `/api/admin/orders` (GET), `[id]/transition`
  (POST) e `[id]/ready-for-pickup` (POST) usam
  `requireAdmin()` com mapeamento de erros para 401/403;
  páginas `/admin/orders` e `/admin/orders/[id]` guardam
  sessão/ADMIN no servidor (redirect/notFound).
- Transações atómicas ✓: `applyAdminOrderAction`
  (`order-lifecycle.ts`, várias `$transaction`,
  valida transições de estado — 400 em transição inválida /
  409 em conflito), `cancelOrderAndRestoreStock`
  (`order-cancellation.ts`, repõe inventário), 
  `refundSimulatedPayment` (`payment-refund.ts`).
- Detalhe completo ✓ (`order-detail-client.tsx`): artigos
  com nome/SKU@compra/variantes@compra/preço/quantidade/
  classe de envio+tarifa/subtotal, entrega (morada,
  método), pagamento (método, estado, fornecedor
  Stripe vs `PFA_SIMULATED`, referência), totais,
  histórico de eventos e ações via POST transition.

Lacunas reais fechadas nesta etapa (só na listagem
`orders-client.tsx`):
- **Pesquisa**: campo `Pesquisar` (input search) sobre
  `orderNumber`, `shippingName`, `shippingEmail`,
  `shippingPhone`, case-insensitive via
  `toLocaleLowerCase('pt-PT')`, trimmed.
- **Filtros de estado**: selects "Estado da encomenda"
  (8 estados, labels de `orderStatusLabels`) e "Pagamento"
  (5 estados, `paymentStatusLabels`), ambos com opção
  "Todos"; opções derivadas de `Object.entries` no módulo
  (`orderStatusOptions`/`paymentStatusOptions`).
- **Paginação**: `ORDERS_PAGE_SIZE = 10`,
  `pageCount`/`currentPage` com clamp no render,
  reset de página dentro dos handlers dos 3 controlos,
  `nav[aria-label="Paginação das encomendas"]`
  ("Página X de Y", Anterior/Seguinte com disabled nas
  margens) apenas quando >1 página.
- **UI**: secção de controlos nova (contador
  "X de Y encomendas" + botão Atualizar movido para o
  cabeçalho da secção, props mantidas); `.map` sobre
  `pagedOrders` (memo `filteredOrders` deriva de
  pedidos+filtros — transições in-place via `setOrders`
  continuam visíveis); dois estados vazios: "Ainda não
  existem encomendas." vs "Nenhuma encomenda corresponde
  aos filtros" + botão "Limpar filtros" (realinha os 4
  estados). Estilo cinza próprio do cliente de encomendas
  (não reaproveitou a paleta do cliente de produtos).

Testes (+2, ficheiro com 13 no total):
- `orders-client.test.tsx`: teste novo "pesquisa
  encomendas por número e cliente e filtra por estado e
  pagamento" (3 encomendas mistas DRY: pesquisa por nome
  "bruno" e por número "PFA-DEF456", filtro SHIPPED,
  filtro de pagamento PENDING, estado vazio + clicar
  "Limpar filtros" repõe tudo) — usou `fireEvent.change`
  em `getByLabelText('Pesquisar')` / 'Estado da encomenda'
  / 'Pagamento' e contagem "N de M encomendas".
- Teste novo "pagina a lista de encomendas" (12 encomendas
  via overrides; 10 na pág. 1, Anterior disabled, Seguinte
  → "Página 2 de 2" com PFA-0011/0012 + Seguinte
  disabled, pesquisa "PFA-0011" recolhe para 1 página e
  esconde a nav via `queryByText(/Página \d de \d/)`).
- Autorização/validação/transações: cobertura
  pré-existente mantida (route.test.ts de orders +
  transition + ready-for-pickup, order-detail-client,
  lifecycle/cancellation/refund); nada duplicado — listagem
  e filtros são client-side sobre o payload admin.

Gate: `npx tsc --noEmit` limpo; `npx vitest run`: **2200
passed** (155 ficheiros: 154 passed + 1 skipped) + 3
skipped (baseline 2198 → +2 testes); `npm run lint`
limpo; `npm run build` limpo — route map intacto, admin
orders ƒ.

Lições desta etapa (para `knowledge.md` em § futura):
- Reset de página nos handlers dos filtros (não em
  effects) confirma-se com regras React Hooks v4
  (`react-hooks/set-state-in-effect`); com clamp de
  `currentPage` no render o reset fica mesmo assim
  observável via teste de contagem.
- `getByLabelText` com `<label>` envolvente funciona bem
  em blocos de controlo (pesquisa/estado/pagamento) sem
  colidir com texto de conteúdo (ex.: "Estado: Expedida").

Próximos passos (pós-etapa):
- Commit da etapa 3 quando o utilizador pedir
  (modificados: orders-client.tsx,
  orders-client.test.tsx, CHECKPOINT.md).
- Etapa 4 do épico a definir com o utilizador +
  § do épico no `knowledge.md` no fecho.

## Épico 4 — Etapa 4 (concluída): Gestão de clientes e contas

Data: 2026-10-25 · Branch: `master` · Sem commit
(aguarda pedido do utilizador).

Pedido do utilizador: vista admin `/admin/users` com
listagem de clientes/papéis/estado, pesquisa, filtros e
paginação; ficha individual com histórico/despesa e ações
seguras de papel/atividade; endpoints protegidos com
`requireAdmin()` + Zod + transação; testes + gate
completo.

Exploração (não existia nada — construção nova):
- `prisma/schema.prisma`: `User` (id, email, name?,
  `role` enum ADMIN/SELLER/BUYER default BUYER,
  `isActive`, tentativas de login, createdAt) e
  `Order.userId?` (nullable — hóspedes) — contagem e
  despesa vêm do utilizador, não de alterações de schema.
- `requireAdmin()` (`admin-auth.ts`) reutilizado como
  está (sessão + `isActive` + papel ADMIN).

Novidades (9 ficheiros + 2 editados):
- **Serviço** `src/server/admin-users.ts` (estilo
  `admin-orders.ts`): tipos + selects
  (`satisfies Prisma.UserSelect/OrderSelect`),
  `AdminUserClient` estreito (user findMany/
  findUnique + order aggregate) e `$transaction<T>`
  funcional no update (padrão
  `order-cancellation.ts`); erros
  tipados `AdminUserNotFoundError` (404),
  `AdminUserSelfUpdateError` (409),
  `AdminUserValidationError` (400). `listAdminUsers`
  (createdAt desc + `_count.orders`),
  `getAdminUserById` (ficha + últimas 10 encomendas +
  despesa paga via `order.aggregate(paymentStatus
  PAID)`), `updateAdminUser` (Zod
  `adminUserUpdateSchema` —
  role enum/isActive/refine "pelo menos um campo";
  guarda dentro da `$transaction`: ID desconhecido →
  404 antes do update; ninguém pode demover ou
  desativar a PRÓPRIA conta — evita lockout do último
  admin; update único e atómico).
- **API** `/api/admin/users` (GET; {users}) e
  `/api/admin/users/[id]` (GET {user} + PATCH {user};
  `readJsonBody` com limite de 8 KB como a rota
  transition; mapa 401/403/400 ZodFieldErrors
  (caminho.issue)/400 validação/JSON/413/404/409/500).
  PATCH passa `session.user.id` como
  `actingUserId` para a regra de autoproteção.
- **Páginas** `/admin/users/page.tsx` +
  `users-client.tsx`: tabela Todas as contas (nome
  com fallback "Sem nome"/email, papel,
  estado, nº de encomendas, data de registo, Ver
  ficha), pesquisa nome/email (`toLocaleLowerCase
  pt-PT`), selects Papel + Estado da conta
  (Ativas/Inativas), `USERS_PAGE_SIZE = 10` com
  clamp+reset nos handlers (padrão da casa),
  contador "X de M utilizadores", botão Atualizar
  no cabeçalho da secção, nav "Paginação dos
  utilizadores" e dois estados vazios + Limpar
  filtros.
- **Ficha** `/admin/users/[id]/page.tsx` +
  `user-detail-client.tsx`: perfil (papel/estado
  como badges, registado em), métricas Encomendas/
  Despesa paga (`formatMoney` "128.00 €")/Papel
  atual, gestão (select papel + "Guardar papel"
  desativado quando inalterado; toggle Ativar/
  Desativar com `window.confirm` — guard
  CLIENTE duplica a regra de autoproteção e a
  ficha avisa que é a conta do próprio admin),
  lista Encomendas recentes com links para
  `/admin/orders/[id]` (estados mostrados com os
  mesmos labels pt-PT do cliente de encomendas).
  Sucesso via role="status" e falhas via
  role="alert" (a partir de fieldErrors é
  escolhida a primeira mensagem por campo).
- **Nav** `admin-navigation.tsx`: área nova
  "Clientes" (não-exata, subpáginas acendem) +
  fixture do teste atualizada (+1 área).

Testes (+33; 6 ficheiros novos/editados):
- `admin-users.test.ts` (9): listagem/desc/count,
  ficha (aggregate PAID + take 10 + trim), null
  sum→"0.00", transação aplica papel+estado,
  ZodError (papel inválido, corpo vazio,
  isActive não-booleano), 404 antes do update,
  autoproteção (3 vias) + permitir ADMIN/ativo
  ao próprio, ID vazio.
- `route.test.ts` GET (200/401/403/500) e
  `[id]/route.test.ts` (11): ficha 200 (JSON
  serializa Date→ISO na asserção)/404/401;
  PATCH 200 com actingUserId 'admin-1', 400
  ZodError com fieldErrors (`new ZodError([
  { code: 'custom', path: ['role'], … }
  ])`), 404, 409, 400 JSON inválido, 403,
  400 ID vazio.
- `users-client.test.tsx` (4): carga+linha
  (asserção por `closest('tr')` — evita
  colisão option do select/thead), pesquisa
  nome+email e filtros papel/estado+estado
  vazio+Limpar filtros, paginação (12 → 2
  páginas), erro 403.
- `user-detail-client.test.tsx` (5): perfil/
  despesa (getAllByText — duas ocorrências),
  PATCH papel, autoproteção SEM fetch nem
  confirm, desativar/ativar com
  `vi.spyOn(window, 'confirm')` (jsdom "Not
  implemented: Window's confirm()" — sem mock
  devolve undefined e bloqueia antes do
  PATCH), erro 403 do servidor.
- Nova pasta completa `src/app/admin/users/**`
  e `src/app/api/admin/users/**`.

Gate: `npx tsc --noEmit` limpo; `npx vitest`:
  run **2233 passed** (160 ficheiros: 159 passed
  + 1 skipped) + 3 skipped (baseline 2200 →
  +33 testes); `npm run lint` limpo (após
  remover 'aggregate' não usado); `npm run
  build` limpo — route map com `/admin/users`,
  `/admin/users/[id]`, `/api/admin/users`,
  `/api/admin/users/[id]` ƒ.

Lições desta etapa (para `knowledge.md` em §
futura):
- Mocks de classes de erro com mensagem no
  corpo da resposta: quando `error.message`
  vai na resposta, o mock em `vi.mock` tem de
  receber a mensagem
  (`new AdminUserSelfUpdateError('…')`) ou
  a asserção compara com ''.
- jsdom: mockar `window.confirm`
  (`vi.spyOn(window, 'confirm')`) — sem mock
  regista "Not implemented" e devolve
  undefined, mudando o fluxo (nem chegou ao
  fetch).
- jsdom: fixtures que passam por `Response.json`
  no teste: `Date` sai como ISO — comparar com
  `.toISOString()` na asserção.
- Client-side `getByLabelText` vs textos repetidos
  (labels de opção no select + células da tabela):
  ou `getAllByText` ou âncoras por linha
  (`closest('tr')` + `toHaveTextContent`).
- Tipagem de `$transaction` funcional no mock:
  `callback(value)` direto (tipar o callback com
  o formato do fake client) — `as never` no
  retorno quebra `mockImplementationOnce`
  (Promise<never> ≠ never).

Próximos passos (pós-etapa):
- Commit da etapa 4 quando o utilizador pedir
  (ficheiros: admin-users.ts(+test),
  api/admin/users/**(+tests),
  admin/users/**(+tests), admin-navigation.tsx
  (+test), CHECKPOINT.md).
- Fechar o épico com o utilizador (discussão da
  Etapa 5 ou § do knowledge.md).

## Épico 5 — Etapa 1 (concluída): Emails transacionais — serviço, templates e triggers

Data: 2026-10-25 · Branch: `master` · Sem commit
(aguarda pedido do utilizador).

Pedido do utilizador: serviço Resend em
`src/server/email.ts` com erro seguro e fallback
de simulação; templates React Email
(confirmação com artigos, preços, morada e
número de encomenda); ligar o disparo ao
webhook Stripe (`checkout.session.completed`)
e aos eventos de ciclo de vida; testes; gate
completa; atualizar CHECKPOINT.md.

Descoberta (a base já existia, commitada desde
2f171fc/3dc04e5):
- `src/server/email.ts` (+ `email.test.ts`) e
  templates `src/emails/order-confirmation.tsx`,
  `order-status-update.tsx`, `brand.ts`
  (+testes) já completos e foram mantidos
  como estão: contrato "nunca lançam"
  (`EmailSendOutcome` sent/skipped/error),
  deteção de webhooks repetidos via evento
  `PAYMENT_CONFIRMED` + janela
  `paymentEventSinceMs` (tolerância +5 s) e
  modo de simulação sem `RESEND_API_KEY`
  (email registado no log, nunca enviado).
- Lacunas reais encontradas: dependências fora
  do `package.json` (`npm ls` marcava-as
  extraneous — um `npm ci` limpo quebraria o
  build), vars em falta no `.env.example` e
  **zero chamadores** — os emails nunca eram
  disparados.

Novidades:
- Dependências: `resend@^6.34.1` +
  `@react-email/components@^1.0.12` em
  dependencies; `@react-email/render@^2.1.1`
  em devDependencies (import direto apenas
  nos testes; produção usa só components).
- `.env.example`: `RESEND_API_KEY=""` e
  `EMAIL_FROM=""` com comentário pt-PT (sem
  chave → modo de simulação).
- Disparo ligado em 5 rotas (serviço agnóstico;
  captura `paymentEventSinceMs = Date.now()`
  ANTES da escrita, chamada `await` DEPOIS —
  o email é auxiliar: nunca muda a resposta
  do fulfillment):
  - `/api/webhooks/stripe`
    (`checkout.session.completed`) →
    `sendOrderConfirmationEmail({ orderId:
    order.id, paymentEventSinceMs })`; falha
    de `recordVerifiedPayment` impede o
    email; reentregas idempotentes do Stripe
    disparam de novo e a SUPRESSÃO vive no
    serviço (evento `PAYMENT_CONFIRMED`
    anterior à janela).
  - `/api/payments/webhook` → igual, só no
    `PAYMENT_PAID` (em `PAYMENT_FAILED` não
    há confirmação).
  - `/api/payments/simulate` → igual (demo
    segue o mesmo contrato dos webhooks).
  - `/api/admin/orders/[id]/transition` →
    `sendOrderStatusUpdateEmail({ orderId })`
    após CANCEL/REFUND_PAYMENT/ação.
  - `/api/admin/orders/[id]/ready-for-pickup`
    → igual após `markOrderReadyForPickup`.

Testes (7 ficheiros editados; sem casos novos —
asserções dentro dos testes existentes):
- `webhooks/stripe/route.test.ts`: mock
  `@/server/email`; confirmação chamada com
  `{ orderId: 'order-1', paymentEventSinceMs:
  expect.any(Number) }`, ×2 no teste
  idempotente (supressão é do serviço) e
  not-called em evento não tratado, sessão
  sem pagamento e conflito 409.
- `payments/webhook/route.test.ts`: mock;
  chamada no caminho PAID, not-called no
  FAILED.
- `payments/webhook/route.signed.test.ts`:
  mock; chamada no PAID assinado (round-trip
  real), not-called no FAILED.
- `payments/webhook/route.unique-violation.test.ts`:
  mock isolado — o serviço de email real
  voltaria a chamar `prisma.order.findUnique`
  (stub) e quebraria a contagem exata de
  2 chamadas.
- `payments/simulate/route.test.ts`: mock;
  chamada no sucesso, not-called nos 404 de
  produção.
- `admin/orders/[id]/transition/route.test.ts`:
  mock `sendOrderStatusUpdateEmail`; chamada
  nas 3 ações bem-sucedidas, not-called no
  401.
- `admin/orders/[id]/ready-for-pickup/route.test.ts`:
  chamada no sucesso, not-called no 409.

Gate: `npx tsc --noEmit` limpo; `npx vitest
run` **2233 passed** + 3 skipped (160
ficheiros: 159 passed + 1 skipped — mesmos
totais do baseline, +asserções); `npm run
lint` limpo; `npm run build` limpo
(rotas de email ƒ).

Lições desta etapa (para `knowledge.md` em §
futura):
- Transacional = auxiliar ao fulfillment: o
  disparo é `await`, mas o contrato do serviço
  é nunca lançar (`EmailSendOutcome`) — uma
  falha de envio não muda a resposta (200) nem
  o estado da encomenda.
- Deduplicação por janela temporal: a rota
  captura `paymentEventSinceMs` ANTES do
  registo e o serviço compara o `createdAt`
  do evento `PAYMENT_CONFIRMED` (+5 s);
  como `recordVerifiedPayment` é idempotente
  e devolve o mesmo estado numa reentrega,
  a rota dispara sempre o email e quem
  decide suprimir é o serviço.
- Dependências de código commitado: `resend`/
  `@react-email` estavam em node_modules como
  extraneous — instalar sempre com
  `npm install pkg@versão` para atualizar
  package.json + package-lock.json em
  conjunto.
- `@react-email/render` apenas em
  devDependencies (import só nos testes);
  produção importa `@react-email/components`.
- `vi.mock` tem de cobrir também I/O real
  acedido indiretamente pelo sut: no teste de
  violação de unicidade o email real
  reconsultaria o stub de prisma e
  desorganizaria as contagens
  `mockResolvedValueOnce`.

Próximos passos (pós-etapa):
- Commit desta etapa quando o utilizador
  pedir (ficheiros: package.json +
  package-lock.json, .env.example, 5 routes,
  7 route tests, CHECKPOINT.md).
- Continuar o Épico 5 com o utilizador
  (silenciar notificações de estado está
  também ligado; follow-up: notificações de
  falha de pagamento).

## Épico 5 — Etapa 2 (concluída): Pré-visualização e reenvio admin de emails

Data: 2026-10-25 · Branch: `master` · Sem commit
(aguarda pedido do utilizador).

Pedido do utilizador: route segura de
pré-visualização de emails da encomenda +
secção no ecrã admin; ação administrativa de
reenvio manual (confirmação/estado) com
idempotência e tratamento de erros do serviço
não-bloqueante; testes e gate completa.

Design:
- O REENVIO da confirmação já existia por
  omissão no serviço: `sendOrderConfirmationEmail`
  chamado SEM `paymentEventSinceMs` desativa a
  deteção de entregas repetidas
  (`isDuplicateConfirmation` → false) — a
  intenção do admin é forçar nova entrega. Os
  restantes guardas mantêm-se (só encomendas
  pagas, destinatário, configuração). O
  reenvio de estado mostra sempre o estado
  atual. Cada chamada é uma tentativa
  explícita e independente — sem estado na
  base de dados, repetir é seguro.
- A PRÉ-VISUALIZAÇÃO não envia nada: nova
  função `buildOrderEmailPreview` reutiliza os
  mesmos loaders/guardas (`emailOrderSelect`,
  PAID na confirmação, `buildConfirmationEmailProps`)
  e devolve `EmailPreviewOutcome`
  (ready: subject/recipient/html; skipped;
  error), nunca lança. Render via
  `@react-email/render` (agora runtime, ver
  dependências).

Novidades (8 ficheiros):
- `src/server/email.ts`: import de
  `@react-email/render`; +`OrderEmailType`,
  `EmailPreviewOutcome`,
  `buildOrderEmailPreview`
  (confirmação→paída, estado→qualquer; html
  com os dados guardados, independente de
  `RESEND_API_KEY`/`EMAIL_FROM`),
  `resendOrderConfirmationEmail`
  (reenvio forçado) e
  `resendOrderStatusUpdateEmail`.
- `GET /api/admin/orders/[id]/email-preview`:
  `requireAdmin()` (401/403), tipo por query
  `?type=CONFIRMATION|STATUS_UPDATE`;
  ready→200 {preview:{status,type,subject,
  recipient,html}}; skipped
  order-not-found→404, invalid-order-id/
  unsupported-type→400, order-not-paid→200
  com message; error→500 seguro (log
  server-side).
- `POST /api/admin/orders/[id]/email-resend`:
  `requireAdmin()` + `readJsonBody` 8 KB
  (413/400), body `{type}` (400 'Dados
  inválidos'); CONFIRMATION/STATUS_UPDATE →
  serviço → sent/skipped(200 + message pt-PT)
  /order-not-found(404)/error(500); mensagens
  estáticas de skip no estilo da casa
  ('Dados inválidos', 'Pedido demasiado
  grande').
- Cliente `order-detail-client.tsx`: secção
  "Emails transacionais" (dois cartões,
  conf./estado) com Pré-visualizar (GET →
  iframe `srcDoc` + assunto/destinatário +
  Fechar) e Reenviar (POST → role="status"
  com resultado); confirmação desativada com
  aviso quando o pagamento não está pago;
  erros em role="alert".
- package.json: `@react-email/render` movido
  de devDependencies para dependencies (o
  render agora corre no servidor em
  produção).

Testes (+40; 3 ficheiros novos/editados):
- `email.test.ts` (+11): preview pronto para
  confirmação (subject/recipient/base e HTML
  com nº da encomenda) e estado; skipped
  unsupported-type/invalid-order-id/
  order-not-found/order-not-paid; error de
  valores monetários e de exceção do cliente;
  reenvio de confirmação com evento
  PAYMENT_CONFIRMED antigo ENVIA (idempotência
  do reenvio manual), guarda não-pago
  mantido, reenvio de estado mostra estado
  atual.
- `email-preview` route.test.ts (10): 200
  ready (assunto/recipient/html), tipo da
  query, 404/400/200-not-paid, 500 seguro,
  401/403/500 de requireAdmin.
- `email-resend` route.test.ts (11): reenvio
  CONFIRMATION chamado com `{orderId}` só
  (sem paymentEventSinceMs — asserção de
  força), reenvio STATUS_UPDATE, 200 skipped
  (missing-api-key/order-not-paid com
  message), 404, 400 tipo inválido/JSON
  inválido, 413, 500 fornecedor, 401/403/500.
- `order-detail-client.test.tsx` (+8):
  secção + 2 cartões, desativação da
  confirmação não paga, preview no iframe
  (srcDoc + assunto + destinatário + Fechar),
  skip explicado (role="status"), reenvio
  com sucesso, message de skip no reenvio,
  erro de reenvio (role="alert").

Gate: `npx tsc --noEmit` limpo; `npx vitest
run` **2273 passed** + 3 skipped (162
ficheiros: 161 passed + 1 skipped — +40
testes); `npm run lint` limpo; `npm run
build` limpo — route map com
`/api/admin/orders/[id]/email-preview` ƒ e
`/api/admin/orders/[id]/email-resend` ƒ.

Lições desta etapa (para `knowledge.md` em §
futura):
- Reenvio manual = omissão de
  `paymentEventSinceMs`: a deteção de
  repetidos do webhook é opt-in pelo
  parâmetro, pelo que a mesma função serve
  webhook (com janela) e reenvio admin (sem
  janela) — nenhuma lógica nova para forçar
  a entrega.
- Pré-visualização ≠ envio: reutilizar os
  guardas do envio (PAID na confirmação) faz
  o preview ser fiel ao que o reenvio
  produziria; e o preview é independente de
  RESEND/EMAIL_FROM (mostra o template mesmo
  em modo de simulação).
- Quando o runtime passa a renderizar
  templates no servidor, a dependência do
  render sobe de devDependencies para
  dependencies — senão `npm ci --omit=dev`
  quebra em produção.
- `requireAdmin()` devolve `Session`
  (`session.user.id`): no mock de testes de
  rota, `mockResolvedValue({ user: { id,
  role } } as Awaited<ReturnType<typeof
  requireAdmin>>)` como a rota transition.
- Aviso TS2352 na conversão de session mocks:
  construir a forma parcial de `{ user: … }`
  em vez de `{ id, role }` solto (overlap
  suficiente para o cast).
- Sintaxe de describes/testes aninhados:
  terminar o último teste com `)` (sem
  vírgula) antes do fecho do bloco — vírgulas
  a mais dão "Expression expected".

Próximos passos (pós-etapa):
- Commit da etapa 2 quando o utilizador
  pedir (ficheiros: email.ts(+test),
  api/admin/orders/[id]/email-preview/**,
  api/admin/orders/[id]/email-resend/**,
  admin/orders/[id]/order-detail-client.tsx
  (+test), package.json + package-lock.json,
  CHECKPOINT.md).
- Continuar o Épico 5 com o utilizador.

## Épico 6 — Etapa 1 (concluída): Gestão avançada de inventário e alertas de stock baixo

Data: 2026-10-25 · Branch: `master` · Sem commit
(aguarda pedido do utilizador).

Pedido do utilizador: serviço de inventário
com consultas de stock baixo (limiar
configurável) e itens sem stock com validação
Zod; dashboard `/admin/inventory` com KPIs
(Total SKUs, Stock baixo, Sem stock),
listagem por variante com estado e filtros
rápidos; endpoints e ajustes protegidos com
`requireAdmin()` e transações atómicas; testes
e gate completa.

Descoberta (reutilização de código existente):
- Um sistema de inventário já existia (de
  uma "etapa 7" anterior): `src/server/
  inventory.ts` com `listLowStockVariants`
  (limiar padrão 5, validado 1..99 por
  normalizeLowStockThreshold, limit 20/100),
  `updateVariantStock` (stock absoluto +
  previousStock), `/api/admin/inventory`
  (GET lista de low stock + PATCH correção
  rápida, já com `requireAdmin()`) e o
  componente `inventory-alerts.tsx` montado
  no painel `/admin` (line 114).
- Gaps reais desta etapa: listagem COMPLETA
  com estados IN_STOCK/LOW_STOCK/OUT_OF_STOCK,
  KPIs de topo, página dedicada
  `/admin/inventory` (+ entrada "Inventário"
  na navegação), validação Zod e transação
  atómica no update de stock (antes era
  findUnique + update sem $transaction).
- O esquema NÃO tem coluna de limiar por
  variante (ProductVariant só tem
  stockQuantity Int @default(0) + isActive):
  o limiar "configurável" fica ao nível do
  pedido (default 5, 1..99), sem migração
  Prisma nesta etapa. Uma coluna por variante
  pode ser follow-up do épico.

Novidades (8 ficheiros):
- `src/server/inventory.ts`: import de Zod;
  `inventoryOverviewQuerySchema`
  (z.preprocess para ausente/vazio → default
  5; z.coerce.number().int().min(1).max(99),
  mensagens pt-PT no campo); tipos
  `InventoryStatus` (IN_STOCK/LOW_STOCK/
  OUT_OF_STOCK), `InventoryRow`, `InventoryKpis`,
  `InventoryOverview`, `MAX_INVENTORY_ROWS = 1000`;
  `getInventoryOverview` (3 contadores +
  listagem ordenada por criticalidade na
  MESMA transação de leitura — KPIs coerentes
  com a listagem; estados derivados por:
  0 → OUT_OF_STOCK, 1..limiar → LOW_STOCK,
  > limiar → IN_STOCK; inStockCount =
  total - low - out, clamp a 0);
  `InventoryTransactionClient` (count/findMany/
  findUnique/update) e `InventoryClient`
  ganha `$transaction<T>`; `updateVariantStock`
  refatorado para correr findUnique + update
  DENTRO de `$transaction` (correções
  concorrentes nunca intercalam leitura/
  escrita). Contratos antigos intactos
  (inventory-alerts continua funcional).
- `GET /api/admin/inventory/overview`:
  `requireAdmin()` (401/403), `?threshold=`
  validado pelo serviço (ZodError → 400
  'Dados inválidos' + fieldErrors, padrão
  da rota users/[id]), resposta plana
  `{ threshold, kpis, variants }` (200);
  500 seguro para erros inesperados. O PATCH
  de correção rápida continua em
  `/api/admin/inventory` (reutilizado pelo
  novo dashboard).
- `src/app/admin/inventory/page.tsx`:
  sessão (redirect '/login') +ADMIN
  (notFound), cabeçalho + LogoutButton +
  cliente (padrão orders/page.tsx).
- `inventory-client.tsx`: 3 cartões KPI
  (Total de SKUs / Stock baixo / Sem stock,
  com legenda do limiar configurado);
  filtros rápidos (pesquisa por SKU/produto
  + estado) filtrados no cliente com reset
  de página e 'Limpar filtros'; limiar
  editável (input numérico 1..99 commitado
  em blur/Enter — inválido reverte com
  role="alert" e NÃO recarrega); tabela
  Produto/SKU/Stock atual/Estado (badges:
  Disponível cinza, Stock baixo âmbar, Sem
  stock vermelho)/Correção rápida (input por
  linha + Guardar → PATCH `/api/admin/
  inventory` → notice 'Stock de X guardado
  (prev → next unidades).' + recarrega
  overview para os KPIs refletirem); paginação
  cliente 20/página com clamp/reset e
  contador 'X de M SKUs' (precedente
  users-client).
- `admin-navigation.tsx`: área 'Inventário'
  (/admin/inventory, ativação por prefixo)
  entre Produtos e Encomendas.

Testes (+26):
- `inventory.test.ts`: fixture ganha count +
  `$transaction` funcional (callback com o
  fake client de transação, padrão
  admin-users.test); +11 testes: schema Zod
  (default em ausente/vazio, inteiros como
  texto, rejeita frações/não numérico e
  limiares fora de [1,99]); overview KPIs
  com contadores exatos (3 counts com
  wheres por KPI, 3ª chamada stockQuantity 0),
  estados das linhas com limiar 5 e 10,
  teto take 1000 + orderBy criticalidade,
  ZodError antes de tocar na BD; update
  transacional ($transaction chamada 1× e
  findUnique/update no cliente de transação).
- `overview/route.test.ts` (7): 200 plano
  (threshold ausente → undefined), threshold
  da query como string cru para o serviço,
  400 com ZodError real do schema mocked
  (fieldErrors.threshold), 401, 403, 500
  seguro.
- `inventory-client.test.tsx` (7, jsdom +
  fetch stub + createJsonResponse): KPIs com
  valores via cartão (closest div), estados
  e legenda com limiar; filtros estado +
  pesquisa + vazios ('Limpar filtros'
  restore); paginação 25 SKUs (Página 1 de 2,
  Seguinte, SKU-021 vs SKU-001); correção
  rápida guarda PATCH {variantId, stock} e
  recarrega overview (2 GETs), role="status";
  erro do servidor em role="alert"; mudança
  de limiar recarrega com `?threshold=10`;
  limiar inválido reverte para 5 e não
  recarrega (só 1 call).
- `admin-navigation.test.tsx`: fixture +1
  área + teste de prefixo
  '/admin/inventory/repor'.

Gate: `npx tsc --noEmit` limpo; `npx vitest
run` **2299 passed** + 3 skipped (164
ficheiros: 163 passed + 1 skipped — +26
testes); `npm run lint` limpo; `npm run
build` limpo — route map com
`/admin/inventory` ƒ e
`/api/admin/inventory/overview` ƒ.

Lições desta etapa (para `knowledge.md` em §
futura):
- Funcão com validação "descritiva manual"
  + nova validação Zod pode coexistir: o
  legado mantém normalizeLowStockThreshold
  (com InventoryValidationError por campo) e
  a vista NOVA entra por schema Zod no
  serviço (rota mapeia ZodError → 400 com
  fieldErrors, padrão users/[id]) — não
  reescrever contratos commitados sem
  necessidade.
- `z.preprocess` resolve coerções com
  ausência/'' → undefined antes de
  z.coerce.number().int().min().max().default()
  — evita NaN de coerce sobre undefined.
- KPI + listagem numa única $transaction de
  leitura: contadores e linhas coincidem no
  mesmo snapshot; contagem 'disponível'
  derivada (total - low - out) em vez de um
  4.º count — menos uma query e zero
  inconsistência.
- Clientes tipados por forma (structural
  doubles): ao acrescentar `$transaction` ao
  InventoryClient, o fixture de teste passou
  a incluí-lo com callback funcional tipado
  contra `InventoryTransactionClient` —
  padrão admin-users.test (cast `as unknown
  as` no client composto).
- Client component NÃO pode importar valores
  (constantes) de módulos server-side
  (`@/server/inventory` puxa prisma): usar
  `import type` apenas e replicar constantes
  pequenas no cliente.
- lookup de labels no cliente: KPI/badges
  verificados nos testes por `closest('div')`
  com getAllByText[0] (o KPI vem antes da
  tabela na ordem do DOM) para evitar
  colisões de texto (badge vs título vs
  opção do select).

Próximos passos (pós-etapa):
- Commit da etapa 1 quando o utilizador
  pedir (ficheiros: inventory.ts(+test),
  api/admin/inventory/overview/**,
  admin/inventory/**, admin-navigation.tsx
  (+test), CHECKPOINT.md).
- Continuar o Épico 6 com o utilizador
  (follow-up possível: limiar por variante
  via migração Prisma, histórico de ajustes
  de stock).


## Épico 6 — Etapa 2 (concluída): Auditoria de movimentos de stock e histórico

Data: 2026-10-26 · Branch: `master` · Sem commit
(aguarda pedido do utilizador).

Pedido do utilizador: registo de auditoria de
cada alteração de stock (variante, quantidade
da mudança, stock anterior, stock novo, tipo,
referência do admin/utilizadores, timestamp)
com migração Prisma aplicada; gravação atómica
dentro das transações existentes em TODOS os
caminhos de escrita (compra/manual/reposição/
anulação); vista admin `/admin/inventory/
movements` com filtros (tipo, SKU, data);
testes e gate completa.

Esquema + migração:
- `prisma/schema.prisma`: modelo
  `StockMovement` — `variantId` FK
  ProductVariant cascade; `quantityChange`
  Int; `previousStock`/`newStock` Int;
  `type` enum `StockMovementType`
  (RESTOCK, SALE, MANUAL_ADJUSTMENT,
  RETURN); `actorUserId` FK User
  `SetNull` (nullable — movimento com
  ator eliminado mantém-se); `createdAt`
  default now(); índices
  `@@index([variantId, createdAt])` e
  `@@index([createdAt])`.
- Migração
  `20261026004130_add_stock_movement`
  criada e aplicada (`npx prisma migrate
  dev`). NOTA: nesta versão o `migrate dev`
  NÃO correu `generate` automaticamente —
  foi preciso `npx prisma generate`
  manual (causou erros TS até regenerar).

Serviço (`src/server/inventory.ts`):
- `recordStockMovement(transação, input)`:
  grava o movimento dentro da transação
  corrente (nunca transação própria).
- `updateVariantStock` ganha 3.º parâmetro
  `actorUserId?: string | null` e grava
  MANUAL_ADJUSTMENT dentro da MESMA
  transação findUnique+update (salta
  quando o stock não muda).
- `listStockMovements`: join variante→
  produto em altura de query (linhas com
  sku/nome/slug do produto); orderBy
  `[createdAt desc, id desc]` (desempate
  estável); limites de dia UTC inclusivos
  (T00:00:00.000Z / T23:59:59.999Z); SKU
  por contains Insensitive; páginação
  DEFAULT 50 / MAX 100 com clamp à
  última página real; `pageSize` ecoado
  na resposta. Tipos: `StockMovementType`,
  `StockMovementRecordInput`,
  `StockMovementRow`, `StockMovementsPage`
  (+ delegates estruturais com
  `stockMovement`).
- `stockMovementsQuerySchema` (Zod):
  campos opcionais pré-processados têm
  de TERMINAR em `.optional()`; datas
  validadas por regex
  `^\d{4}-\d{2}-\d{2}$` +
  `.refine(Date.parse finito)`.

Gravação por caminho (tudo atómico na
transação existente):
- `checkout.ts`: decremento → SALE
  (previous = `item.stockQuantity` lido no
  prepare Serializable; actor = utilizador
  que compra).
- `order-cancellation.ts`: incremento →
  RETURN (variantBefore lido por
  `productVariant.findUnique` na
  transação; actor = `ownerUserId ?? null`
  — cancelamentos por admin ficam
  'Sistema').
- `admin-products.ts` (`replaceVariants`):
  RESTOCK (aumento, ou variante nova com
  stock > 0 a partir de 0) e
  MANUAL_ADJUSTMENT (diminuição); salta
  quando igual; actor null. `stock.ts`
  intocado (código morto — só barrel).
- `GET /api/admin/inventory/movements`
  (nova): `requireAdmin()`, query
  `?type&sku&from&to&page&pageSize` via
  schema Zod (ZodError → 400 'Dados
  inválidos' + fieldErrors), 500 seguro.
- `PATCH /api/admin/inventory`:
  captura a sessão de `requireAdmin()` e
  passa `session.user.id` como actor do
  MANUAL_ADJUSTMENT.

Vista `/admin/inventory/movements`:
- `page.tsx` server (padrão
  orders/inventory) + `movements-client.tsx`
  client; tab strip server-side
  ('Inventário' / 'Movimentos') nas duas
  páginas com
  `aria-label="Secções de inventário"`.
- Cliente refetch server-side em cada
  mudança de filtro (ordem do
  querystring: type→sku→from→to→page→
  pageSize); SKU commitado em blur/Enter
  com trim; mudança de filtros volta à
  página 1.
- Labels pt-PT: Reposição/Venda/
  Correção manual/Cancelamento; badges
  verde/azul/âmbar/cinza; ator fallback
  'Sistema'; contadores 'N movimentos no
  histórico', 'Página X de Y',
  botões 'Página anterior'/'Página
  seguinte', 'Limpar filtros', estado
  vazio 'Sem movimentos para os filtros
  aplicados.', erros em role="alert".
- Mudança de stock apresentada como
  `previous → new` por linha
  (data-testid `stock-movement-row`).
- O MEMBRO do cliente importa apenas
  `import type` de `@/server/inventory`
  (puxa prisma — padrão da etapa 1).

Testes (+34 no total: 2299 → 2333):
- `inventory.test.ts` (40/40):
  recordStockMovement na transação correte;
  updateVariantStock grava MANUAL_ADJUSTMENT
  sem transação extra, salta quando igual e
  propaga actor; listStockMovements
  (filter/paginação/clamp/datas UTC); schema
  Zod (ausentes, datas inválidas, page/pageSize
  limites).
- `checkout.test.ts` (83/83): SALE gravado
  com amounts e actor certos (fixtures
  no stockMovement).
- `order-cancellation.test.ts` (18/18):
  RETURN com variantBefore lido na
  transação; actor owner/admin (null).
- `admin-products.test.ts` (24/24):
  RESTOCK/MANUAL_ADJUSTMENT por
  variante (fixtures ganham
  `productVariant.update` + `stockMovement`
  findMany tipado com `Record<string,
  unknown>`).
- `checkout-payment.test.ts`: fixture
  ganha delegate `stockMovement` (caminho
  de pagamento pendente grava SALE).
- `api/admin/inventory/route.test.ts`:
  PATCH agora asserte
  `(input, undefined, 'admin-test')`.
- `api/admin/inventory/movements/
  route.test.ts` (6): 200 default +
  passthrough de filtros, 400 com
  ZodError fieldErrors, 401/403/500.
- `movements-client.test.tsx` (7, jsdom +
  fetch stub): carga com paginação padrão,
  refetch por tipo, commit SKU no blur,
  paginação Anterior/Seguinte, estado vazio,
  erro em alert, Limpar filtros.

Gate: `npx tsc --noEmit` limpo; `npx vitest
run` **2333 passed** + 3 skipped (166
ficheiros: 165 passed + 1 skipped); `npm
run lint` limpo; `npm run build` limpo —
route map com `/admin/inventory/movements` ƒ
e `/api/admin/inventory/movements` ƒ.

Lições desta etapa (para `knowledge.md` em §
futura):
- `vi.clearAllMocks()` NÃO limpa filas de
  `mockImplementationOnce` — stubs
  órfãos vazam para o teste seguinte
  (consumidos pelo mount do próximo);
  usar `fetchMock.mockReset()` em
  beforeEach quando se enfileiram
  respostas por chamada.
- Stub das respostas tem de ser
  enfileirado ANTES do evento que
  dispara o fetch; caso contrário o
  refetch rebenta sem stub (fetch
  → undefined → erro 'reading ok') e o
  stub tardio fica órfão.
- `getByText` colide quando a MESMA
  string existe como `<option>` do
  filtro e badge na tabela — assertir
  com `within(row)` (ou data-testid).
- `vi.fn(async () => [])` infere
  `never[]` — anotar o retorno
  (ex.: `[] as Array<Record<string,
  unknown>>`) quando `mockResolvedValue
  Once` recebe objetos de fixture.
- `npx prisma migrate dev` nem sempre
  corre `generate` — após criar
  modelo novo, confirmar
  `.prisma/client` regenerado.

Próximos passos (pós-etapa):
- Commit da etapa 2 quando o utilizador
  pedir (ficheiros: prisma/schema.prisma +
  migração, inventory.ts(+test),
  checkout.ts(+test),
  checkout-payment.test.ts,
  order-cancellation.ts(+test),
  admin-products.ts(+test),
  api/admin/inventory/route.(ts|test.ts),
  api/admin/inventory/movements/**,
  admin/inventory/movements/** +
  admin/inventory/page.tsx (tabs),
  CHECKPOINT.md).
- Continuar o Épico 6 com o utilizador
  (follow-ups possíveis: exportação CSV
  do histórico, auditoria por utilizador
  no painel).


## Épico 6 — Etapa 3 (concluída): Limiares de stock baixo a nível de variante

Data: 2026-10-28 · Branch: `master` · Sem commit
(aguarda pedido do utilizador).

Pedido do utilizador: campo `lowStockThreshold`
(Int opcional/nullable) por variante + migração
Prisma; estado LOW_STOCK calculado com o limiar
PRÓPRIO quando definido, com fallback ao limiar
global da consulta; dashboard de inventário a
mostrar o limiar efetivo por linha (indicador
próprio vs global) com edição inline idêntica à
correção rápida de stock; updates protegidos
com `requireAdmin()` e validação Zod; testes e
gate completa.

Esquema + migração:
- `ProductVariant.lowStockThreshold Int?`
  (comentado no schema; null = usa o global).
  Migração
  `20261026104917_add_variant_low_stock_threshold`
  (ALTER TABLE ADD COLUMN) criada e aplicada;
  `npx prisma generate` corrido manualmente
  (o `migrate dev` nem sempre gerou — padrão
  da etapa 2).

Serviço (`src/server/inventory.ts`):
- `VariantRecord` / `LowStockVariantSelect` /
  `InventoryRow` ganham `lowStockThreshold`
  (required nullable — contrato completo por
  linha).
- `getInventoryOverview`: estado por variante =
  `inventoryStatusFromStock(stock,
  lowStockThreshold ?? threshold global)`.
  O KPI de stock baixo é DERIVADO das linhas
  (o `where` Prisma não compara campo↔campo da
  mesma tabela); contadores SQL passam de 3
  para 2 (total + sem stock — o count
  `gte:1..lte:threshold` foi removido);
  `inStock = max(0, total − low − out)`.
  Caveat documentado: listagem tem teto
  MAX_INVENTORY_ROWS (1000) — acima disso o
  KPI de stock baixo fica subavaliado.
- `updateVariantThreshold(input, client?)` +
  `VariantThresholdUpdate
  {previousThreshold, threshold, variant}`:
  leitura do anterior e escrita na MESMA
  transação (padrão updateVariantStock);
  variante inexistente → InventoryNotFoundError
  (404); NÃO grava movimento de stock (um
  limiar não é um movimento) e NÃO toca em
  `stockQuantity`.
- `variantThresholdUpdateSchema`:
  `variantId` string trim min 1 +
  `lowStockThreshold` como
  `z.nullable(z.coerce.number().int()
  .min(1).max(99))` — o `nullable`
  curto-circuita null ANTES da coerção
  (coerce(null) seria 0). Campo obrigatório:
  payload sem `lowStockThreshold` → 400.
- Tipos estruturais: `productVariant.update`
  `data` alargado para união
  `{stockQuantity} | {lowStockThreshold}` nos
  clientes transacional e top-level.
- `listLowStockVariants` (legado, usado pelo
  inventory-alerts) só ganha
  `lowStockThreshold: true` no select — shape
  de resposta e contratos intactos.

Rota + edição inline:
- `PATCH /api/admin/inventory/threshold`
  (nova): `requireAdmin()` sempre; ZodError →
  400 'Dados inválidos' + fieldErrors
  (normalização igual à rota movements);
  InventoryNotFoundError → 404; SyntaxError →
  400 'JSON inválido'; 500 seguro.
- `inventory-client.tsx`: nova coluna 'Limiar'
  com badge de origem — 'Próprio: N'
  (violeta) vs 'Global: N' (cinza) — e input
  + botão Guardar por linha (commit no
  clique, como a correção de stock); entrada
  vazia REMOVE o limiar próprio (PATCH null)
  e em linha sem limiar próprio é erro
  'Introduz o novo limiar...' sem chamada;
  valor igual ao atual não chama a API (papel
  do limiar global); validação cliente
  1..99 com a mesma mensagem; guardado
  desativa os fluxos de stock E limiar e
  recarrega a overview (2 GETs /overview);
  notices pt-PT 'Limiar próprio de X guardado
  (N unidades).' / '... removido — usa o
  global (N unidades).'; legenda do KPI
  'Stock baixo' → 'Limiar global de N
  unidades ou limiar próprio da variante.';
  tabela min-w 720 → 880.
- `src/app/admin/inventory/page.tsx`
  intocado: a página server já renderiza o
  cliente (a etapa 3 é toda no serviço +
  cliente).

Testes (+20: 2333 → 2353):
- `inventory.test.ts` (40 → 47): overview
  passa a 2 contadores (stubCounts total/out)
  e KPIs recalculados (low derivado); novo
  teste de limiares próprios (estados invertidos
  vs o global + KPIs + `lowStockThreshold`
  ecoado por linha); `updateVariantThreshold`
  (4): define numa transação (previous
  null → 3, sem movimento no histórico), null
  remove (previous 8 → null, stock intacto),
  404 sem update, payloads inválidos → ZodError
  antes da BD; schema (2): aceita 3 / null /
  '5', rejeita '' / 0 / 100 / 2.5 / 'muito' /
  campo em falta.
- `threshold/route.test.ts` (8, NOVO ficheiro):
  200 define (passthrough), 200 remove null,
  400 fieldErrors (ZodError real), 400 JSON
  inválido, 404, 401, 403, 500. Mock factory
  também fornece classes fake
  (InventoryNotFoundError) — a rota faz
  `instanceof` sobre o módulo mockado.
- `inventory-client.test.tsx` (7 → 12): badge
  Próprio/Global; guarda limiar (PATCH body +
  refetch 2 GETs); entrada vazia remove
  (PATCH null); guardar vazio em linha global
  → alert sem chamada; '0' → alert sem
  chamada; legendas do KPI atualizadas para
  o texto novo.
- `overview/route.test.ts`: fixture de rows
  ganha `lowStockThreshold: null`.

Gate: `npx tsc --noEmit` limpo; `npx vitest
run` **2353 passed** + 3 skipped (167
ficheiros: 166 passed + 1 skipped); `npm run
lint` limpo; `npm run build` limpo — route
map ganha `/api/admin/inventory/threshold` ƒ
(junto a inventory, movements e overview).

Lições desta etapa (para `knowledge.md` em §
futura):
- `z.coerce.number()` sobre null produz 0
  (Number(null) === 0) — para null com
  significado próprio ('remover limiar') usar
  `z.nullable(z.coerce.number()...)`: o
  nullable curto-circuita ANTES da coerção.
- `z.string().parse('')` NÃO lança em zod v4
  (string vazia é string válida) — nos testes
  de erro real usar `.min(1)` etc.
- where Prisma não compara dois campos da
  MESMA tabela — lógica 'campo vs campo'
  (limiar efetivo vs stock) tem de derivar em
  JS a partir de linhas já carregadas; conters
  SQL independentes de limiar (total, sem
  stock) podem ficar na transação.
- Ao alargar selects recursivos compartidos
  (LowStockVariantSelect), FIXTURES de
  VariantRecord nos testes precisam do campo
  novo — tsc aponta exatamente os ficheiros.
- vi.mock factory: as classes fake têm de
  estar DEFINIDAS DENTRO da factory (hoisting
  — factory não pode referir identificadores
  externos); a rota faz `instanceof` contra a
  classe mockada.

Próximos passos (pós-etapa):
- Commit da etapa 3 quando o utilizador
  pedir (ficheiros: prisma/schema.prisma +
  migração add_variant_low_stock_threshold,
  inventory.ts (+test),
  api/admin/inventory/threshold/**,
  inventory-client.tsx (+test),
  overview/route.test.ts, CHECKPOINT.md).
- Continuar o Épico 6 com o utilizador.




