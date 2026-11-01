# Loja de Peças — Template White-Label

Template **turnkey** para lojas de peças e acessórios automóvel: catálogo com imagem,
compatibilidade por veículo (Épico 8), carrinho de convidado com merge, checkout com
Stripe ou pagamento simulado, gestão de encomendas com transições auditadas, fluxo de
stock, cupões, importação de catálogo em CSV, emails transacionais e backoffice completo.

É **white-label**: nenhuma marca do cliente anterior permanece no código. A identidade
(nome, contactos, NIF, morada, cor e logótipo) configura-se no backoffice
(**Admin → Configurações**) e é lida da base de dados — sem tocar no código.

---

## Stack técnica

| Camada           | Tecnologia                                        |
| ---------------- | ------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Server Components)        |
| Linguagem        | TypeScript (modo estrito)                         |
| Base de dados    | PostgreSQL 14+ (Prisma 7 com adaptador `pg`)      |
| UI               | Tailwind CSS 4 (tokens de tema em CSS variables)  |
| Autenticação     | NextAuth (credenciais, papéis `ADMIN`/`CLIENT`)   |
| Pagamentos       | Stripe Checkout + webhook assinado; simulação dev |
| Emails           | Resend + templates React Email                    |
| Testes           | Vitest (unitários/componentes) + Playwright (E2E, opcional) |
| Validação        | Zod (contratos de serviço, form de configurações) |

---

## Pré-requisitos

- **Node.js 20+** e npm
- **PostgreSQL 14+** a correr localmente ou gerido (Neon, Supabase, RDS, …)
- Conta **Stripe** (opcional — sem chaves, o checkout funciona em modo simulado)
- Conta **Resend** (opcional — sem chave, os emails registam-se no log)

---

## Instalação passo a passo

### 1. Dependências

```bash
npm install
```

### 2. Variáveis de ambiente

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Preenche `.env` — todas as chaves estão documentadas no próprio ficheiro:

| Chave                            | Obrigatória | Notas                                                        |
| -------------------------------- | ----------- | ------------------------------------------------------------ |
| `DATABASE_URL`                   | ✅          | PostgreSQL (`postgresql://user:pass@host:5432/store`)          |
| `NEXTAUTH_URL`                   | ✅          | `http://localhost:3000` em dev; domínio público em produção  |
| `NEXTAUTH_SECRET`                | ✅          | Gera com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `RESEND_API_KEY`                 | ❌          | Falta ⇒ emails em modo simulação (log apenas)                |
| `EMAIL_FROM`                     | (envio)     | `Nome da loja <no-reply@teudominio.pt>`                       |
| `STRIPE_SECRET_KEY`              | ❌          | Falta ⇒ pagamentos simulados em dev                          |
| `STRIPE_WEBHOOK_SECRET`          | (prod)      | Assinatura do webhook Stripe                                  |
| `PAYMENT_WEBHOOK_SECRET`         | ✅          | Segredo do webhook interno de pagamentos (32+ carateres)      |
| `PRODUCT_IMAGE_STORAGE`          | ❌          | `local` (dev) ou `vercel-blob` (produção, ver abaixo)         |

### 3. Migrações da base de dados

```bash
npx prisma migrate dev      # desenvolvimento (aplica + gera cliente)
npx prisma generate         # re-gerar cliente Prisma sem migrar
```

Em produção usa:

```bash
npx prisma migrate deploy
```

### 4. Dados iniciais (opcionais)

O template entrega-se com a vitrine vazia mas **100% funcional** (estados vazios
amigáveis em todas as páginas). Para explorar com conteúdo:

```bash
# Catálogo demonstrativo (categorias, marcas, produtos, variantes, imagens)
npm run dev:catalog:seed

# Árvore estrutural de Marcas/Modelos/Especificações de veículos (Épico 8)
npm run dev:vehicles:seed
```

Para limpar **apenas** o catálogo de demonstração:

```bash
npm run dev:catalog:clear
```

Para limpar **todos** os dados transacionais (produtos, encomendas, stock, cupões,
carrinhos, importações, categorias e marcas de produto) numa transação, preservando as
tabelas estruturais — fitment de veículos (Makes/Models/Specs), contas de utilizador,
`StoreSettings` e definições comerciais:

```bash
npm run admin:reset            # simulação (mostra contagens, nada apaga)
npm run admin:reset -- --yes   # executa a eliminação
```

### 5. Arrancar em desenvolvimento

```bash
npm run dev
```

- **Vitrine:** <http://localhost:3000>
- **Backoffice:** <http://localhost:3000/admin> — cria a primeira conta
  (`/registar`) e promove-a a `ADMIN` diretamente na base de dados:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'o-teu-email@exemplo.pt';
```

### 6. Verificação (gate de qualidade)

```bash
npm run typecheck   # npx tsc --noEmit
npm run test        # vitest run
npm run lint        # eslint
npm run build       # prisma generate && next build
```

---

## White-label: configurar a identidade da loja

Toda a identidade vive na tabela `StoreSettings` (linha única, `id="store"`) e edita-se
no backoffice em **Admin → Configurações**:

- **Nome da loja** — cabeçalho, rodapé, títulos de SEO (`%s | Nome da loja`), emails;
- **Email / telefone / NIF / morada** de contacto;
- **Cor da loja** (`#RRGGBB`) — alimenta as CSS variables `--brand`,
  `--brand-strong` e `--brand-soft`, propagando-se a todo o site
  (espaço de administração incluído) sem mexer no código;
