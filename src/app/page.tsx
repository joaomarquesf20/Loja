import Link from 'next/link'
import {
  listCatalogCategories,
  listCatalogProducts,
} from '@/server/catalog'

export const dynamic =
  'force-dynamic'

function formatPrice(
  price: number,
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
    },
  ).format(price)
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
    >
      <path
        d="M4 10h12M11.5 5.5 16 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProductArtwork({
  hasImage,
}: {
  hasImage: boolean
}) {
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-line bg-surface-muted">
      <div
        aria-hidden="true"
        className="absolute -right-10 -top-12 size-40 rounded-full border-[24px] border-foreground/[0.04]"
      />

      <div
        aria-hidden="true"
        className="absolute -bottom-14 -left-12 size-40 rounded-full border-[24px] border-brand/10"
      />

      <div className="relative grid size-20 place-items-center rounded-3xl border border-line bg-surface shadow-sm">
        <svg
          aria-hidden="true"
          viewBox="0 0 48 48"
          className="size-10 text-foreground"
          fill="none"
        >
          <circle
            cx="24"
            cy="24"
            r="7"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M37.4 10.6l-4.2 4.2M14.8 33.2l-4.2 4.2"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <span className="absolute bottom-3 left-3 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {hasImage
          ? 'Imagem disponível'
          : 'Fotografia em breve'}
      </span>
    </div>
  )
}

