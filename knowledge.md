# Knowledge — PFAutoParts (loja)

> Documento de contexto para agentes/desenvolvedores que continuarem este projeto.
> Última atualização: 2026-09-24, no branch `design/storefront-foundation` (commit `9c1870d` + testes de checkout alinhados com variantes).

## 1. O que é o projeto

E-commerce (storefront + backoffice) de peças e acessórios automóveis
(jantes, suspensão, body-kits, styling) para **Portugal Continental**, em português (pt-PT).
Nome do pacote: `loja` (v0.1.0). Marca: **PFAutoParts / PFAUTOPARTS**.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.3.3 (App Router), React 19.2.8 |
| Linguagem | TypeScript 5 (strict) |
| Estilos | Tailwind CSS v4 (`@tailwindcss/postcss`), tema escuro custom (cores `brand`, `brand-strong` em `globals.css`) |
| Base de dados | PostgreSQL + Prisma 7 com driver adapter `@prisma/adapter-pg` |
| Auth | NextAuth v4 (Credentials + JWT sessions), bcryptjs |
| Validação | Zod 4 (`src/lib/admin-validation.ts`, `src/lib/validation.ts`) |
| Testes | Vitest 4 + Testing Library (jsdom), 92 ficheiros de teste |
| Lint | ESLint 9 (`eslint-config-next`) |

## 3. Como executar

```bash
# 1. Configurar .env (ver .env.example)
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/pfautoparts"
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
PAYMENT_WEBHOOK_SECRET="..."   # mínimo 32 caracteres

# 2. Dependências
npm install

# 3. Prisma client + migrations
npx prisma generate
npx prisma migrate deploy      # ou: npx prisma migrate dev

# 4. Dados de desenvolvimento (4 categorias, 8 marcas, 10 produtos)
npm run dev:catalog:seed       # reverter: npm run dev:catalog:clear

# 5. Arrancar
npm run dev                    # http://localhost:3000
```

Scripts disponíveis: `dev`, `build`, `start`, `lint`, `test` (vitest run),
`typecheck` (`tsc --noEmit`), `dev:catalog:seed`, `dev:catalog:clear`.
Script extra em `scripts/simulate-payment-paid.mjs` (marca pagamento como pago).

**Nota:** `prisma.config.ts` usa `import "dotenv/config"` mas `dotenv` não está
nas dependências — funciona porque o Next/carregadores ambientais o fornecem
transitivamente; os scripts `.mjs` usam `node --env-file=.env`.

### Validação (estado em 2026-09-24 — ver §9)

```bash
npm run typecheck   # ✅
npm test            # ✅ 92 ficheiros, 1480 testes
npm run lint        # ✅
npm run build       # não verificado nesta análise
```

## 4. Arquitetura

### 4.1 Visão geral

Monorepo Next.js de página única em código, com separação clara em três camadas:

```
src/
├── app/                  # App Router: páginas + API routes
│   ├── (storefront)      # /, /produtos/[slug], /categorias/[slug], /carrinho,
│   │                     # /checkout, /conta, /login, /registar
│   ├── admin/            # backoffice (server pages + *-client.tsx)
│   └── api/              # 34 route handlers REST (ver §4.4)
├── components/storefront/# 8 componentes partilhados (product-card, price, …)
├── lib/                  # utilidades puras (guest-cart, slug, validação, …)
├── server/               # lógica de negócio (33 módulos + testes co-localizados)
└── types/                # augmentations NextAuth (session.user.role)
```

### 4.2 Padrões-chave (importantes para manter consistência)

1. **Injeção de cliente Prisma**: cada módulo de `src/server/*.ts` define uma
   interface mínima do Prisma (ex.: `CheckoutClient`, `CartClient`) e aceita
   `client?:` opcional como último parâmetro. Sem ele, faz cast de `prisma`
   (`getClient()`). Todos os testes usam doubles tipados — não mockam o Prisma
   globalmente. **Qualquer novo módulo deve seguir este padrão.**

