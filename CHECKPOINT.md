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
(não commitada; `master` @ `ddfabbc` + trabalho novo sem commit).

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



