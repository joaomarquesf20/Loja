import Link from 'next/link'
import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import ProductCard from '@/components/storefront/product-card'
import StorefrontFooter from '@/components/storefront/storefront-footer'
import { buildPageMetadata } from '@/app/seo'
import {
  isStorefrontCategoryVisible,
  sortStorefrontCategories,
} from '@/lib/storefront-category-media'
import { getCategoryFilterProfile } from '@/lib/storefront-category-profile'
import {
  getCatalogProductBySlug,
  getCatalogCategoryPageBySlug,
} from '@/server/catalog'
import { getCatalogCategories } from '@/server/catalog-request'
import { listProductCompatibilities } from '@/server/product-compatibilities'
import CompatibilityAnchorLink from './compatibility-anchor-link'
import ProductGallery from './product-gallery'
import {
  ProductImageSelectionProvider,
} from './product-image-selection'
import ProductInformationAccordion from './product-information-accordion'
import ProductPurchasePanel from './product-purchase-panel'

export const dynamic = 'force-dynamic'

type ProductPageProps = {
  params: Promise<{
    slug: string
  }>
}

/**
 * Leitura do produto memoizada por pedido: `generateMetadata` e a
 * página partilham a mesma consulta em vez de duplicarem o fetch.
 */
const getCatalogProductPerRequest = cache(
  getCatalogProductBySlug,
)

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params

  const product =
    await getCatalogProductPerRequest(
      slug,
    )

  if (!product) {
    return {
      title: 'Produto não encontrado',
      robots: { index: false },
    }
  }

  const productDescription =
    product.description?.trim()

  const metadataDescription =
    productDescription &&
    productDescription.length > 0
      ? productDescription.slice(0, 300)
      : `Vê preço, disponibilidade e aplicações de ${product.name} (${product.sku}) na PFAUTOPARTS.`

  return buildPageMetadata({
    title: product.name,
    description: metadataDescription,
    path: `/produtos/${product.slug}`,
    image: product.images[0],
  })
}

type ProductCompatibility =
  Awaited<
    ReturnType<
      typeof listProductCompatibilities
    >
  >[number]