2. **Concorrência**: operações críticas usam `updateMany` com condições no
   `where` (optimistic concurrency) e verificam `count !== 1`; checkout usa
   transação `Serializable` com retry em `P2034` (máx. 3 tentativas).

3. **Dinheiro**: todo o cálculo é feito em **centavos inteiros** (`cents`),
   convertido de/para string decimal via helpers (`priceToCents`, `centsToString`).
   Nunca usar floats para dinheiro. `Decimal` do Prisma é tratado como string.

4. **Erros de domínio**: classes próprias por módulo (ex. `CheckoutValidationError`,
   `PaymentInitiationConflictError`); as API routes mapeiam para status HTTP
   (400/401/403/404/409/413/500) num `handleError` por rota.

5. **Migração legado→variantes (EM CURSO)**: vários módulos têm caminhos duplos
   "legacy vs variant" guardados por `db.productVariant ? … : …` (cart, checkout,
   order-cancellation, products, stock). Ver §7.

### 4.3 Modelo de dados (prisma/schema.prisma)

- **Catálogo**: `Category` (hierárquica) → `Product` → `ProductVariant`
  (unidade vendável; `optionKey` default = `'default'`). `ProductOption` /
  `ProductOptionValue` / `ProductVariantOptionSelection` modelam opções de
  variantes; `ProductVariantSpecification` para specs por variante.
  `ProductBrand`, `ProductVehicleCompatibility` (marca→modelo→geração→configuração
  de veículo, com `yearMin/yearMax`).
- **Veículos**: `VehicleBrand → VehicleModel → VehicleGeneration → VehicleConfiguration`.
- **Comércio**: `CartItem` (por utilizador + variante, unique `userId+productVariantId`),
  `GuestCartMerge` (receipt idempotente do merge guest→conta), `Address`
  (com `defaultAddressId` no User).
- **Encomendas**: `Order` (com snapshots: `*AtPurchase`, `shippingClassApplied`,
  `taxRatePercent`, `freeShipping*`, `nonVolumous*`) → `OrderItem` (unique
  `orderId+productVariantId`) + `OrderEvent` (histórico: PAYMENT_CONFIRMED,
  PAYMENT_FAILED, PAYMENT_RETRIED, STATUS_CHANGED, PAYMENT_REFUNDED, CANCELLED).
- **Configuração comercial**: `StoreSettings` (`pricesIncludeTax`),
  `CheckoutRegionRule` (PORTUGAL_MAINLAND/MADEIRA/AZORES/INTERNATIONAL),
  `ShippingRule` (por região+classe, com `freeShippingThreshold`),
  `ProductShippingRate` (portes específicos por produto — usado para BULKY).

Enums: `UserRole (ADMIN/SELLER/BUYER)`, `OrderStatus (8 estados)`,
`PaymentStatus (PENDING/AUTHORIZED/PAID/FAILED/REFUNDED)`,
`PaymentMethod (CARD/INSTALLMENTS)`, `FulfillmentMethod (DELIVERY/PICKUP)`,
`ShippingClass (UNASSIGNED/SMALL/STANDARD/BULKY/HEAVY/QUOTE_REQUIRED)`.

Migrations: 15 (init 2026-08-31 → `20260921143000_move_cart_orders_to_variants`).

### 4.4 API (`src/app/api/**/route.ts`)

Públicas/autenticadas:
- `auth/[...nextauth]`, `auth/register`
- `cart` (GET/POST/PATCH/DELETE), `cart/guest` (POST resolve carrinho guest),
  `cart/merge` (POST merge guest→conta, idempotente via `GuestCartMerge`)
- `checkout/preview` (POST, devolve totais + `fingerprint` SHA-256),
  `checkout` (POST, exige `expectedFingerprint` — anti-TOC/TOU)
