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




