import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalogProductBySlug } from '@/server/catalog'
import AddToCartButton from './add-to-cart-button'

export const dynamic = 'force-dynamic'

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
}

function formatPrice(price: number) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
    },
  ).format(price)
}

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const { slug } = await params

  const product =
    await getCatalogProductBySlug(slug)

  if (!product) {
    notFound()
  }

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
        <article className="grid gap-8 lg:grid-cols-2">
          <section
            aria-label="Imagem do produto"
            className="flex aspect-[4/3] items-center justify-center rounded-lg border bg-neutral-50 p-6 text-center dark:bg-neutral-950"
          >
            {product.images.length >
            0 ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Imagem associada ao produto
              </p>
            ) : (
              <p className="text-sm text-neutral-500">
                Sem imagem
              </p>
            )}
          </section>

          <section className="flex flex-col">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border px-2 py-1">
                {product.category.name}
              </span>

              {product.brand && (
                <span className="rounded-full border px-2 py-1">
                  {product.brand.name}
                </span>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {product.name}
            </h1>

            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              SKU: {product.sku}
            </p>

            <div className="mt-6">
              <p className="text-3xl font-bold">
                {formatPrice(
                  product.price,
                )}
              </p>

              <p
                className={`mt-2 text-sm font-medium ${
                  product.inStock
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {product.inStock
                  ? 'Em stock'
                  : 'Sem stock'}
              </p>

              <AddToCartButton
                productId={product.id}
                inStock={product.inStock}
              />
            </div>

            {product.description ? (
              <div className="mt-8 border-t pt-6">
                <h2 className="text-lg font-semibold">
                  Descrição
                </h2>

                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {product.description}
                </p>
              </div>
            ) : (
              <div className="mt-8 border-t pt-6">
                <h2 className="text-lg font-semibold">
                  Descrição
                </h2>

                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                  Este produto não tem
                  descrição disponível.
                </p>
              </div>
            )}
          </section>
        </article>
      </div>
    </main>
  )
}