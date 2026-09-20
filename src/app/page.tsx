import Link from 'next/link'
import BrandCard from '@/components/storefront/brand-card'
import CategoryCard from '@/components/storefront/category-card'
import EditorialCard from '@/components/storefront/editorial-card'
import ProductCard from '@/components/storefront/product-card'
import {
  getStorefrontCategoryImage,
  isStorefrontCategoryVisible,
} from '@/lib/storefront-category-media'
import {
  listCatalogCategories,
  listCatalogProducts,
  type CatalogCategory,
  type CatalogProduct,
} from '@/server/catalog'

export const dynamic =
  'force-dynamic'

type HomeProps = {
  searchParams: Promise<{
    q?: string | string[]
  }>
}

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1800&q=88'

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

  return 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
}

function brandGridClass(
  count: number,
) {
  if (count === 1) {
    return 'grid max-w-xs grid-cols-1'
  }

  if (count === 2) {
    return 'grid max-w-lg grid-cols-2'
  }

  if (count === 3) {
    return 'grid max-w-2xl grid-cols-3'
  }

  if (count <= 5) {
    return 'grid max-w-4xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
  }

  return 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8'
}

function productGridClass(
  count: number,
) {
  if (count === 1) {
    return 'grid max-w-sm grid-cols-1'
  }

  if (count === 2) {
    return 'grid max-w-3xl gap-px sm:grid-cols-2'
  }

  if (count === 3) {
    return 'grid max-w-5xl gap-px sm:grid-cols-2 lg:grid-cols-3'
  }

  return 'grid gap-px sm:grid-cols-2 lg:grid-cols-4'
}

export default async function Home({
  searchParams,
}: HomeProps) {
  const [{ q }, products, categories] =
    await Promise.all([
      searchParams,
      listCatalogProducts(),
      listCatalogCategories(),
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
    categories.filter(
      isStorefrontCategoryVisible,
    )

  const topLevelCategories =
    commercialCategories.filter(
      (category) =>
        category.parentId === null,
    )

  const storefrontCategories =
    (
      topLevelCategories.length > 0
        ? topLevelCategories
        : commercialCategories
    ).slice(0, 6)

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

  const editorial =
    categoryCards.length >= 2
      ? categoryCards[0]
      : null

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

  const displayedProducts =
    normalizedQuery
      ? visibleProducts
      : products.slice(0, 8)

  return (
    <main className="flex-1 bg-[#0b0d0f] text-white">
      <section className="relative isolate overflow-hidden border-b border-white/7">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-[position:62%_50%] sm:bg-[position:66%_48%]"
          style={{
            backgroundImage: `url("${HERO_IMAGE}")`,
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,9,10,0.98)_0%,rgba(7,9,10,0.9)_30%,rgba(7,9,10,0.48)_58%,rgba(7,9,10,0.16)_100%)]"
        />

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b0d0f]/55 to-transparent"
        />

        <div className="relative mx-auto flex min-h-[21rem] max-w-7xl items-center px-4 py-9 sm:min-h-[23rem] sm:px-6 lg:min-h-[24rem] lg:px-8">
          <div className="max-w-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              Premium aftermarket
            </p>

            <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-5xl lg:text-[3.5rem]">
              Eleva o teu projeto.
              <span className="block text-white/72">
                Sem compromissos.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-6 text-white/62 sm:text-base">
              Styling, performance e
              componentes para quem quer
              mais presença e mais carácter.
            </p>

            <Link
              href="/#categorias"
              className="mt-7 inline-flex items-center rounded-sm bg-brand px-5 py-3 text-[11px] font-black uppercase tracking-[0.09em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Explorar catálogo
              <span className="ml-3">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {categoryCards.length > 0 && (
        <section
          id="categorias"
          aria-labelledby="categories-heading"
          className="scroll-mt-40 border-b border-white/7"
        >
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand">
                Shop by category
              </p>
              <h2
                id="categories-heading"
                className="mt-1.5 text-xl font-black tracking-[-0.025em]"
              >
                Encontra o próximo upgrade
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

      {brands.length > 0 && (
        <section
          id="marcas"
          aria-label="Marcas"
          className="scroll-mt-40 border-b border-white/7 bg-[#0e1012]"
        >
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
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

      {editorial && (
        <section className="border-b border-white/7">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <EditorialCard
              category={
                editorial.category
              }
              image={
                editorial.image
              }
            />
          </div>
        </section>
      )}

      <section
        id="produtos"
        aria-labelledby="products-heading"
        className="scroll-mt-40"
      >
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8 lg:py-11">
          <div className="flex items-end justify-between gap-4 border-b border-white/8 pb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand">
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
                className="text-[10px] font-black uppercase tracking-[0.1em] text-white/45 transition hover:text-brand"
              >
                Limpar pesquisa
              </Link>
            )}
          </div>

          {displayedProducts.length ===
          0 ? (
            <div className="max-w-xl py-12">
              <h3 className="text-lg font-black">
                {normalizedQuery
                  ? 'Nenhum produto encontrado'
                  : 'Ainda não há produtos disponíveis'}
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/42">
                {normalizedQuery
                  ? 'Experimenta outro nome, marca ou categoria.'
                  : 'Estamos a preparar a seleção PFAutoParts. Volta em breve.'}
              </p>
            </div>
          ) : (
            <div
              className={`mt-5 overflow-hidden bg-white/7 ${productGridClass(
                displayedProducts.length,
              )}`}
            >
              {displayedProducts.map(
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

      <section className="border-t border-white/7 bg-[#111315]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand">
              PFAutoParts
            </p>
            <h2 className="mt-1.5 text-xl font-black tracking-tight sm:text-2xl">
              A tua build começa com a escolha certa.
            </h2>
          </div>

          <Link
            href="/#categorias"
            className="inline-flex w-fit border-b border-brand pb-1 text-[10px] font-black uppercase tracking-[0.1em] text-white"
          >
            Explorar categorias
          </Link>
        </div>
      </section>
    </main>
  )
}