- `payments/initiate` (POST — inicia pagamento simulado),
  `payments/simulate` (POST — inicia **e confirma** pagamento, dev sandbox),
  `payments/webhook` (POST — HMAC-SHA256 `x-payment-signature` + timestamp ±5min, body ≤32KB)
- `orders` (GET lista do utilizador), `orders/[id]/cancel` (POST)
- `addresses` (GET/POST/PATCH/DELETE), `addresses/default`
- `health` (GET)

Admin (todas exigem `requireAdmin()` → role ADMIN + ativo):
- CRUD: `admin/products` (+`/[id]/compatibilities`), `admin/categories`,
  `admin/product-brands`, `admin/vehicle-brands|models|generations|configurations`,
  `admin/commercial-settings`
- Encomendas: `admin/orders`, `admin/orders/[id]/transition` (ação limitada:
  CONFIRM/START_PROCESSING/SHIP/DELIVER/READY_FOR_PICKUP/PICK_UP),
  `admin/orders/[id]/ready-for-pickup`

Não existe rota pública de pesquisa de produtos — a pesquisa da home é feita
em memória sobre `listCatalogProducts()`.

### 4.5 Frontend

- **Storefront** (tema escuro): home (`src/app/page.tsx`) com hero, categorias,
  marcas, produtos destacados, pesquisa `?q=` em memória; página de categoria
  (`/categorias/[slug]`) com filtros (marca, preço, compatibilidade de veículo,
  stock) e ordenação; página de produto com galeria, compatibilidades, relacionados.
- **Carrinho** (`/carrinho`): funciona para autenticados (API) e guest
  (localStorage `pfautoparts:guest-cart`, resolvido via `POST /api/cart/guest`).
- **Checkout** (`/checkout-client.tsx`, ~2200 linhas): moradas CRUD inline,
  DELIVERY/PICKUP, CARD/INSTALLMENTS (2–12), preview→confirm com fingerprint,
  inicia pagamento simulado automaticamente após criar encomenda.
- **Admin**: páginas server + client components (products, categories, brands,
  vehicles, orders com transições, commercial-settings).
- Componentes cliente fazem *parse defensivo* das respostas (validação manual
  com `isRecord`/guards em vez de Zod no cliente).

### 4.6 Auth e segurança

- NextAuth credentials (email+password), JWT; `session.user.id`/`role`.
- **Timing-safe login**: hash bcrypt fictício quando o utilizador não existe /
  está inativo / bloqueado (evita enumeração por tempo de resposta).
- **Login throttling**: `failedLoginAttempts`, janela e `loginBlockedUntil`
  (`src/server/login-security.ts`).
- `requireAdmin()` revalida role/isActive na BD a cada pedido admin.
- Webhook de pagamento: HMAC + timestamp, corpo limitado, `timingSafeEqual`.
- Headers de segurança globais em `next.config.ts` (nosniff, DENY, referrer,
  permissions-policy); `poweredByHeader: false`.
- Passwords: bcrypt cost 12; validação Zod (`passwordSchema`).

## 5. O que já está implementado (funcional)

- Catálogo navegável com filtros por categoria/árvore, marca, preço, stock e
  **compatibilidade veicular** (marca→modelo→geração→configuração).
- Carrinho autenticado + guest (localStorage) com **merge idempotente** no login
  (receipt `GuestCartMerge`, hash do payload, canonicalização para variantes).
- Checkout com preview→confirm (fingerprint), transação serializável,
  decremento atómico de stock por **variante**, snapshots de preços/portes/IVA.
- Portes: regras por região+classe, threshold de portes grátis, portes
  específicos para BULKY (validados contra min/max das regras comerciais),
  IVA incluído nos preços (taxa da região).
- Pagamentos: CARD e INSTALLMENTS (2–12), iniciação idempotente com referência
  única (`@@unique([paymentProvider, paymentReference])`), retry de falhados,
  webhook assinado, fluxo simulado para desenvolvimento, reembolso
  (`payment-refund.ts`).
