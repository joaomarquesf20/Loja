import Link from 'next/link'
import type { Metadata } from 'next'
import BrandCard from '@/components/storefront/brand-card'
import CategoryCard from '@/components/storefront/category-card'
import ProductCard from '@/components/storefront/product-card'
import StorefrontFooter from '@/components/storefront/storefront-footer'
import {
  getStorefrontCategoryImage,
  isStorefrontCategoryVisible,
  sortStorefrontCategories,
} from '@/lib/storefront-category-media'
import {
  listCatalogProducts,
  type CatalogCategory,
  type CatalogProduct,
} from '@/server/catalog'
import { getCatalogCategories } from '@/server/catalog-request'
import { buildPageMetadata } from './seo'

export const dynamic =
  'force-dynamic'

type HomeProps = {
  searchParams: Promise<{
    q?: string | string[]
  }>
}

/**
 * Imagem de contexto para os cartões Open Graph/Twitter: a home
 * já não apresenta hero visual (design técnico de catálogo), mas
 * o preview social mantém uma imagem automóvel representativa.
 */
const OG_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1800&q=88'

export const metadata: Metadata = buildPageMetadata(
  {
    title:
      'PFAUTOPARTS — Jantes, suspensões e body-kits',
    description:
      'Jantes premium, suspensões, body-kits e personalização automóvel, com pesquisa por veículo e stock em tempo real.',
    path: '/',
    image: OG_FALLBACK_IMAGE,
    absoluteTitle: true,
  },
)

function firstProductImage(
  products: CatalogProduct[],
) {
  return products
    .flatMap(
      (product) => product.images,
    )
    .find(Boolean)
}

function getCategoryImage(
  category: CatalogCategory,
  products: CatalogProduct[],
) {
  const curatedImage =
    getStorefrontCategoryImage(
      category,
    )

  if (curatedImage) {
    return curatedImage
  }

  return (
    firstProductImage(
      products.filter(
        (product) =>
          product.category.id ===
          category.id,
      ),
    ) ?? null
  )
}

function normalizeSearchQuery(
  rawQuery: string | string[] | undefined,
) {
  const value = Array.isArray(rawQuery)
    ? rawQuery[0]
    : rawQuery

  return value?.trim().toLocaleLowerCase(
    'pt-PT',
  ) ?? ''
}

function matchesSearch(
  product: CatalogProduct,
  query: string,
) {
  if (!query) {
    return true
  }

  return [
    product.name,
    product.brand?.name ?? '',
    product.category.name,
  ].some((value) =>
    value
      .toLocaleLowerCase('pt-PT')
      .includes(query),
  )
}

/**
 * Grelhas compactas e densas: as categorias e os produtos
 * preenchem a largura em mosaicos uniformes, com pequenos
 * ajustes de largura máxima para contagens baixas.
 */
function categoryGridClass(
  count: number,
) {
  if (count === 1) {
    return 'grid max-w-md grid-cols-1 gap-3'
  }

  if (count === 2) {
    return 'grid max-w-3xl gap-3 sm:grid-cols-2'
  }

  if (count === 3) {
    return 'grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3'
  }

  return 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
}

function brandGridClass(
  count: number,
) {
  if (count === 1) {
    return 'grid max-w-xs grid-cols-1 gap-2'
  }

  if (count === 2) {
    return 'grid max-w-lg grid-cols-2 gap-2'
  }

  if (count === 3) {
    return 'grid max-w-2xl grid-cols-3 gap-2'
  }

  if (count <= 5) {
    return 'grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'
  }

  return 'grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8'
}

function productGridClass(
  count: number,
) {
  if (count === 1) {
    return 'grid max-w-sm grid-cols-1'
  }

  if (count === 2) {
    return 'grid max-w-3xl gap-4 sm:grid-cols-2'
  }

  if (count === 3) {
    return 'grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3'
  }

  return 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
}