- **URL do logótipo** — caminho `/…` no `public/` ou URL `https://…`.

Predefinições do template (usadas enquanto um campo está vazio): `src/lib/brand-defaults.ts`.
Logótipos de exemplo: `public/brand/logo-horizontal{,-dark}.png`.

Os idiomas/datas usam `pt-PT` (moeda em euros, formato de datas `Intl`).

---

## Integrações externas

### Pagamentos

- Com `STRIPE_SECRET_KEY` configurado, o checkout cria uma **Stripe Checkout Session** e
  a confirmação chega pelo webhook `/api/payments/webhook` (assinatura verificada com
  `PAYMENT_WEBHOOK_SECRET`; teste a rotação com `PAYMENT_WEBHOOK_SECRET_PREVIOUS`).
- Sem chave Stripe, o pagamento é simulado em desenvolvimento — os pagamentos simulados
  **nunca** são servidos em produção (`NODE_ENV=production` responde 404).
- Os guardas de idempotência (entregas repetidas do webhook) estão em
  `src/server/order-lifecycle.ts`.

### Emails transacionais

- Templates React Email em `src/emails/` (confirmação de encomenda e atualização de
  estado), renderizados a HTML e enviados via Resend.
- Nome da loja injetado do branding configurado; subjects no formato
  `Nome da loja: Encomenda <n.º> confirmada`.
- Sem `RESEND_API_KEY`, o envio entra em modo de simulação (log no stdout).
- Pré-visualização no Admin (Encomendas → detalhe da encomenda).

### Imagens de produto

- Os bytes nunca vão para a base de dados (apenas URL + metadados).
- Development: adaptador local em `public/uploads/products`
  (`PRODUCT_IMAGE_UPLOAD_DIR` / `PRODUCT_IMAGE_PUBLIC_PATH`).
- Produção: define `PRODUCT_IMAGE_STORAGE=vercel-blob` + `BLOB_READ_WRITE_TOKEN`
  (Vercel Blob). A Vercel rejeita disco local por ser efémero.
- O adaptador local não apaga ficheiros quando uma imagem é removida de um produto.

---

## Estrutura do projeto

```
prisma/            Schema + migrações
public/brand/      Logótipos de exemplo do template
scripts/           Utilitários CLI (seed de dev, reset de dados)
src/app/           Rotas (App Router): vitrine + /admin + /api
src/components/    Componentes de vitrine e backoffice
src/emails/        Templates React Email
src/lib/           Utilitários client-safe (inclui brand-defaults.ts)
src/server/        Serviços de negócio (Prisma, pagamentos, emails, permissões)
```

Só os módulos de `src/lib/` são importados por componentes de cliente — os contratos de
servidor estão todos em `src/server/`.

---

## Deploy em produção

### Vercel (recomendado)

1. Importa o repositório na Vercel.
2. Define todas as variáveis de ambiente de `.env.example`
   (`NEXTAUTH_URL` com o domínio final; `RESEND_API_KEY`, `EMAIL_FROM`,
   chaves Stripe e `STRIPE_WEBHOOK_SECRET` para receber eventos reais;
   `PAYMENT_WEBHOOK_SECRET` com 32+ carateres aleatórios).
3. Para imagens em persistência real: cria um store **Vercel Blob**, define
   `PRODUCT_IMAGE_STORAGE=vercel-blob` e faz `vercel blob link`/`vercel link` para
   obter `BLOB_READ_WRITE_TOKEN`.
4. Aponta a migração inicial: `npx prisma migrate deploy` (CI local ou job de build).
5. Registra o webhook Stripe para `https://o-teu-dominio.pt/api/payments/webhook`.

### Outre plataformas (Docker/Node)

- `npm run build` gera tudo o que é preciso (`prisma generate` incluído); serve com
  `npm start`.
- A contingência de disco aplica-se: usa armazenamento de objetos para imagens.

## Segurança operacional

- Troca **todos** os valores `CHANGE_ME_*` do `.env.example`.
- O webhook de pagamentos valida assinatura + janela temporal
  (`PAYMENT_WEBHOOK_MAX_AGE_SECONDS`, default ±5 min).

---

## Comandos de referência

| Comando                   | Descrição                                          |
| ------------------------- | -------------------------------------------------- |
| `npm run dev`             | Servidor de desenvolvimento (Next.js)              |
| `npm run build`           | Build de produção (`prisma generate` + `next build`) |
| `npm start`               | Serve o build de produção                          |
| `npm run lint`            | ESLint                                             |
| `npm run typecheck`       | `tsc --noEmit`                                     |
| `npm run test`            | Vitest (suite completa)                            |
| `npm run test:e2e`        | Playwright E2E (requer `npx playwright install`)   |
| `npm run dev:catalog:seed`| Catálogo de demonstração                           |
| `npm run dev:catalog:clear`| Remove o catálogo de demonstração                 |
| `npm run dev:vehicles:seed`| Marcas/modelos/especificações de veículos (demo)  |
| `npm run admin:reset`     | Reset de dados transacionais (simulação; `--yes` executa) |
| `npx prisma studio`       | Explorador visual da base de dados                 |