function getFooterCategories(
  categories: Awaited<
    ReturnType<typeof getCatalogCategories>
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

  const configuration =
    compatibility.vehicleConfiguration

  const engineParts = [
    configuration?.engineCode ?? null,
    configuration?.powerKw != null
      ? `${configuration.powerKw} kW`
      : null,
  ].filter(
    (value): value is string =>
      Boolean(value),
  )

  const years = configuration
    ? formatYears(
        configuration.yearFrom,
        configuration.yearTo,
      )
    : null

  return {
    label: parts.join(' · '),
    years,
    engine: engineParts.join(' · ') || null,
    bodyType: configuration?.bodyType ?? null,
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
    await getCatalogProductPerRequest(
      slug,
    )

  if (!product) {
    notFound()
  }

  const profile = getCategoryFilterProfile(
    product.category,
  )

  /**
   * Jantes não têm uma lista de veículos compatível
   * mantida à mão: a adequação vem das especificações
   * das variantes (furação, furo central, diâmetro,
   * largura e offset), por isso a página não mostra
   * aplicações de veículo.
   */
  const showsVehicleCompatibility =
    profile !== 'wheels'

  const [
    categories,
    compatibilities,
    categoryPage,
  ] = await Promise.all([
    getCatalogCategories(),
    showsVehicleCompatibility
      ? listProductCompatibilities(
          product.id,
        )
      : Promise.resolve([]),
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
    ...(profile === 'exterior'
      ? [
          ...new Set(
            product.variants
              .flatMap((variant) =>
                variant.options.filter(
                  (option) =>
                    option.code === 'productType',
                ),
              )
              .map(
                (option) => option.value,
              ),
          ),
        ].map((productType) => ({
          label: 'Tipo de produto',
          value: productType,
        }))
      : []),
  ]

  const informationItems = [
    {
      id: 'descricao',
      title: 'Descrição',
      content: product.description?.trim() ? (
        <p className="whitespace-pre-line text-sm leading-7 text-gray-500">
          {product.description}
        </p>
      ) : (
        <p className="text-sm leading-7 text-gray-400">
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
                className="border-l border-gray-200 pl-4"
              >
                <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  {row.label}
                </dt>
                <dd className="mt-1.5 text-sm font-bold text-gray-700">
                  {row.value}
                </dd>
              </div>
            ),
          )}
        </dl>
      ),
    },
    ...(showsVehicleCompatibility &&
    compatibilities.length > 0
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
                        <p className="text-sm font-bold text-gray-800">
                          {
                            formatted.label
                          }
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-400">
                          {formatted.bodyType && (
                            <span>
                              {
                                formatted.bodyType
                              }
                            </span>
                          )}

                          {formatted.engine && (
                            <span>
                              {
                                formatted.engine
                              }
                            </span>
                          )}

                          {formatted.years && (
                            <span>
                              {
                                formatted.years
                              }
                            </span>
                          )}
                        </div>
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
        <div className="grid gap-3 text-sm leading-7 text-gray-500">
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
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 lg:px-8 lg:pb-20 lg:pt-9">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500"
        >
          <Link
            href="/"
            className="transition hover:text-gray-900"
          >
            Início
          </Link>

          <span aria-hidden="true">
            /
          </span>

          <Link
            href={`/categorias/${product.category.slug}`}
            className="transition hover:text-gray-900"
          >
            {product.category.name}
          </Link>

          <span aria-hidden="true">
            /
          </span>

          <span className="max-w-[18rem] truncate text-gray-600 sm:max-w-md">
            {product.name}
          </span>
        </nav>

        <ProductImageSelectionProvider>
          <article className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:gap-14 xl:gap-16">
            <ProductGallery
              name={product.name}
              images={product.images}
              imageMetadata={product.imageMetadata}
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
                className="text-gray-400 transition hover:text-gray-900"
              >
                {product.category.name}
              </Link>
            </div>

            <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl lg:text-[2.7rem]">
              {product.name}
            </h1>

            <p className="mt-3 text-xs font-semibold tracking-[0.055em]">
              <span className="uppercase text-gray-400">
                Referência
              </span>
              <span className="ml-2 text-gray-500">
                {product.sku}
              </span>
            </p>

            {compatibilityPreview && (
              <div className="mt-6 border-l-2 border-brand pl-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">
                  Compatibilidade registada
                </p>

                <p className="mt-2 text-sm font-bold leading-6 text-gray-800">
                  {
                    compatibilityPreview.label
                  }
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-400">
                  {compatibilityPreview.years && (
                    <span>
                      {
                        compatibilityPreview.years
                      }
                    </span>
                  )}

                  <CompatibilityAnchorLink
                    targetId="compatibilidade"
                    applicationsCount={
                      compatibilities.length
                    }
                  />
                </div>
              </div>
            )}

            <div className="mt-7 border-y border-gray-200 py-5">
              <ProductPurchasePanel
                product={product}
              />

              {profile === 'wheels' &&
                product.variants.some(
                  (variant) =>
                    variant.options.length > 0,
                ) && (
                  <p className="mt-4 text-xs leading-5 text-gray-400">
                    A adequação ao teu veículo é
                    definida pelas
                    especificações da variante
                    selecionada (furação, furo
                    central, diâmetro, largura e
                    offset).
                  </p>
                )}
            </div>

            <div className="mt-7 border-t border-gray-200 pt-6">
              <Link
                href={`/categorias/${product.category.slug}`}
                className="inline-flex items-center border-b border-gray-300 pb-1 text-[10px] font-black uppercase tracking-[0.1em] text-gray-500 transition hover:border-brand hover:text-gray-900"
              >
                Ver mais em{' '}
                {product.category.name}
              </Link>
            </div>
          </section>
          </article>
        </ProductImageSelectionProvider>

        <section
          aria-labelledby="product-information-heading"
          className="mt-14 border-t border-gray-200 pt-10 lg:mt-18 lg:pt-12"
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
            className="mt-14 border-t border-gray-200 pt-10 lg:mt-18 lg:pt-12"
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