- Ciclo de vida de encomenda: transições administrativas explícitas
  (CONFIRM→…→DELIVERED; READY_FOR_PICKUP→PICKED_UP) exigindo pagamento PAID;
  cancelamento pelo utilizador/admin com **restock atómico** dos itens na
  transação; histórico de eventos (OrderEvent).
- Backoffice completo para catálogo (produtos, categorias, marcas, veículos,
  compatibilidades) e definições comerciais; gestão de encomendas.
- Conta de utilizador (`/conta`) com encomendas e eventos; moradas com default.
- Registo de utilizadores (`/registar`, role BUYER).

## 6. O que parece incompleto / lacunas

1. **Migração Product→ProductVariant inacabada** (fase 2 em curso — ver §7).
2. ~~**Página de produto não expõe variantes**~~ — **resolvido em 2026-09-24**:
   `catalog.ts` expõe `variants` (sku/price/inStock/options/image) nos produtos;
   `/produtos/[slug]` renderiza um seletor de opções por eixo (`diameter`,
   `pcd`, `et`, `finish`, `front/rear drop`, `axle load`) via
   `product-purchase-panel.tsx`, que envia `productVariantId` para o carrinho;
   os cartões ligam à página quando há >1 variante ("Selecionar opções") em vez
   de adicionar às cegas. Falta: imagens por variante no seed e UI de admin.
3. **Sem gestão de variantes no admin**: `products.ts` apenas faz *upsert* da
   variante `default` espelhando o Product; não há CRUD de `ProductOption` /
   `ProductVariant` / `ProductVariantSpecification` (schema existe, UI/API não).
4. **Pesquisa**: só na home, client-side sobre a lista completa; sem pesquisa
   server-side/indexada, sem paginação no catálogo (listagens inteiras).
5. **Regiões além de Portugal Continental**: schema/modelos preparados
   (MADEIRA/AZORES/INTERNATIONAL) mas `checkout.ts` rejeita tudo o que não seja
   `PORTUGAL_MAINLAND`; `CheckoutRegionRule.checkoutEnabled` default false.
6. **Pagamentos**: apenas o fornecedor simulado `PFA_SIMULATED` (webhook genérico
   pronto, adaptador de fornecedor real inexistente). `scripts/simulate-payment-paid.mjs`
   é ferramenta dev.
7. **Roles**: `SELLER` existe no enum mas não tem permissões nem UI próprias
   (`requireAdmin` exige ADMIN; SELLER é rejeitado).
8. **Sem imagens reais/upload**: imagens são URLs (Unsplash no seed); não há
   gestão de ficheiros.
9. **README.md** é o boilerplate do create-next-app — não documenta nada do projeto.
10. Sem i18n framework (textos pt-PT hard-coded), sem e-mails/notificações,
    sem tracking de envio, sem faturação/recibos PDF.

## 7. Migração em curso: Product → ProductVariant (fase 2)

Contexto dos últimos commits (`49ded9a…9c1870d`): a unidade vendável passou a ser
`ProductVariant` (optionKey `'default'`), com cart/orders já em variantes.

**Estado atual:**
- `CartItem`, `OrderItem` já referenciam `productVariantId` (NOT NULL).
- Cart, guest-cart, cart-merge, checkout, order-cancellation e stock têm código
  duplo legacy/variant (guardado por existência de `productVariant` no cliente),
  incl. canonicalização de localStorage guest legado.
- `stock.ts`: `decrementStock` (Product) é "helper legado mantido durante a
  migração progressiva"; novos fluxos usam `decrementVariantStock`.
- `order-cancellation.ts` repõe stock **apenas na variante** (Product ficará
  dessincronizado — intencional e documentado no comentário do ficheiro).

