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

## 7. Migração Product → ProductVariant (CONCLUÍDA — fase 3 em 2026-10-22)

Contexto dos últimos commits (`49ded9a…9c1870d`): a unidade vendável passou a ser
`ProductVariant` (optionKey `'default'`), com cart/orders já em variantes.

**Estado final (modelo definitivo, sem caminhos legados):**
- `CartItem`, `OrderItem` referenciam `productVariantId` (NOT NULL).
- **Fase 3 aplicada (2026-10-22)**: `Product.price` e `Product.stockQuantity`
  removidos do schema; migração
  `prisma/migrations/20261022090000_drop_product_legacy_price_stock` aplicada.
  Preço e stock têm fonte única: `ProductVariant`.
- Cart, guest-cart, cart-merge, checkout e stock são **variant-only** (sem
  branches duplos legados). Itens de carrinhos antigos sem `productVariantId`
  resolvem-se contra a variante 'default' do produto (canonicalização de
  localStorage guest mantida); `cartItem.userId_productVariantId` é a chave
  de unicidade.
- `stock.ts`: helper legado `decrementStock` (Product) removido; só
  `decrementVariantStock`.
- `order-cancellation.ts` repõe stock **exclusivamente nas variantes** e exige
  `productVariantId` em todos os itens (`OrderLifecycleConflictError` caso
  contrário); o stock do Level de produto já não é espelhado.
- `catalog.ts`: preço de listagem = variante ativa mais barata (fallback 0 se
  não houver), `inStock` = existe variante ativa com stock; filtros de
  preço/stock aplicados às variantes ativas; **a ordenação por preço deixou
  de ser SQL** (a coluna saiu) — a query ordena por nome e o JS aplica
  `sortCatalogProducts` com desempate por nome asc/desc.
- `products.ts` (CRUD básico do admin): payload `price`/`stockQuantity` do
  formulário básico escreve a variante 'default' (upsert + refetch do produto
  com a variante); `ProductResponse` deriva o preço/stock apresentados da
  variante 'default' (fallback 0/0).
- `admin-products.ts`: sem preço/stock de nível de produto; stock do UI deriva
  das variantes; duplicação de produto exige que o original tenha variantes.
- Seed dev (`scripts/storefront-dev-data.mjs`) sem campos de preço/stock de
  produto — todos os 11 produtos DEV têm variantes.

**Passos prováveis seguintes (a confirmar com o responsável):**
- ~~Migrar `catalog.ts` / storefront para preços/stock de variante~~ — feito
  em 2026-09-24: catálogo e storefront já operam sobre variantes (preço de
  listagem = variante ativa mais barata, stock = alguma variante com stock,
  filtros de preço/stock também aplicados às variantes ativas; ordenação por
  preço continua a usar `Product.price`, que o seed mantém sincronizado com
  a variante mais barata).
- ~~Remover helpers legacy (`decrementStock`, caminhos sem variante) e campos
  legados do schema (`Product.price`, `Product.stockQuantity`) numa fase 3.~~ —
  **feito em 2026-10-22, ver §15.**
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
- Em testes de cliente (RTL/Testing Library), o `Intl` de dinheiro/pt-PT usa
  espaço não-separável (U+00A0) e o `getByText` exato falha em texto
  repartido por vários nós: usar matcher por função com
  `element.textContent === '…'` em vez de `getByText('Total: 128,50 €')`.

## 14. Webhook de pagamento: validação de segurança (tarefa de 2026-10-22)

Estado da **etapa 1** (Gateway de Pagamento e Webhook) na árvore de trabalho.
Fonte de requisitos: `payment-provider-webhook-requirements.md` (§9 lista os
ficheiros envolvidos).

**Cobertura implementada:**

- **Autenticidade (mantida)**: HMAC-SHA256 sobre o corpo bruto
  (`timestamp + '.' + body`), cabeçalho `sha256=<hex>`, comparação em tempo
  constante, limite de corpo 32 KB (rejeição do `Content-Length` declarado
  antes de ler e do corpo real durante a leitura).
- **Anti-replay por timestamp (R9/M1)**: janela agora **configurável** por
  `PAYMENT_WEBHOOK_MAX_AGE_SECONDS` — omissão 300 s (±5 min), inteiro aceito
  entre 1 e 86400 (`PAYMENT_WEBHOOK_MAX_AGE_SECONDS_LIMIT`), **falha em
  fechado** (`PaymentWebhookConfigurationError` → 500) em valor inválido; a
  janela nunca é rebaixada em silêncio. A leitura acontece no verificador
  (`resolveConfiguredMaxAgeSeconds`), pelo que a rota continua a chamar sem
  opções.
