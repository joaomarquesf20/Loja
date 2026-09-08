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

export default async function Home() {
  const [products, categories] =
    await Promise.all([
      listCatalogProducts(),
      listCatalogCategories(),
    ])

  return (
    <main className="flex-1 bg-background text-foreground">
      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Peças e acessórios
            automóveis
          </h1>

          <p className="mt-3 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Consulta os produtos
            atualmente disponíveis no
            catálogo.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {categories.length >
          0 && (
          <section aria-labelledby="categories-heading">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2
                  id="categories-heading"
                  className="text-xl font-semibold"
                >
                  Categorias
                </h2>

                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Apenas são
                  apresentadas
                  categorias com
                  produtos no
                  catálogo.
                </p>
              </div>

              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {
                  categories.length
                }
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map(
                (category) => (
                  <Link
                    key={
                      category.id
                    }
                    href={`/categorias/${category.slug}`}
                    className="rounded-full border px-3 py-1.5 text-sm transition hover:border-neutral-500 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                  >
                    {
                      category.name
                    }
                  </Link>
                ),
              )}
            </div>
          </section>
        )}

        <section aria-labelledby="products-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2
                id="products-heading"
                className="text-2xl font-semibold"
              >
                Produtos
              </h2>

              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {products.length ===
                1
                  ? '1 produto no catálogo'
                  : `${products.length} produtos no catálogo`}
              </p>
            </div>
          </div>

          {products.length ===
          0 ? (
            <div className="rounded-lg border p-8 text-center">
              <h3 className="font-semibold">
                Catálogo sem produtos
              </h3>

              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Neste momento não
                existem produtos
                disponíveis no
                catálogo.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map(
                (product) => (
                  <Link
                    key={
                      product.id
                    }
                    href={`/produtos/${product.slug}`}
                    aria-label={`Ver ${product.name}`}
                    className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                  >
                    <article className="flex h-full flex-col overflow-hidden rounded-lg border transition group-hover:border-neutral-500">
                      <div className="flex aspect-[4/3] items-center justify-center border-b bg-neutral-50 px-4 text-center dark:bg-neutral-950">
                        {product
                          .images
                          .length >
                        0 ? (
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Imagem
                            associada
                            ao
                            produto
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
                            {
                              product
                                .category
                                .name
                            }
                          </span>

                          {product.brand && (
                            <span className="rounded-full border px-2 py-1">
                              {
                                product
                                  .brand
                                  .name
                              }
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold leading-snug group-hover:underline">
                          {
                            product.name
                          }
                        </h3>

                        {product.description && (
                          <p className="mt-2 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
                            {
                              product.description
                            }
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
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