**Passos prováveis seguintes (a confirmar com o responsável):**
- ~~Migrar `catalog.ts` / storefront para preços/stock de variante~~ — feito
  em 2026-09-24: catálogo e storefront já operam sobre variantes (preço de
  listagem = variante ativa mais barata, stock = alguma variante com stock,
  filtros de preço/stock também aplicados às variantes ativas; ordenação por
  preço continua a usar `Product.price`, que o seed mantém sincronizado com
  a variante mais barata).
- Remover helpers legacy (`decrementStock`, caminhos sem variante) e campos
  legados do schema (`Product.price`, `Product.stockQuantity`) numa fase 3.
- ~~Corrigir os testes/typecheck que a migração deixou inconsistentes~~ —
  resolvido em 2026-09-24 (ver §8/§9).
- Seed dev reescrito (`scripts/storefront-dev-data.mjs`): produtos são
  **modelos** (ex.: Japan Racing JR11) com variantes por eixos de opções
  (diâmetro/largura/PCD/ET/acabamento; rebaixo diant./tras. + carga de eixo
  nas molas), incluindo árvore de veículos + compatibilidades. Reset:
  `npm run dev:catalog:clear && npm run dev:catalog:seed`.

## 8. Bugs / TODOs visíveis

**Resolvidos em 2026-09-24 (CI volta a verde):**

1. ~~`src/server/checkout.test.ts` (linha ~1087) — erro TS2322~~: a fixture de
   `cartItem` inferia `variant.selections` como `never[]`. Corrigido anotando
   `createCartItem()` com tipos explícitos (`TestCheckoutVariant` /
   `TestCheckoutCartItem`).
2. ~~6 testes a falhar~~: alinhados com o código variante-native —
   `checkout.test.ts` passou a esperar `productVariantId`/`variant` no select de
   `tx.cartItem.findMany`; `checkout-payment.test.ts` passou a usar fixtures com
   variante e `productVariant.updateMany` (em vez de `product.updateMany`).
   Confirmou-se que eram apenas **testes desatualizados** face à migração de
   variantes — não foi preciso alterar código de produção.

**TODOs explícitos no código: nenhum** (grep por TODO/FIXME/XXX/HACK não
encontra nada relevante; único `eslint-disable` legítimo em
`product-gallery.tsx` para `@next/next/no-img-element`).

**Riscos/apontados por revisão (não-bloqueantes):**

- `checkout-client.tsx` deduz `installmentCount` de `order.installmentCount ??
  Number(installmentCount)` — se o campo do servidor for `null`, mostra o valor
  do formulário; cosmético.
- `products.ts` upsert da variante default ocorre **fora** de transação com o
  create/update do produto (janela de inconsistência em caso de falha).
- `cart.ts` mantém caminho legacy sem `productVariant` que usa IDs sintéticos
  `pv_default_${productId}` — remover quando a migração terminar.
- `layout.tsx`/home chamam `listCatalogProducts()` completo a cada request
  (`force-dynamic`) — sem cache/paginação; atenção com catálogos grandes.
- `GuestCartMerge` usa `payloadHash` mas o fluxo client envia itens crus —
  confirmar que o hash é comparado no server (cart-merge.ts) antes de confiar
  na idempotência.

## 9. Estado de validação (2026-09-24)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `npm test` | ✅ 96 ficheiros, 1520 testes OK |
| `npm run lint` | ✅ sem erros |
| `npm run build` | ✅ OK |

`CHECKPOINT.md` regista o último estado estável: commit `48a10a43`
("feat: add order event history"), tag `order-history-ok`, 1347 testes OK,
em `master`. O branch atual `design/storefront-foundation` está ~30 commits
à frente dessa âncora, no meio da fase 2 de variantes.

## 10. Catálogo, variantes e compatibilidade (tarefa de 2026-09-24)

**Página de produto** (`src/app/produtos/[slug]/`)

- `product-purchase-panel.tsx` é o único lugar que decide preço/referência/
  stock/add-to-cart. Deriva as opções de `product.variants` (SKU, preço,
  stock por variante) e nunca inventa combinações.