export default async function Home({
  searchParams,
}: HomeProps) {
  const [{ q }, products, categories] =
    await Promise.all([
      searchParams,
      listCatalogProducts(),
      getCatalogCategories(),
    ])

  const normalizedQuery =
    normalizeSearchQuery(q)

  const visibleProducts =
    products.filter((product) =>
      matchesSearch(
        product,
        normalizedQuery,
      ),
    )

  const commercialCategories =
    sortStorefrontCategories(
      categories.filter(
        isStorefrontCategoryVisible,
      ),
    )

  const topLevelCategories =
    commercialCategories.filter(
      (category) =>
        category.parentId === null,
    )

  /**
   * Grelha de categorias robusta: até 8 mosaicos (todas as
   * categorias de topo comerciais) em vez de um bloco pequeno.
   */
  const storefrontCategories =
    (
      topLevelCategories.length > 0
        ? topLevelCategories
        : commercialCategories
    ).slice(0, 8)

  const categoryCards =
    storefrontCategories.map(
      (category) => ({
        category,
        image: getCategoryImage(
          category,
          products,
        ),
      }),
    )

  const brandsById = new Map<
    string,
    NonNullable<
      CatalogProduct['brand']
    >
  >()

  for (const product of products) {
    if (product.brand) {
      brandsById.set(
        product.brand.id,
        product.brand,
      )
    }
  }

  const brands = Array.from(
    brandsById.values(),
  )
    .sort((first, second) =>
      first.name.localeCompare(
        second.name,
      ),
    )
    .slice(0, 8)

  /**
   * Grelha compacta única: com pesquisa mostra os resultados;
   * sem pesquisa, as novidades do catálogo (8 destaques densos).
   */
  const featuredProducts =
    normalizedQuery
      ? visibleProducts.slice(0, 8)
      : products.slice(0, 8)

  const footerCategories =
    storefrontCategories.slice(0, 4)

  return (
    <main className="flex-1 bg-gray-50 text-gray-900">
      {categoryCards.length > 0 && (
        <section
          id="categorias"
          aria-labelledby="categories-heading"
          className="scroll-mt-36 border-b border-gray-200 bg-white"
        >
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                Comprar por categoria
              </p>

              <h2
                id="categories-heading"
                className="mt-1.5 text-xl font-black tracking-[-0.025em] sm:text-2xl"
              >
                Peças por categoria
              </h2>
            </div>

            <div
              className={
                categoryGridClass(
                  categoryCards.length,
                )
              }
            >
              {categoryCards.map(
                ({
                  category,
                  image,
                }) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    image={image}
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
        className="scroll-mt-36"
      >
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8 lg:py-12">
          <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                {normalizedQuery
                  ? 'Pesquisa'
                  : 'Seleção PFAutoParts'}
              </p>

              <h2
                id="products-heading"
                className="mt-1.5 text-xl font-black tracking-[-0.025em] sm:text-2xl"
              >
                {normalizedQuery
                  ? 'Resultados encontrados'
                  : 'Produtos em destaque'}
              </h2>
            </div>

            {normalizedQuery && (
              <Link
                href="/#produtos"
                className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-500 transition hover:text-brand"
              >
                Limpar pesquisa
              </Link>
            )}
          </div>

          {featuredProducts.length ===
          0 ? (
            <div className="max-w-xl py-12">
              <h3 className="text-lg font-black">
                {normalizedQuery
                  ? 'Nenhum produto encontrado'
                  : 'Ainda não há produtos disponíveis'}
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                {normalizedQuery
                  ? 'Experimenta outro nome, marca ou categoria.'
                  : 'Estamos a preparar a seleção PFAutoParts. Volta em breve.'}
              </p>
            </div>
          ) : (
            <div
              className={`mt-6 ${productGridClass(
                featuredProducts.length,
              )}`}
            >
              {featuredProducts.map(
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

      {brands.length > 0 && (
        <section
          id="marcas"
          aria-label="Marcas"
          className="scroll-mt-36 border-t border-gray-200 bg-white"
        >
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                Marcas
              </p>

              <h2 className="mt-1.5 text-lg font-black tracking-[-0.02em] sm:text-xl">
                Procura por marca
              </h2>
            </div>

            <div
              className={
                brandGridClass(
                  brands.length,
                )
              }
            >
              {brands.map((brand) => (
                <BrandCard
                  key={brand.id}
                  name={brand.name}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <StorefrontFooter
        categories={
          footerCategories
        }
      />
    </main>
  )
}