- **Rotação de segredo (R11/L2/L3)**: `PAYMENT_WEBHOOK_SECRET_PREVIOUS`
  (opcional, ≥32 caracteres) aceite como segredo alternativo; o verificador
  tenta o segredo atual e depois o anterior, sempre com `timingSafeEqual`.
  Segredo anterior mal configurado → fail-closed. Rotação pode ser feita por
  ambiente, sem mudança de código.
- **Idempotência de reentregas (R20/R21)**: garantida pelas guardas de
  `order-lifecycle` — reentrega de `PAYMENT_PAID`/`PAYMENT_FAILED` com a mesma
  combinação fornecedor+referência devolve o estado atual (**200**) sem
  segunda escrita nem segundo `OrderEvent`; perdedor concorrente do
  *compare-and-set* recebe **409**. Testes em `order-lifecycle.test.ts`
  ("é idempotente quando…", "não grava segundo evento quando a mesma
  confirmação chega em paralelo") e `route.test.ts` (reentrega repetida → 200).
- **Observabilidade (L7)**: rejeições 401/400/404/409/413 registadas com
  `console.warn` e mensagens estáticas (sem eco de dados do emissor); 500
  continua em `console.error`.

**Testes novos (Vitest):** `payment-webhook.test.ts` — janela por ambiente
(omissão, 600 s com trim, limite 86400, valores inválidos → config error) e
rotação (anterior aceite, atual aceite, terceiro rejeitado, anterior curto
→ fail-closed, overrides por opções); `route.signed.test.ts` — round-trips
com verificação real: segredo anterior aceito, janela 600/120 por ambiente,
janela inválida → 500; `route.test.ts` — timestamp expirado → 401 + warn,
reentrega repetida → 200.

**Bloqueado deliberadamente (ver §7 do doc de requisitos):** deduplicação
durável por identificador de evento (tabela de dedupe, R27–R35) — depende de
contrato real com fornecedor (R1–R5/M5: sem `eventId` estável o lado da loja
não a pode implementar sem arriscar bloquear eventos legítimos). A limitação
de taxa no webhook (L4, resposta 429) também continua por implementar e
precisa de decisão de infraestrutura (limite em memória é per-instância).

## 15. Fase 3 da migração de variantes: remoção definitiva de `Product.price` / `Product.stockQuantity` (tarefa de 2026-10-22)

Estado da **etapa 2** do roadmap. Objetivo: terminar a migração da §7 — o
`ProductVariant` passa a ser a única fonte de preço/stock, eliminando os
campos e todos os consumidores legados.

**Schema e base de dados:**
- `prisma/schema.prisma`: `Product` perde `price` e `stockQuantity`.
- Migração manual `prisma/migrations/20261022090000_drop_product_legacy_price_stock/migration.sql`
  (`ALTER TABLE "Product" DROP COLUMN …`), criada à mão porque `migrate dev`
  fica bloqueado por prompt nesta sessão; aplicada com `npx prisma migrate
  deploy` e client regenerado (`npx prisma generate`).

**Consumidores atualizados (todos variant-only):**
- `cart.ts`, `guest-cart.ts`, `cart-merge.ts`, `stock.ts`,
  `order-cancellation.ts`: branches por existência de delegate removidos;
  helpers legados (`decrementStock`, fusão a nível de Produto) desaparecem;
  a fusão `cart-merge` valida disponibilidade/stock **na variante** (elementos
  antigos sem `productVariantId` resolvem-se na variante 'default') e escreve
  `cartItem` com `productVariantId`.
- `catalog.ts`: preço de listagem = variante ativa mais barata; `inStock` =
  alguma variante ativa com stock; filtros de preço/stock no nível da
  variante; `orderBy` SQL de preço substituído por `{name: 'asc'}` + re-sort
  em JS (`sortCatalogProducts`); valores por defeito (0/false) quando não há
  variantes ativas.
- `products.ts` (CRUD básico): payload do formulário (`price`,
  `stockQuantity`) escreve a variante 'default' via `productVariant.upsert`
  (a criação cria sempre; em alteração, só o preço/stock enviados alteram e
  o `isActive`/`sku` são sincronizados), seguido de re-leitura do Produto com
  `mainlandShippingInclude` (agora inclui a variante 'default'); resposta
  deriva da variante com *fallback* 0/0.
- `admin-products.ts`: sem preço/stock no `select`/resposta; duplicação
  recusa produto sem variantes.
- `catalog-import-service.ts`: já não escreve/espelha stock no Produto (o
  import mantém apenas o agregado das variantes).
- `scripts/storefront-dev-data.mjs`: sem campos de `price`/`stockQuantity` de
  produto; todos os 11 produtos DEV têm variantes.
- `admin-validation.ts`: mantém `price`/`stockQuantity` no esquema do
  formulário do produto básico (escrevem agora a variante 'default' — ver
  `products.ts`).

**Testes reescritos / adaptados (Vitest):** `cart.test.ts`,
`guest-cart.test.ts` (reescrito variant-only), `catalog.test.ts` (fixtures
sem cadeia de Produto; testes de ordenação por preço convertidos para
comportamento em JS com desempate de nome e `orderBy` `{name:'asc'}`,
facetas com `stockQuantity` propagado à variante), `products.test.ts`
(mock duplo com `productVariant.upsert`; sequência `findUnique` agora tem
3 chamadas na criação e refetch na alteração; *assertions* do `create`
sem cadeia de Produto), `cart-merge.test.ts` (tx com `productVariant`,
itens de `cartItem` pela variante), `order-cancellation.test.ts` (itens com
`productVariantId`, reposição via `productVariant.updateMany`, teste da
sincronização legado de stock do Produto no import removido),
`admin-products.test.ts` (sem preço/stock de Produto na resposta/cadeia).

**Validação (2026-10-22):** `tsc --noEmit` limpo; `vitest run` — 1836
testes a passar, 118 ficheiros (+3 ignorados/escolhidos); eslint limpo;
`next build` concluída (aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é
pré-existente e não quebra a build). Persistência confirmada em BD local
(`pfautoparts`, 23 migrações).

**Trabalho não commitado no ramo `design/storefront-foundation`** (a etapa 1
do webhook da §14 também está por commitar).

## 16. Emails transacionais Resend + React Email (tarefa de 2026-10-22)

Estado da **etapa 3** do roadmap. Nota: esta secção foi reconstruída depois
do acidente de rebase (o incidente está descrito no fim da §17); o código
das duas templates Está commitado no ramo.

- **Templates** em `src/emails/` com `@react-email/components`:
  `order-confirmation.tsx` e `order-status-update.tsx` (+ testes
  co-localizados que fixam os rótulos pt-PT — 'Expedida', 'Falhado',
  'Pronta para levantamento', etc.).
- Particularidades: `@react-email/components` v1.0.12 não tem `Cell` — usar
  `Column` dentro de `Row`; `@react-email/render` tem de ser dependência
  explícita (nunca foi içada do transitive tree).
- **Envio** a partir do backend (`src/server/email.ts`, Resend): email de
  confirmação quando o pagamento da encomenda é confirmado (webhook /
  simulação) e email de atualização de estado nas transições admin da
  encomenda (após ações na rota de transição).
- Os rótulos pt-PT de estado/pagamento ordenavam divergências entre a
  template e a área de cliente — resolvido na §17 com módulo partilhado.

## 17. Área de cliente / histórico de encomendas (tarefa de 2026-10-22)

Estado da **etapa 4** do roadmap.

**O que já existia** (commitado): página `/conta` com login/registo inline,
secção de encomendas `src/app/conta/orders-client.tsx` (lista + detalhe:
artigos com opções de variante, quantidades, preços, histórico de eventos,
Totais e endereço/levantamento), serviço `listUserOrders(userId)` em
`src/server/orders.ts` com filtro `where: { userId }`, API GET `/api/orders`
(`requireActiveUserId` → 401/400/500) e cancelamento por `/api/orders/[id]/
cancel` com verificação de posse. O checkout exige sessão autenticada
(`userId: user.id`) — não existem encomendas de convidado.

**Acrescentado nesta etapa:**
- `src/lib/order-status-labels.ts` — fonte única pt-PT dos rótulos de
  `OrderStatus`/`PaymentStatus`, usada AGORA pelos templates de email
  (§16) e pela área de cliente. Unifica divergências antigas do cliente:
  SHIPPED 'Enviada' → 'Expedida', FAILED 'Falhou' → 'Falhado'. Estados
  desconhecidos devolvem o valor original da BD (sem inventar etiqueta).
- `src/components/storefront/order-status-badge.tsx` — `OrderStatusBadge`
  e `PaymentStatusBadge` (chips com `data-variant` success/info/warning/
  danger/neutral; mapeamento semântico, desconhecido → neutral).
- `orders-client.tsx`: badges de estado/pagamento no cabeçalho de cada
  cartão + `Total: X €` no cartão (o desdobramento subtotal/portes/
  imposto mantém-se no bloco Totais); switches locais de etiquetas
  removidos em favor do módulo partilhado.
- Badges no menu admin ficam para uma tarefa futura.

**Decisões de segurança:** histórico é estritamente por sessão
(`requireActiveUserId` → consultar apenas por `userId`); consulta por
endereço de email foi excluída por fugir PII (e é desnecessária: sem
encomendas de convidado). Testes de segurarçe de query e 401 já cobertos
em `orders.test.ts` / `api/orders/route.test.ts`.

**Testes novos:** `src/lib/order-status-labels.test.ts`,
`src/components/storefront/order-status-badge.test.tsx` e três testes no
`orders-client.test.tsx` (badges, total no cartão, estados desconhecidos
em badges neutras); as strings do histórico '… → Falhou' passaram a
'… → Falhado'. Convenção RTL para dinheiro com U+00A0: ver §13.

**Validação (2026-10-22):** `tsc --noEmit` limpo; `vitest run` — 1876
testes, 124 ficheiros (+3 skipped); ESLint limpo; `next build` concluída
(aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é pré-existente).

**Incidente de rebase e resolução:** um `git pull --rebase` do utilizador
rebaseou os últimos 6 commits locais sobre a origin e dois commits com
conflitos ("Move storefront…" e "refactor(catalog)…") foram continuados
com os marcadores `<<<<<<<…` commitados — a branch ficava "up to date"
com 7 ficheiros não compiláveis (`catalog.ts`, `catalog.test.ts`,
`products.ts`, `products.test.ts`, `checkout-payment.test.ts`,
`admin/products/products-client.tsx(+test)`). Como o lado local em
`cc3eb93` era a versão validada da mesma migração (paralela à origin),
a resolução foi restaurar os 7 ficheiros de `cc3eb93` por cima
(`git restore --source=cc3eb93 --worktree -- <ficheiros>`). Após o
restauro, o gate completo passou (números acima). A resolução foi depois
commitada como `7869db9` ("fix(rebase): resolve lingering rebase conflict
markers across catalog and products"); a etapa 4 é o commit `9b30328`.

## 18. Painel admin: resumo de vendas e analytics (tarefa de 2026-10-22)

Estado da **etapa 5** do roadmap.

**Serviço** — `src/server/analytics.ts`: `getSalesOverview({ client?,
now? })` (padrão da §13: cliente Prisma injetável `AnalyticsClient`
com doubles tipados, sem estado global fixado no teste). Seis consultas
em `Promise.all`: agregação de faturação (todas as encomendas pagas),
`groupBy` por `status`, `groupBy` por `paymentStatus`, `groupBy` de
`OrderItem` (produtos mais vendidos), `findMany` da janela de tendência
e `findMany` das últimas 8 encomendas.

Definições (fixadas para uma mesma leitura entre páginas/testes):
- **Faturação total** = soma de `total` de encomendas com
  `paymentStatus = 'PAID'` e `status != 'CANCELLED'` (dinheiro
  reembolsado/cancelado não conta como faturação).
- **AOV** = faturação ÷ número de encomendas pagas; `'0.00'` sem
  pagamentos.
- **Pendentes** = contagem com `status = 'PENDING'` (derivada da
  lista de distribuição — sem consulta extra).
- **Mais vendidos** = top 5 por quantidade (`_sum.quantity desc` no
  SQL) com receita (`_sum.subtotalAtPurchase`), agrupado por
  `productVariantId` + nome/SKU no momento da compra (snapshot, sem
  joins para `Product`/`Variant` atuais).
- **Últimos 30 dias** e **tendência mensal** derivam de um único
  `findMany` (encomendas pagas não canceladas desde o 1.º dia UTC do
  5.º mês anterior); agregação de meses feita em JS com chaves
  `YYYY-MM` em UTC, meses sem vendas mantidos a zero.
- Dinheiro sai como strings decimais (`MoneyValue`/`decimalToString`,
  mesmo padrão de `orders.ts`); referência temporal injetável (`now`)
  para testes determinísticos.

**Página** — `src/app/admin/page.tsx` mantém o guard de sessão
(`redirect('/login')` / `notFound()`), chama o serviço e injeta o novo
componente puro `src/components/admin/sales-dashboard.tsx` antes da grelha
de áreas: 4 cartões executivos (faturação, AOV, encomendas + pendentes,
últimos 30 dias), distribuição por estado da encomenda e do pagamento
com os **badges/etiquetas partilhados** da §17 (`OrderStatusBadge` /
`PaymentStatusBadge` — garantia de rótulos iguais aos emails), top
produtos e últimas encomendas com links
`/admin/orders/[id]` + 'Ver todas'. Vazio: mensagens dedicadas
('Sem encomendas registadas.' etc.). A renderização do painel é
dinâmica (`/admin` ƒ) porque lê a base de dados por visita.

**Testes novos** — `src/server/analytics.test.ts` (base vazia → zeros;
estados mistos → faturação/AOV/pendentes/distribuições; asserção das
consultas SQL de faturação/top-vendas; filtragem dos 30 dias e janela
de 6 meses com meses vazios; mapeamento das últimas encomendas),
`src/components/admin/sales-dashboard.test.tsx` (cartões, badges
partilhados, produtos, links do detalhe, tendência, estados vazios) e
`src/app/admin/page.test.tsx` (renderiza resumo + áreas; guarda:
`redirect('/login')` sem sessão e `notFound()` sem perfil ADMIN -
`next-auth`/`next/navigation`/analytics e `@/server/auth` simulados;
cuidado: `beforeEach(vi.clearAllMocks())` para não arrastar chamadas
entre testes de guard).

**Nota de hotfix pós-épico (2026-10-23)** — `/admin` rebentava em
runtime com `PrismaClientValidationError` ("Invalid
db.order.groupBy() invocation"): o top-produtos fazia `groupBy` por
campos de `OrderItem` (`productVariantId`,
`productNameAtPurchase`, `productSkuAtPurchase`) diretamente no
modelo pai `Order`. **Lição: `PrismaClientValidationError` não
aparece nos testes de unidade — os doubles (mocks) da base de dados
não validam a sintaxe contra o schema Prisma real; queries complexas
de `groupBy`/`aggregate` têm de ser verificadas contra uma base de
dados real** (script temporário `node --env-file=.env` + `PrismaPg`,
reprodução e forma corrigida). Campos de tabelas relacionadas (ex.:
`OrderItem`) falham se forem consultados diretamente no pai (ex.:
`Order`). Corrigido: a consulta corre em `db.orderItem.groupBy` com
os mesmos argumentos; a interface `AnalyticsClient` distingue agora
os dois modelos (o teste usa o handle `itemGroupBy`).

**Validação (2026-10-22):** `tsc --noEmit` limpo; `vitest run` — 1890
testes, 127 ficheiros (+3 skipped); ESLint limpo (0 avisos); `next
build` concluída (aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é
pré-existente). Trabalho **commitado** (`7d21479 feat(admin): sales
dashboard with paid-order analytics`).

## 19. Motor de envio dinâmico + método de envio no checkout (tarefa de 2026-10-22)

Estado da **etapa 6** do roadmap.

**Modelo** — enum `ShippingMethod { STANDARD EXPRESS }`; em
`CheckoutRegionRule` o campo `expressShippingCost Decimal?`
(`null` = envio expresso **desativado** naquela região) e em `Order` o
campo `shippingMethod ShippingMethod?` (`null` no levantamento em loja
e nas encomendas de entrega anteriores à etapa — sem valor por defeito
na BD; legacy é apresentado como standard). Migração
`prisma/migrations/20261022120000_shipping_method` aplicada no local
(`pfautoparts`) e `prisma generate` refeito.

**Regra de negócio (fixada)** — o expresso é **suplemento por cima dos
portes calculados** (classe, máximos, limiar grátis). Portes base
grátis (limiar atingido) → expresso custa só o suplemento. Suplemento
padrão de instalação nova em Portugal Continental: `9.90`; linhas já
existentes ficam a `null` até o admin configurar. Fingerprint do
checkout passou `schemaVersion` 4 → 5 (inclui `shippingMethod` +
preços do expresso) — qualquer preview/encomenda pré-etapa é invalidado
de forma segura.

**Catálogo partilhado** — `src/lib/shipping-methods.ts` é a única fonte
de rótulos/estimativas ('Envio standard' / 'Envio expresso' /
'Levantamento em loja'; 'Entrega estimada em 2–5 / 1–2 dias úteis.' /
'Pronto para levantamento em 1–3 dias úteis após a confirmação do
pagamento.'). Vivem **em código, não em BD**: são cópia textual, não
dados configuráveis; `DELIVERY` + `null` (legacy) apresenta como
standard.

**Servidor** — `checkout.ts` ganhou `normalizeShippingMethod` (rejeita
`shippingMethod` no levantamento e valores inválidos), `getExpressAvailability`
e pricing em `shipping-pricing.ts` (suplemento validado em cêntimos:
erro 'Valor inválido em suplemento expresso'). Rotas `/api/checkout` e
`/api/checkout/preview` aceitam/validam o campo literal (`INVALID_SHIPPING_METHOD`
/ 400 no `PICKUP` + método). `orders.ts` transporta `shippingMethod`
nulo-explícito; `/conta` e o email usam `??` no cliente/template
(legacy → standard).

**UI** — checkout: fieldset 'Velocidade de entrega' com os dois rácios
do catálogo, expresso desativado quando `preview.expressAvailable === false`,
resumo com método + estimativa. Admin: campo 'Suplemento expresso (€)'
no bloco Portugal Continental ('Vazio = envio expresso desativado.').
**Armadilha** de testing-library: texto de dica dentro de `<label>`
quebra o `getByLabelText` exato — a dica ficou fora, como `<p>` irmão.

**Email** — `OrderConfirmationEmail` recebe `shippingMethod`
(`DELIVERY ? (order.shippingMethod ?? 'STANDARD') : null`), mostra
linha forte com o rótulo (só em entrega, para não duplicar o
cabeçalho de levantamento) + estimativa do catálogo. `deliverEmail`
chama o template **como função** (`OrderConfirmationEmail(props)`) —
o valor capturado pelo mock é a árvore JSX já avaliada, por isso os
testes de `email.ts` afirmam via HTML renderizado
(`renderedConfirmationEmail` com `@react-email/render`), não por props.

**Testes** — +57 testes: `shipping-methods` (10), `commercial-settings`
(21), `shipping-pricing` (32), checkout + rotas, `checkout-client`,
`checkout-payment` (+ expresso nos fixtures: sem `expressShippingCost`
nos doubles lança erro de suplemento inválido; sem `expressAvailable`
nos previews simulados o cliente mostra 'Resposta inválida do
servidor'), `orders`, `/conta`, email + template.

**Validação (2026-10-22):** `tsc --noEmit` limpo; `vitest run` — 1947
testes, 127 ficheiros (+3 skipped); ESLint limpo; `next build`
concluída (aviso `DYNAMIC_SERVER_USAGE` no `/checkout` é
pré-existente). Trabalho **não commitado** — ver `CHECKPOINT.md`.

## 20. Inventário: alertas de stock baixo e correção rápida (tarefa de 2026-10-23)

Estado da **etapa 7** do roadmap. Sem alteração de schema —
`ProductVariant.stockQuantity Int` já existia.

**Serviço** — `src/server/inventory.ts` (§13: `InventoryClient`
injetável com doubles tipados, `normalize*` puros e `getClient(client?)`):
- `listLowStockVariants({ threshold?, limit? }, client?)` —
  `findMany` em `productVariant` com
  `where: { stockQuantity: { lte: threshold }, isActive: true,
  product: { isActive: true } }`: só variantes de produtos ativos
  (o que a loja efetivamente pode esgotar). Ordenação
  `stockQuantity asc` + `sku asc` (críticos primeiro, determinístico),
  `take: limit`.
- Limiar: `DEFAULT_LOW_STOCK_THRESHOLD = 5`
  (`undefined|null|''` → padrão; texto não numérico e frações → 'O
  limiar de stock deve ser um número inteiro'; fora de [1, 99]
  [MAX_LOW_STOCK_THRESHOLD] → mensagem de intervalo; `'1e3'` é
  interpretado como 1000 e rejeitado pelo intervalo). Limite de
  resultados: `DEFAULT_LOW_STOCK_LIMIT = 20`, intervalo [1, 100].
- `updateVariantStock({ variantId, stock }, client?)` — **define o valor
  absoluto** (não é delta; o admin vê o número novo na tabela):
  `findUnique` → `InventoryNotFoundError` (404-like, sem update) →
  `update` → devolve `{ previousStock, variant: LowStockVariant }`.
  Stock válido: inteiro em [0, 999999] (MAX_STOCK_QUANTITY);
  `variantId` só string não vazia. Erros: `InventoryValidationError`
  (400) com `field: threshold|limit|variantId|stock` para a rota.
- Mapeamento cru→painel: `toLowStockVariant` (`id → variantId`,
  `stockQuantity → stock`, produto id/nome/slug).

**Rota** — `src/app/api/admin/inventory` (guard `requireAdmin()` da
`@/server/admin-auth`, o mesmo da etapa 5):
- `GET` — `?threshold=` (string crua normalizada pela rota via
  `normalizeLowStockThreshold`; sem parâmetro → padrão 5) →
  200 `{ threshold, variants }`.
- `PATCH` — corpo `{ variantId, stock }` → 200 snapshot
  `{ previousStock, variant }`; 404 `Variante não encontrada`
  (`InventoryNotFoundError` verificado **antes** de
  `InventoryValidationError` na cadeia de instanceof — é subclasse);
  400 validação/JSON inválido; 401/403 auth; 500 inesperado.

**Widget** — `src/components/admin/inventory-alerts.tsx`
('use client', padrão visual do `SalesDashboard`): tabela com produto,
SKU, stock atual + badge ('Sem stock' vermelho a 0; 'Stock baixo'
âmbar para 1..limiar), input `aria-label="Novo stock de {sku}"`
(valor inicial = stock atual) e botão `aria-label="Guardar stock de
{sku}"`. Após PATCH: stock ≤ limiar → linha atualizada in situ;
acima → linha removida (já não é ruptura) + aviso
`Stock de {produto} guardado (anterior → novo unidades).` Draft vazio
→ erro local 'Introduz o novo stock antes de guardar.' sem pedido.
Botão 'Atualizar lista' reexecuta o GET com o limiar corrente.
Página `/admin` (`page.tsx`) busca em paralelo
`Promise.all([getSalesOverview(), listLowStockVariants()])` e injeta
`<InventoryAlerts threshold={DEFAULT_LOW_STOCK_THRESHOLD} variants={…} />`
depois do resumo de vendas.

**Testes** — +32: `inventory.ts` (12: where/orderBy/take exatos,
limiar-limite padrão e personalizados, invalidez 0/-3/'abc'/2.5/100,
mapeamento, update com anterior/devolvida, 0 e 999999 válidos, 404),
rota (12: 200/normalização da query/401/403/400/500 + PATCH 200/401/
corpo inválido/JSON inválido/404/400), widget (7: tabela+badges+limiar,
vazio, guarda e mantém, passa o limiar→remove linha, erro do servidor,
draft vazio sem pedido, atualizar lista) e página admin (2 novos:
widget vazio + widget com variante crítica; mock
`@/server/inventory` vem com `DEFAULT_LOW_STOCK_THRESHOLD: 5` — o
módulo é mockado por completo, constantes incluídas).

**Validação (2026-10-23):** `tsc --noEmit` limpo; `vitest run` — 1979
testes, 130 ficheiros (+3 skipped); ESLint limpo; `next build`
concluída (à data o aviso `DYNAMIC_SERVER_USAGE` no `/checkout` era
pré-existente; resolvido na §21). Commit da etapa: `2ea2eb7`.

## 21. Polimento final, auditoria de performance e SEO base (etapa 8, 2026-10-23)

Fecha a **fase de fundação da vitrine**. Branch
`design/storefront-foundation` pronta para PR contra `main`. Sem
alteração de schema e sem novos testes (a cobertura de metadados vem
do build — mapa de rotas e prerender; a suíte existente mantém-se
intacta).

**1. Aviso `DYNAMIC_SERVER_USAGE` no `/checkout` — resolvido**
- Causa: no build o Next tentava prerender estático de `/checkout`;
  `requireActiveUserId()` usa `getServerSession` → `headers()` →
  bailout dinâmico que o catch da própria página apanhava e logava
  como 'Checkout cart check failed:' (parecia erro, mas o build
  acabava 0 e a rota era ƒ de qualquer forma).
- Correção: `export const dynamic = 'force-dynamic'` em
  `src/app/checkout/page.tsx` (rota por sessão). Com o segmento
  declarado, o build deixa de tentar prerender: sem aviso, sem catch
  a engolir o bailout, rota continua ƒ.
- Convenção: qualquer página que toque em sessão/`headers()` no
  servidor declara `dynamic = 'force-dynamic'` (home, produto,
  categoria e checkout). As shells `/carrinho` `/conta` `/login`
  `/registar` são `○` estáticas porque o cliente busca dados de
  sessão via API — manter assim.

**2. SEO base (+ Open Graph)**
- `src/app/seo.ts`: `SITE_NAME` ('PFAUTOPARTS'),
  `SITE_DESCRIPTION` ('Jantes premium, suspensões, body-kits e
  personalização automóvel.') e
  `buildPageMetadata({ title, description, path?, image?,
  absoluteTitle? })` — título, descrição, `alternates.canonical` e
  Open Graph (type website, locale pt_PT, siteName) coerentes; cards
  Twitter herdam do OG resolvido.
- Layout: `metadataBase` de `NEXTAUTH_URL ??
  'http://localhost:3000'` (mesma convenção de robots.ts/sitemap.ts;
  env inválido → try/catch e fallback, não rebenta o build),
  `title: { default: 'PFAUTOPARTS', template: '%s | PFAUTOPARTS' }`,
  defaults OG + `twitter.card: 'summary_large_image'`.
- `generateMetadata` por item na página de produto e de categoria:
  título/nome, descrição (descrição do produto truncada a 300 ou
  fallback construído; na categoria, descrição ou
  `getCategorySupportCopy`), canonical `/produtos/{slug}` /
  `/categorias/{slug}` **sem filtros**, og:image da primeira imagem
  do produto. Produto/categoria inexistentes → título de fallback
  com `robots: { index: false }` (não chamam `notFound()` duplicado;
  a página própria o faz).
- Home: `metadata` via helper com `absoluteTitle: true` (bypass do
  template), canonical `/` e og:image = imagem hero. Títulos
  adicionados a `/carrinho` ('Carrinho de compras') e `/checkout`
  ('Finalizar compra'). `/conta` `/login` `/registar` herdam o
  default do layout (auth flows, fora do âmbito do baseline).

**3. Estratégia de fetching/caching — decisões**
- Páginas de comércio (`/`, `/produtos/[slug]`,
  `/categorias/[slug]`, `/checkout`) **permanecem
  `force-dynamic`**: preços e stock têm de estar frescos a cada
  request e a home/categoria têm pesquisa/filtros por URL. NÃO
  introduzir `revalidate`/ISR nas páginas de comércio; a validação
  de stock/preço autoritativa está no POST do checkout.
- Deduplicação por request — `src/server/catalog-request.ts`:
  `getCatalogCategories = cache(listCatalogCategories)` (React
  `cache`). Layout, home, produto e categoria partilham UMA consulta
  de categorias por request (o header do layout, o rodapé e os
  metadados reutilizam); na página de produto, `generateMetadata` e
  o corpo passam a partilhar a leitura do produto
  (`getCatalogProductBySlug` com `cache()` nível de página em vez de
  duas consultas). Sem TTL — apenas dedupe intra-request.
  - `cache()` NÃO entra nos serviços (`src/server/*` testados):
    fora do contexto React de request a memo seria global e
    contaminaria os testes com client injetável. Wrappers vivem do
    lado de apresentação/páginas.
- `/sitemap.xml`: `force-dynamic` → `revalidate = 3600` (ISR: no
  build aparece `○ /sitemap.xml 1h 1y`), deixa de consultar a BD a
  cada request; try/catch degrada de forma controlada para a entrada
  só-da-home se a BD estiver inacessível no build. `/robots.txt`
  mantém-se `○`; lista de disallow inalterada
  (`/admin`, `/api`, `/conta`, `/checkout`, `/carrinho`).
- Limitação conhecida (documentada, fora do âmbito): nas shells
  estáticas `○` o cabeçalho reflete as categorias do build (o layout
  lê a BD no prerender); estudar `revalidate` no layout ou header
  via API se se tornar relevante em produção.

Ficheiros da etapa 8: novos
`src/server/catalog-request.ts`, `src/app/seo.ts`; alterados
`layout.tsx`, `page.tsx`, `produtos/[slug]/page.tsx`,
`categorias/[slug]/page.tsx`, `checkout/page.tsx`,
`carrinho/page.tsx`, `sitemap.ts`.

**Validação (2026-10-23):** `npx tsc --noEmit` limpo; `npx vitest
run` — 1979 testes, 130 ficheiros (+3 skipped); ESLint limpo;
`next build` **sem avisos**: log 'Checkout cart check failed'
desapareceu, `/checkout` permanece ƒ, `/api/admin/inventory` ƒ,
`/sitemap.xml` ○ com revalidate 1h. Trabalho **não commitado** — ver
`CHECKPOINT.md`.
