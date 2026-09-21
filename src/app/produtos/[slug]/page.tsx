import Link from 'next/link'
import { notFound } from 'next/navigation'
import Price from '@/components/storefront/price'
import StockBadge from '@/components/storefront/stock-badge'
import StorefrontFooter from '@/components/storefront/storefront-footer'
import {
  isStorefrontCategoryVisible,
  sortStorefrontCategories,
} from '@/lib/storefront-category-media'
import {
  getCatalogProductBySlug,
  listCatalogCategories,
} from '@/server/catalog'
import AddToCartButton from './add-to-cart-button'
import ProductGallery from './product-gallery'

export const dynamic = 'force-dynamic'

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
}

function getFooterCategories(
  categories: Awaited<
    ReturnType<typeof listCatalogCategories>
  >,
) {
  const commercial =
    sortStorefrontCategories(
      categories.filter(
        isStorefrontCategoryVisible,
      ),
    )

  const topLevel =
    commercial.filter(
      (category) =>
        category.parentId === null,
    )

  return (
    topLevel.length > 0
      ? topLevel
      : commercial
  ).slice(0, 4)
}

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const { slug } = await params

  const [product, categories] =
    await Promise.all([
      getCatalogProductBySlug(slug),
      listCatalogCategories(),
    ])

  if (!product) {
    notFound()
  }

  const footerCategories =
    getFooterCategories(categories)

  return (
    <main className="min-h-screen bg-[#0b0d0f] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 lg:px-8 lg:pb-20 lg:pt-9">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/38"
        >
          <Link
            href="/"
            className="transition hover:text-white"
          >
            Início
          </Link>

          <span aria-hidden="true">
            /
          </span>

          <Link
            href={`/categorias/${product.category.slug}`}
            className="transition hover:text-white"
          >
            {product.category.name}
          </Link>

          <span aria-hidden="true">
            /
          </span>

          <span className="max-w-[18rem] truncate text-white/66 sm:max-w-md">
            {product.name}
          </span>
        </nav>

        <article className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:gap-14 xl:gap-16">
          <ProductGallery
            name={product.name}
            images={product.images}
          />

          <section className="lg:sticky lg:top-36">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-black uppercase tracking-[0.12em]">
              {product.brand && (
                <span className="text-brand">
                  {product.brand.name}
                </span>
              )}

              <Link
                href={`/categorias/${product.category.slug}`}
                className="text-white/34 transition hover:text-white"
              >
                {product.category.name}
              </Link>
            </div>

            <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl lg:text-[2.7rem]">
              {product.name}
            </h1>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-white/30">
              SKU {product.sku}
            </p>

            <div className="mt-8 border-y border-white/8 py-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <Price
                  value={product.price}
                  className="text-3xl font-black tracking-[-0.035em] text-white sm:text-[2rem]"
                />

                <StockBadge
                  inStock={
                    product.inStock
                  }
                />
              </div>

              <div className="mt-6">
                <AddToCartButton
                  productId={product.id}
                  inStock={
                    product.inStock
                  }
                  variant="product"
                />
              </div>
            </div>

            <section
              aria-labelledby="description-heading"
              className="pt-7"
            >
              <h2
                id="description-heading"
                className="text-sm font-black uppercase tracking-[0.12em] text-white/78"
              >
                Descrição
              </h2>

              {product.description ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/50">
                  {product.description}
                </p>
              ) : (
                <p className="mt-4 text-sm leading-7 text-white/38">
                  Ainda não existe uma
                  descrição detalhada para
                  este produto.
                </p>
              )}
            </section>

            <div className="mt-8 border-t border-white/8 pt-6">
              <Link
                href={`/categorias/${product.category.slug}`}
                className="inline-flex items-center border-b border-white/18 pb-1 text-[10px] font-black uppercase tracking-[0.1em] text-white/52 transition hover:border-brand hover:text-white"
              >
                Ver mais em{' '}
                {product.category.name}
              </Link>
            </div>
          </section>
        </article>
      </div>

      <StorefrontFooter
        categories={footerCategories}
      />
    </main>
  )
}
