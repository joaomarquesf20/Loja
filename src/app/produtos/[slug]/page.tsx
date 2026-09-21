import Link from 'next/link'
import { notFound } from 'next/navigation'
import Price from '@/components/storefront/price'
import ProductCard from '@/components/storefront/product-card'
import StockBadge from '@/components/storefront/stock-badge'
import StorefrontFooter from '@/components/storefront/storefront-footer'
import {
  isStorefrontCategoryVisible,
  sortStorefrontCategories,
} from '@/lib/storefront-category-media'
import {
  getCatalogCategoryPageBySlug,
  getCatalogProductBySlug,
  listCatalogCategories,
} from '@/server/catalog'
import { listProductCompatibilities } from '@/server/product-compatibilities'
import AddToCartButton from './add-to-cart-button'
import ProductGallery from './product-gallery'
import ProductInformationAccordion from './product-information-accordion'

export const dynamic = 'force-dynamic'

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
}

type ProductCompatibility =
  Awaited<
    ReturnType<
      typeof listProductCompatibilities
    >
  >[number]

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

function formatYears(
  yearFrom: number | null,
  yearTo: number | null,
) {
  if (
    yearFrom !== null &&
    yearTo !== null
  ) {
    return `${yearFrom}–${yearTo}`
  }

  if (yearFrom !== null) {
    return `desde ${yearFrom}`
  }

  if (yearTo !== null) {
    return `até ${yearTo}`
  }

  return null
}

function formatCompatibility(
  compatibility: ProductCompatibility,
) {
  const parts = [
    compatibility.vehicleBrand.name,
    compatibility.vehicleModel.name,
    compatibility.vehicleGeneration
      ?.name ?? null,
    compatibility.vehicleConfiguration
      ?.name ?? null,
  ].filter(
    (value): value is string =>
      Boolean(value),
  )

  const years =
    compatibility.vehicleConfiguration
      ? formatYears(
          compatibility
            .vehicleConfiguration.yearFrom,
          compatibility
            .vehicleConfiguration.yearTo,
        )
      : null

  return {
    label: parts.join(' · '),
    years,
  }
}