- Opções dependentes: um valor só fica selecionável quando existe uma
  variante real que o combina com a seleção dos **outros eixos escolhidos
  pelo utilizador** (`chosenCodes`). Os eixos reancorados automaticamente
  não restringem — sem isso o diâmetro ficava bloqueado (bug encontrado por
  teste ao tentar passar de 17" para 19").
- Se a combinação exata não existir, a escolha é preservada e os restantes
  eixos são reancorados na primeira variante real com esse valor (in stock
  primeiro). Enquanto isso, `selectedVariant` fica `undefined` e a UI mostra
  "Esta combinação não está disponível. Escolha outra configuração." com
  botão desativado e sem referência.
- `compatibility-anchor-link.tsx` abre o `<details id="compatibilidade">` e
  faz scroll: um `href="#id"` simples não abre acordeões fechados.
- `formatCompatibility` mostra marca/modelo/geração, carroçaria, motor
  (código + kW) e anos.

**Carrinho e erros controlados**

- `CartVariantSelectionRequiredError` (400, mensagem "Esta combinação não
  está disponível. Escolha outra configuração.") é lançado quando a variante
  pedida **não existe**. Variante que pertence a outro produto continua a dar
  `CartProductUnavailableError` (404) — são situações diferentes.
- `quantity` tem de ser inteiro positivo (guarda na rota, 400).
- O fallback 500 do `/api/cart` e do `/api/cart/guest` já não diz
  "Erro interno do servidor".

**Filtros por variante no catálogo** (`src/server/catalog.ts` + página de categoria)

- `CatalogCategoryFilters.variantSelections: { code, values }[]` — valores
  do **mesmo eixo** são OR (`value: { in: [...] }`) e eixos diferentes são
  AND, com `option.code` para não confundir eixos com valores iguais
  (ex.: rebaixo 30 mm dianteiro vs traseiro).
- `buildVariantFacets(products, selections)` lista os valores reais das
  variantes ativas e conta produtos por valor **só** quando existe variante
  que combina esse valor com a seleção dos outros eixos (contagens cruzadas).
- Com opções selecionadas são feitas 2 consultas: uma filtrada (grelha) e uma
  sem o filtro de variante (base das facetas). Sem opções, continua 1.
- URL: um parâmetro por eixo, repetido (`?v_diameter=19&v_pcd=5x120`), prefixo
  `v_`. Nomes de eixo/valores inválidos são removidos por `redirect` para a
  URL canónica; valores com `productCount === 0` ficam desativados na UI.
- `buildCategoryHref(slug, filters, overrides?)` recebe o estado atual + um
  override parcial, para nenhum filtro se perder ao gerar um link.

**Problemas que continuam em aberto**

- `Product.price`/`stockQuantity` têm de estar sincronizados com a variante
  mais barata: o preço ordenado na categoria e o filtro de preço usam o
  campo do produto além das variantes.
- A página de categoria faz 3 leituras do catálogo (com filtros, sem
  filtros, categorias) por request; sem cache.
- Os eixos de opção são livres no admin: nada impede criar um eixo novo, que
  aparece automaticamente no fim da lista de filtros.

## 11. Filtros por categoria (tarefa de 2026-09-24)

Cada categoria tem o seu conjunto de filtros; não se
reutiliza a mesma lista em todo o catálogo.

- `getCategoryFilterProfile` (`src/app/categorias/[slug]/
  category-filter-profile.ts`) classifica a categoria por
  nome/slug: `wheels`, `suspension`, `exterior` ou
  `generic`, e devolve os eixos de opção visíveis.
  - Jantes: diâmetro, largura, PCD, offset, furo central,
    acabamento. **Sem** filtro de veículo.
  - Suspensão: rebaixo dianteiro, traseiro e aplicação
    veicular. **A carga por eixo (`axle_load`) nunca é
    mostrada** — fica como metadado interno.
  - Exterior: só fabricante e veículo.
  - Genérica: todos os eixos, menos `axle_load`.
- Contagens: `getCatalogCategoryFacetsBySlug` /
  `buildCategoryFacets` em `src/server/catalog.ts`
  calculam stock, marca, veículo e eixos de variante a
  partir dos produtos reais. Cada dimensão é contada com
  as restantes aplicadas (exceto a si própria), por isso
  `Audi (3)` e `5x112 (12)` batem certo com o que o
  clique devolve. Opções com 0 ficam desativadas
  (`FilterGroup`).
- Veículo: `make`, `model` e `generation` (ids repetidos)
  são níveis alternativos da mesma seleção e chegam ao
  SQL como `compatibilities.some.OR`. `normalizeVehicleSelections`
  recusa hierarquias incoerentes (modelo de outra marca) e
  a página redireciona para a URL canónica.
- Ordenação: `newest` (omissão, sem param) + `price-asc` /
  `price-desc`. `Product.createdAt` foi adicionado em
  `20260924143000_add_product_created_at`.
- Não existe filtro de promoção: o schema não tem preço de
  comparação nem tabela de promoções (decisão do cliente
  para esta fase).
- `Product.price`/`stockQuantity` continuam a ter de
  bater certo com a variante mais barata: o filtro de
  preço e o de stock no SQL usam o produto **e** a
  variante, e o motor de facetas espelha exatamente essa
  semântica.

## 12. Compatibilidade: jantes por especificação, suspensão por veículo (2026-09-24)

Regra do cliente: **jantes não têm lista de veículos mantida à mão**.

- Jantes: a adequação vem das especificações da variante
  (furação/PCD, furo central, diâmetro, largura, offset),
  que já são eixos de opção (`ProductOption`) e definem
  preço, SKU e stock. A página de produto de uma jante
  **não mostra** a secção "Compatibilidade / Aplicações"
  nem o link "Ver aplicação", e mostra em vez disso uma
  nota de que a adequação vem das especificações.
- Suspensão: a compatibilidade por veículo (marca, modelo,
  geração, motor, anos) é mantida e usada nos filtros e na
  informação de aplicação.
- `getCategoryFilterProfile` passou para
  `src/lib/storefront-category-profile.ts` (usado pelas
  páginas de categoria e de produto e pelo servidor).
- `getCatalogCategoryFacetsBySlug` já não consulta a
  árvore de veículos em categorias de jantes.
- `addProductCompatibility` recusa produtos de jantes com
  `ValidationError` (400 no admin) — não é possível voltar
  a criar listas de veículos por jante.
- O seed DEV tem uma guarda que falha se um produto de
  jantes tiver compatibilidades; depois desta alteração
  são 5 compatibilidades (só suspensão).

Parafitting dinâmico no futuro (não implementado):
requisitos do veículo → comparação com as especificações
da variante → variantes que combinam.

## 13. Convenções para continuar o desenvolvimento

- **Linguagem**: código/identificadores em inglês; mensagens de erro, UI e
  comentários em **português (pt-PT)**. Commits em inglês, estilo
  `feat:/fix:/test:/refactor:/chore:`.
- **Testes co-localizados** (`foo.ts` → `foo.test.ts`), doubles tipados do
  cliente Prisma por interface mínima; jsdom global.
- Ao tocar em fluxos de dinheiro: trabalhar em centavos, testar arredondamento
  e `Number.isSafeInteger`.
- Ao tocar em stock/encomendas: manter padrão `updateMany` + verificação de
  `count` dentro de transação; nunca incrementar stock fora da transação do
  cancelamento.
- Módulos server novos: aceitar `client?:` opcional, exportar erros de domínio,
  mapear erros → HTTP na rota.
- Antes de dar algo por terminado: `npm run typecheck && npm test && npm run lint`
  (e `npm run build` para mudanças estruturais).
