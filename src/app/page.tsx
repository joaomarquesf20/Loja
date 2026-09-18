import Link from 'next/link'
import CategoryCard from '@/components/storefront/category-card'
import ProductCard from '@/components/storefront/product-card'
import SectionHeading from '@/components/storefront/section-heading'
import {
  listCatalogCategories,
  listCatalogProducts,
} from '@/server/catalog'

export const dynamic =
  'force-dynamic'

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
    >
      <path
        d="m4.5 10.5 3.3 3.3 7.7-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
                Catálogo de peças automóveis
              </p>

              <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[2.75rem]">
                Encontre a peça certa
                para o seu automóvel
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                Consulte o catálogo real
                da PFAutoParts e refine
                depois por marca, preço,
                disponibilidade e
                configuração do veículo.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/#categorias"
                  className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Comprar por categoria
                </Link>

                <Link
                  href="/#produtos"
                  className="inline-flex items-center justify-center rounded-xl border border-line bg-surface px-5 py-3 text-sm font-bold text-foreground transition hover:border-slate-300 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Ver produtos
                </Link>
              </div>
            </div>

            <aside className="rounded-2xl border border-line bg-background p-5 sm:p-6">
              <p className="text-sm font-extrabold text-foreground">
                Escolha com informação real
              </p>

              <div className="mt-4 space-y-3">
                {[
                  'Stock disponível no catálogo',
                  'Filtro por configuração de veículo nas categorias',
                  'Carrinho sincronizado com a conta',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 text-sm leading-5 text-muted"
                  >
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                      <CheckIcon />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-accent text-white">
        <dl className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-white/15 px-4 sm:px-6 lg:px-8">
          <div className="py-4 pr-4 sm:py-5">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60 sm:text-xs">
              Produtos
            </dt>
            <dd className="mt-1 text-xl font-black sm:text-2xl">
              {products.length}
            </dd>
          </div>

          <div className="px-4 py-4 sm:px-8 sm:py-5">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60 sm:text-xs">
              Em stock
            </dt>
            <dd className="mt-1 text-xl font-black sm:text-2xl">
              {inStockCount}
            </dd>
          </div>

          <div className="py-4 pl-4 sm:py-5 sm:pl-8">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60 sm:text-xs">
              Categorias
            </dt>
            <dd className="mt-1 text-xl font-black sm:text-2xl">
              {categories.length}
            </dd>
          </div>
        </dl>
      </section>

      {categories.length > 0 && (
        <section
          id="categorias"
          aria-labelledby="categories-heading"
          className="scroll-mt-28 border-b border-line"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <SectionHeading
              eyebrow="Catálogo"
              title="Comprar por categoria"
              description="As categorias apresentadas vêm diretamente do catálogo ativo."
              aside={
                <span className="text-sm font-semibold text-muted">
                  {categories.length === 1
                    ? '1 categoria'
                    : `${categories.length} categorias`}
                </span>
              }
            />

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(
                (category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                  />
                ),
              )}
            </div>
          </div>
        </section>
      )}

      <section
        id="produtos"
        aria-labelledby="products-heading"
        className="scroll-mt-28 bg-surface"
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <SectionHeading
            eyebrow="Produtos"
            title="Produtos do catálogo"
            description="Preço, stock, marca e informação do produto são carregados a partir dos dados reais existentes."
            aside={
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-background px-3 py-1.5 text-xs font-bold text-muted">
                <span className="size-2 rounded-full bg-success" />
                {inStockCount} em stock
              </span>
            }
          />

          {products.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-dashed border-line bg-background p-10 text-center">
              <h3 className="text-lg font-black">
                Catálogo sem produtos
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Neste momento não existem
                produtos disponíveis no
                catálogo.
              </p>
            </div>
          ) : (
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