function getRelatedProducts(
  products: NonNullable<
    Awaited<
      ReturnType<
        typeof getCatalogCategoryPageBySlug
      >
    >
  >['products'],
  currentProductId: string,
  brandId?: string,
) {
  const candidates = products.filter(
    (product) =>
      product.id !== currentProductId,
  )

  if (!brandId) {
    return candidates.slice(0, 4)
  }

  const sameBrand = candidates.filter(
    (product) =>
      product.brand?.id === brandId,
  )

  const otherBrands = candidates.filter(
    (product) =>
      product.brand?.id !== brandId,
  )

  return [
    ...sameBrand,
    ...otherBrands,
  ].slice(0, 4)
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

  const [
    categories,
    compatibilities,
    categoryPage,
  ] = await Promise.all([
    listCatalogCategories(),
    listProductCompatibilities(
      product.id,
    ),
    getCatalogCategoryPageBySlug(
      product.category.slug,
    ),
  ])

  const footerCategories =
    getFooterCategories(categories)

  const relatedProducts =
    getRelatedProducts(
      categoryPage?.products ?? [],
      product.id,
      product.brand?.id,
    )

  const compatibilityPreview =
    compatibilities[0]
      ? formatCompatibility(
          compatibilities[0],
        )
      : null

  const specificationRows = [
    {
      label: 'Referência',
      value: product.sku,
    },
    ...(product.brand
      ? [
          {
            label: 'Marca',
            value: product.brand.name,
          },
        ]
      : []),
    {
      label: 'Categoria',
      value: product.category.name,
    },
  ]

  const informationItems = [
    {
      id: 'descricao',
      title: 'Descrição',
      content: product.description?.trim() ? (
        <p className="whitespace-pre-line text-sm leading-7 text-white/50">
          {product.description}
        </p>
      ) : (
        <p className="text-sm leading-7 text-white/38">
          Ainda não existe uma descrição
          detalhada para este produto.
        </p>
      ),
      defaultOpen: true,
    },
    {
      id: 'especificacoes',
      title: 'Especificações',
      content: (
        <dl className="grid gap-3 sm:grid-cols-2">
          {specificationRows.map(
            (row) => (
              <div
                key={row.label}
                className="border-l border-white/10 pl-4"
              >
                <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">
                  {row.label}
                </dt>
                <dd className="mt-1.5 text-sm font-bold text-white/72">
                  {row.value}
                </dd>
              </div>
            ),
          )}
        </dl>
      ),
    },
    ...(compatibilities.length > 0
      ? [
          {
            id: 'compatibilidade',
            title:
              'Compatibilidade / Aplicações',
            content: (
              <div className="grid gap-3">
                {compatibilities.map(
                  (compatibility) => {
                    const formatted =
                      formatCompatibility(
                        compatibility,
                      )

                    return (
                      <div
                        key={
                          compatibility.id
                        }
                        className="border-l border-brand/45 pl-4"
                      >
                        <p className="text-sm font-bold text-white/78">
                          {
                            formatted.label
                          }
                        </p>

                        {formatted.years && (
                          <p className="mt-1 text-xs font-semibold text-white/36">
                            {
                              formatted.years
                            }
                          </p>
                        )}
                      </div>
                    )
                  },
                )}
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'entrega-devolucoes',
      title: 'Entrega e devoluções',
      content: (
        <div className="grid gap-3 text-sm leading-7 text-white/50">
          <p>
            As opções e os custos de entrega
            são apresentados no checkout de
            acordo com o destino e as regras
            comerciais em vigor.
          </p>
          <p>
            As condições de devolução não
            estão parametrizadas no catálogo
            deste produto, por isso não
            apresentamos prazos ou condições
            que não estejam definidos.
          </p>
        </div>
      ),
    },
  ]

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

            <p className="mt-3 text-xs font-semibold tracking-[0.055em]">
              <span className="uppercase text-white/30">
                Referência
              </span>
              <span className="ml-2 text-white/62">
                {product.sku}
              </span>
            </p>

            {compatibilityPreview && (
              <div className="mt-6 border-l-2 border-brand pl-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">
                  Compatibilidade registada
                </p>

                <p className="mt-2 text-sm font-bold leading-6 text-white/78">
                  {
                    compatibilityPreview.label
                  }
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/36">
                  {compatibilityPreview.years && (
                    <span>
                      {
                        compatibilityPreview.years
                      }
                    </span>
                  )}

                  <a
                    href="#compatibilidade"
                    className="transition hover:text-white"
                  >
                    {compatibilities.length ===
                    1
                      ? 'Ver aplicação'
                      : `Ver ${compatibilities.length} aplicações`}
                  </a>
                </div>
              </div>
            )}

            <div className="mt-7 border-y border-white/8 py-5">
              <div className="flex flex-wrap items-center gap-4">
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

              <div className="mt-4">
                <AddToCartButton
                  productId={product.id}
                  inStock={
                    product.inStock
                  }
                  variant="product"
                />
              </div>
            </div>

            <div className="mt-7 border-t border-white/8 pt-6">
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

        <section
          aria-labelledby="product-information-heading"
          className="mt-14 border-t border-white/8 pt-10 lg:mt-18 lg:pt-12"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            Detalhes
          </p>

          <h2
            id="product-information-heading"
            className="mt-2 text-2xl font-black tracking-[-0.03em]"
          >
            Informação do produto
          </h2>

          <div className="mt-5">
            <ProductInformationAccordion
              items={informationItems}
            />
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section
            aria-labelledby="related-products-heading"
            className="mt-14 border-t border-white/8 pt-10 lg:mt-18 lg:pt-12"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
              Da mesma categoria
            </p>

            <h2
              id="related-products-heading"
              className="mt-2 text-2xl font-black tracking-[-0.03em]"
            >
              Produtos relacionados
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map(
                (relatedProduct) => (
                  <ProductCard
                    key={
                      relatedProduct.id
                    }
                    product={
                      relatedProduct
                    }
                    variant="category"
                  />
                ),
              )}
            </div>
          </section>
        )}
      </div>

      <StorefrontFooter
        categories={footerCategories}
      />
    </main>
  )
}