export default async function Home() {
  const [products, categories] =
    await Promise.all([
      listCatalogProducts(),
      listCatalogCategories(),
    ])

  const inStockCount =
    products.filter(
      (product) => product.inStock,
    ).length

  return (
    <main className="flex-1 bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-white/10 bg-[#0d121a] text-white">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2 bg-[radial-gradient(circle_at_75%_30%,rgba(241,90,41,0.18),transparent_34%)]"
        />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center lg:px-8 lg:py-22">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              <span className="size-1.5 rounded-full bg-brand" />
              Catálogo automóvel
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Peças certas.
              <span className="block text-brand">
                Estrada pela frente.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
              Encontra peças e acessórios
              para o teu automóvel num
              catálogo organizado por
              categoria, marca e
              compatibilidade.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/#produtos"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d121a]"
              >
                Explorar catálogo
                <ArrowIcon />
              </Link>

              <Link
                href="/#categorias"
                className="inline-flex items-center rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d121a]"
              >
                Ver categorias
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">
              PFAUTOPARTS
            </p>

            <h2 className="mt-3 text-2xl font-black tracking-tight">
              Tudo o que precisas para
              escolher com clareza.
            </h2>

            <div className="mt-6 grid gap-3">
              {[
                [
                  '01',
                  'Stock visível',
                  'Percebe rapidamente o que está disponível.',
                ],
                [
                  '02',
                  'Compatibilidade',
                  'Filtra peças pela configuração do veículo.',
                ],
                [
                  '03',
                  'Conta completa',
                  'Guarda moradas e acompanha as tuas encomendas.',
                ],
              ].map(
                ([
                  number,
                  title,
                  description,
                ]) => (
                  <div
                    key={number}
                    className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-white/10 bg-black/10 p-4"
                  >
                    <span className="text-xs font-black text-brand">
                      {number}
                    </span>

                    <div>
                      <p className="font-bold">
                        {title}
                      </p>

                      <p className="mt-1 text-sm leading-5 text-white/55">
                        {description}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </aside>
        </div>

        <div className="relative border-t border-white/10">
          <dl className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-white/10 px-4 sm:px-6 lg:px-8">
            <div className="py-5 pr-4">
              <dt className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                Produtos
              </dt>
              <dd className="mt-1 text-2xl font-black">
                {products.length}
              </dd>
            </div>

            <div className="px-4 py-5 sm:px-8">
              <dt className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                Em stock
              </dt>
              <dd className="mt-1 text-2xl font-black">
                {inStockCount}
              </dd>
            </div>

            <div className="py-5 pl-4 sm:pl-8">
              <dt className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                Categorias
              </dt>
              <dd className="mt-1 text-2xl font-black">
                {categories.length}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {categories.length > 0 && (
        <section
          id="categorias"
          aria-labelledby="categories-heading"
          className="scroll-mt-28 border-b border-line bg-surface"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
                  Encontra mais rápido
                </p>

                <h2
                  id="categories-heading"
                  className="mt-2 text-3xl font-black tracking-[-0.03em]"
                >
                  Explora por categoria
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                  Acede diretamente às
                  famílias de peças que
                  já têm produtos
                  disponíveis no catálogo.
                </p>
              </div>

              <span className="text-sm font-semibold text-muted">
                {categories.length === 1
                  ? '1 categoria'
                  : `${categories.length} categorias`}
              </span>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(
                (category, index) => (
                  <Link
                    key={category.id}
                    href={`/categorias/${category.slug}`}
                    className="group flex min-h-36 flex-col justify-between rounded-2xl border border-line bg-background p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-black/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs font-black tracking-[0.16em] text-muted">
                        {String(
                          index + 1,
                        ).padStart(
                          2,
                          '0',
                        )}
                      </span>

                      <span className="grid size-9 place-items-center rounded-full border border-line text-muted transition group-hover:border-brand group-hover:bg-brand group-hover:text-white">
                        <ArrowIcon />
                      </span>
                    </div>

                    <h3 className="mt-8 text-lg font-black tracking-tight">
                      {category.name}
                    </h3>
                  </Link>
                ),
              )}
            </div>
          </div>
        </section>
      )}

      <section
        id="produtos"
        aria-labelledby="products-heading"
        className="scroll-mt-28"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
                Catálogo
              </p>

              <h2
                id="products-heading"
                className="mt-2 text-3xl font-black tracking-[-0.03em]"
              >
                Produtos disponíveis
              </h2>

              <p className="mt-3 text-sm leading-6 text-muted">
                {products.length ===
                1
                  ? '1 produto no catálogo'
                  : `${products.length} produtos no catálogo`}
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted">
              <span className="size-2 rounded-full bg-green-500" />
              {inStockCount}{' '}
              {inStockCount === 1
                ? 'em stock'
                : 'em stock'}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-surface p-10 text-center sm:p-14">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-muted text-2xl">
                ⚙
              </div>

              <h3 className="mt-5 text-xl font-black">
                Catálogo sem produtos
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Neste momento não
                existem produtos
                disponíveis no catálogo.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map(
                (product) => (
                  <Link
                    key={product.id}
                    href={`/produtos/${product.slug}`}
                    aria-label={`Ver ${product.name}`}
                    className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition duration-200 group-hover:-translate-y-1 group-hover:border-foreground/20 group-hover:shadow-xl group-hover:shadow-black/[0.06]">
                      <ProductArtwork
                        hasImage={
                          product.images
                            .length > 0
                        }
                      />

                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.08em]">
                          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand-strong">
                            {
                              product
                                .category
                                .name
                            }
                          </span>

                          {product.brand && (
                            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-muted">
                              {
                                product
                                  .brand
                                  .name
                              }
                            </span>
                          )}
                        </div>

                        <h3 className="mt-4 text-base font-black leading-snug tracking-tight">
                          {
                            product.name
                          }
                        </h3>

                        {product.description && (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                            {
                              product.description
                            }
                          </p>
                        )}

                        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                          <div>
                            <p className="text-xl font-black tracking-tight">
                              {formatPrice(
                                product.price,
                              )}
                            </p>

                            <p
                              className={`mt-1 flex items-center gap-1.5 text-xs font-bold ${
                                product.inStock
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  product.inStock
                                    ? 'bg-green-500'
                                    : 'bg-red-500'
                                }`}
                              />
                              {product.inStock
                                ? 'Em stock'
                                : 'Sem stock'}
                            </p>
                          </div>

                          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition group-hover:border-brand group-hover:bg-brand group-hover:text-white">
                            <ArrowIcon />
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ),
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
