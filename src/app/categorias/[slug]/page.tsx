import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalogCategoryPageBySlug } from '@/server/catalog'

export const dynamic = 'force-dynamic'

type CategoryPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    stock?: string | string[]
  }>
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(price)
}

function getSearchParamValue(
  value: string | string[] | undefined,
) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([
    params,
    searchParams,
  ])

  const inStockOnly =
    getSearchParamValue(query.stock) ===
    'available'

  const result =
    await getCatalogCategoryPageBySlug(
      slug,
      {
        inStockOnly,
      },
    )

  if (!result) {
    notFound()
  }

  const { category, products } = result

  const stockFilterHref = inStockOnly
    ? `/categorias/${category.slug}`
    : `/categorias/${category.slug}?stock=available`

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-sm font-medium underline underline-offset-4"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section aria-labelledby="category-heading">
          <p className="text-sm font-medium tracking-[0.15em] text-neutral-600 dark:text-neutral-400">
            CATEGORIA
          </p>

          <h1
            id="category-heading"
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {category.name}
          </h1>

          {category.description && (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {category.description}
            </p>
          )}

          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            {products.length === 1
              ? '1 produto disponível'
              : `${products.length} produtos disponíveis`}
          </p>
        </section>

        <section
          aria-labelledby="filters-heading"
          className="mt-8 rounded-lg border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2
                id="filters-heading"
                className="font-semibold"
              >
                Filtros
              </h2>

              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Refina os produtos desta categoria.
              </p>
            </div>

            {inStockOnly && (
              <Link
                href={`/categorias/${category.slug}`}
                className="text-sm font-medium underline underline-offset-4"
              >
                Limpar filtros
              </Link>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={stockFilterHref}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 ${
                inStockOnly
                  ? 'border-foreground bg-foreground text-background'
                  : 'hover:border-neutral-500'
              }`}
            >
              {inStockOnly
                ? '✓ Em stock'
                : 'Em stock'}
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="products-heading"
          className="mt-8"
        >
          <h2
            id="products-heading"
            className="sr-only"
          >
            Produtos
          </h2>

          {products.length === 0 ? (
            <div className="rounded-lg border p-6">
              <p className="font-medium">
                Nenhum produto corresponde aos
                filtros selecionados.
              </p>

              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Remove ou altera os filtros para
                voltares a ver os produtos desta
                categoria.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/produtos/${product.slug}`}
                  aria-label={`Ver ${product.name}`}
                  className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                >
                  <article className="flex h-full flex-col overflow-hidden rounded-lg border transition group-hover:border-neutral-500">
                    <div className="flex aspect-[4/3] items-center justify-center border-b bg-neutral-50 px-4 text-center dark:bg-neutral-950">
                      {product.images.length > 0 ? (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          Imagem associada ao produto
                        </p>
                      ) : (
                        <p className="text-sm text-neutral-500">
                          Sem imagem
                        </p>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="mb-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border px-2 py-1">
                          {product.category.name}
                        </span>

                        {product.brand && (
                          <span className="rounded-full border px-2 py-1">
                            {product.brand.name}
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold leading-snug group-hover:underline">
                        {product.name}
                      </h3>

                      {product.description && (
                        <p className="mt-2 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
                          {product.description}
                        </p>
                      )}

                      <div className="mt-auto pt-5">
                        <p className="text-xl font-bold">
                          {formatPrice(
                            product.price,
                          )}
                        </p>

                        <p
                          className={`mt-1 text-sm font-medium ${
                            product.inStock
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {product.inStock
                            ? 'Em stock'
                            : 'Sem stock'}
                        </p>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}