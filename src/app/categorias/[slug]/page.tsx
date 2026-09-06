import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalogCategoryPageBySlug } from '@/server/catalog'

export const dynamic = 'force-dynamic'

type CategoryPageProps = {
  params: Promise<{
    slug: string
  }>
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(price)
}

export default async function CategoryPage({
  params,
}: CategoryPageProps) {
  const { slug } = await params

  const result =
    await getCatalogCategoryPageBySlug(slug)

  if (!result) {
    notFound()
  }

  const { category, products } = result

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
          aria-labelledby="products-heading"
          className="mt-8"
        >
          <h2
            id="products-heading"
            className="sr-only"
          >
            Produtos
          </h2>

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
                        {formatPrice(product.price)}
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
        </section>
      </div>
    </main>
  )
}