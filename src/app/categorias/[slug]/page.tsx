import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'
import ProductCard from '@/components/storefront/product-card'
import StorefrontFooter from '@/components/storefront/storefront-footer'
import {
  isStorefrontCategoryVisible,
  sortStorefrontCategories,
} from '@/lib/storefront-category-media'
import {
  getCatalogCategoryPageBySlug,
  listCatalogCategories,
  type CatalogBrand,
  type CatalogSort,
  type CatalogVehicleConfiguration,
} from '@/server/catalog'
import CategorySortControl from './category-sort-control'
import MobileFilterDrawer from './mobile-filter-drawer'
import VehicleFilter from './vehicle-filter'

export const dynamic = 'force-dynamic'

type CategoryPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    stock?: string | string[]
    brand?: string | string[]
    priceMin?: string | string[]
    priceMax?: string | string[]
    vehicle?: string | string[]
    sort?: string | string[]
  }>
}

type CategoryFilterState = {
  inStockOnly: boolean
  brandSlugs: string[]
  priceMin?: number
  priceMax?: number
  vehicleConfigurationId?: string
  sort?: CatalogSort
}

type FilterPanelProps = {
  categorySlug: string
  brands: CatalogBrand[]
  vehicleConfigurations:
    CatalogVehicleConfiguration[]
  selectedVehicleConfigurationId?:
    string
  selectedBrandSlugs: string[]
  inStockOnly: boolean
  priceMin?: number
  priceMax?: number
  sort?: CatalogSort
}

function getSearchParamValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value
}

function getSearchParamValues(
  value: string | string[] | undefined,
) {
  const values =
    value === undefined
      ? []
      : Array.isArray(value)
        ? value
        : [value]

  return Array.from(
    new Set(
      values
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function parsePriceParam(
  value: string | string[] | undefined,
) {
  const rawValue =
    getSearchParamValue(value)?.trim()

  if (!rawValue) {
    return undefined
  }

  const parsedValue = Number(
    rawValue.replace(',', '.'),
  )

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0
  ) {
    return undefined
  }

  return parsedValue
}

function parseVehicleParam(
  value: string | string[] | undefined,
) {
  const rawValue =
    getSearchParamValue(value)?.trim()

  return rawValue || undefined
}

function parseSortParam(
  value: string | string[] | undefined,
): CatalogSort | undefined {
  const rawValue =
    getSearchParamValue(value)?.trim()

  if (
    rawValue === 'name-desc' ||
    rawValue === 'price-asc' ||
    rawValue === 'price-desc'
  ) {
    return rawValue
  }

  return undefined
}

function buildCategoryHref(
  categorySlug: string,
  filters: CategoryFilterState,
) {
  const params = new URLSearchParams()

  if (filters.inStockOnly) {
    params.set('stock', 'available')
  }

  for (const brandSlug of filters.brandSlugs) {
    params.append('brand', brandSlug)
  }

  if (filters.priceMin !== undefined) {
    params.set(
      'priceMin',
      String(filters.priceMin),
    )
  }

  if (filters.priceMax !== undefined) {
    params.set(
      'priceMax',
      String(filters.priceMax),
    )
  }

  if (filters.vehicleConfigurationId) {
    params.set(
      'vehicle',
      filters.vehicleConfigurationId,
    )
  }

  if (
    filters.sort &&
    filters.sort !== 'name-asc'
  ) {
    params.set('sort', filters.sort)
  }

  const query = params.toString()

  return query
    ? `/categorias/${categorySlug}?${query}`
    : `/categorias/${categorySlug}`
}

function formatPrice(value: number) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    },
  ).format(value)
}

function getCategorySupportCopy(
  name: string,
  slug: string,
) {
  const value =
    `${name} ${slug}`.toLocaleLowerCase(
      'pt-PT',
    )

  if (
    value.includes('jante') ||
    value.includes('wheel') ||
    value.includes('rim')
  ) {
    return 'Encontra a configuração certa para dar outra presença ao teu projeto.'
  }

  if (
    value.includes('suspens') ||
    value.includes('coilover')
  ) {
    return 'Afina a postura e o comportamento do teu projeto com a solução certa.'
  }

  if (
    value.includes('exterior') ||
    value.includes('body-kit') ||
    value.includes('bodykit')
  ) {
    return 'Define as linhas do teu projeto com componentes de exterior escolhidos para marcar presença.'
  }

  return 'Explora os produtos disponíveis e encontra a próxima peça para o teu projeto.'
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

function FilterPanel({
  categorySlug,
  brands,
  vehicleConfigurations,
  selectedVehicleConfigurationId,
  selectedBrandSlugs,
  inStockOnly,
  priceMin,
  priceMax,
  sort,
}: FilterPanelProps) {
  const stockHref = buildCategoryHref(
    categorySlug,
    {
      inStockOnly: !inStockOnly,
      brandSlugs: selectedBrandSlugs,
      priceMin,
      priceMax,
      vehicleConfigurationId:
        selectedVehicleConfigurationId,
      sort,
    },
  )

  const hasPriceFilter =
    priceMin !== undefined ||
    priceMax !== undefined

  const removePriceHref =
    buildCategoryHref(
      categorySlug,
      {
        inStockOnly,
        brandSlugs:
          selectedBrandSlugs,
        vehicleConfigurationId:
          selectedVehicleConfigurationId,
        sort,
      },
    )

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">
          Disponibilidade
        </h3>

        <Link
          href={stockHref}
          className="mt-3 flex items-center justify-between gap-3 rounded-sm py-1.5 text-sm font-semibold text-white/66 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span>Em stock</span>
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full border ${inStockOnly
              ? 'border-brand bg-brand'
              : 'border-white/24'}`}
          />
        </Link>
      </section>

      {brands.length > 0 && (
        <section className="border-t border-white/8 pt-5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">
            Marca
          </h3>

          <div className="mt-3 grid gap-1">
            {brands.map((brand) => {
              const isSelected =
                selectedBrandSlugs.includes(
                  brand.slug,
                )

              const nextBrandSlugs =
                isSelected
                  ? selectedBrandSlugs.filter(
                      (slug) =>
                        slug !==
                        brand.slug,
                    )
                  : [
                      ...selectedBrandSlugs,
                      brand.slug,
                    ]

              const href =
                buildCategoryHref(
                  categorySlug,
                  {
                    inStockOnly,
                    brandSlugs:
                      nextBrandSlugs,
                    priceMin,
                    priceMax,
                    vehicleConfigurationId:
                      selectedVehicleConfigurationId,
                    sort,
                  },
                )

              return (
                <Link
                  key={brand.id}
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-sm py-1.5 text-sm font-semibold text-white/62 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span>{brand.name}</span>
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rounded-full border ${isSelected
                      ? 'border-brand bg-brand'
                      : 'border-white/24'}`}
                  />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="border-t border-white/8 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">
            Preço
          </h3>

          {hasPriceFilter && (
            <Link
              href={removePriceHref}
              className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/34 transition hover:text-white"
            >
              Limpar
            </Link>
          )}
        </div>

        <form
          action={`/categorias/${categorySlug}`}
          method="get"
          className="mt-3"
        >
          {inStockOnly && (
            <input
              type="hidden"
              name="stock"
              value="available"
            />
          )}

          {selectedBrandSlugs.map(
            (brandSlug) => (
              <input
                key={brandSlug}
                type="hidden"
                name="brand"
                value={brandSlug}
              />
            ),
          )}

          {selectedVehicleConfigurationId && (
            <input
              type="hidden"
              name="vehicle"
              value={
                selectedVehicleConfigurationId
              }
            />
          )}

          {sort && (
            <input
              type="hidden"
              name="sort"
              value={sort}
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="sr-only">
                Preço mínimo
              </span>
              <input
                type="number"
                name="priceMin"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={
                  priceMin ?? ''
                }
                placeholder="Mín. €"
                className="h-10 w-full rounded-sm border border-white/10 bg-[#15181b] px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-brand/60"
              />
            </label>

            <label>
              <span className="sr-only">
                Preço máximo
              </span>
              <input
                type="number"
                name="priceMax"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={
                  priceMax ?? ''
                }
                placeholder="Máx. €"
                className="h-10 w-full rounded-sm border border-white/10 bg-[#15181b] px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-brand/60"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-2.5 w-full rounded-sm border border-white/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/62 transition hover:border-white/24 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Aplicar preço
          </button>
        </form>
      </section>

      {vehicleConfigurations.length >
        0 && (
        <VehicleFilter
          key={
            selectedVehicleConfigurationId ??
            'no-vehicle'
          }
          categorySlug={categorySlug}
          configurations={
            vehicleConfigurations
          }
          selectedConfigurationId={
            selectedVehicleConfigurationId
          }
        />
      )}
    </div>
  )
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const [{ slug }, query] =
    await Promise.all([
      params,
      searchParams,
    ])

  const inStockOnly =
    getSearchParamValue(query.stock) ===
    'available'

  const selectedBrandSlugs =
    getSearchParamValues(query.brand)

  const parsedPriceMin =
    parsePriceParam(query.priceMin)

  const parsedPriceMax =
    parsePriceParam(query.priceMax)

  const priceRangeIsInverted =
    parsedPriceMin !== undefined &&
    parsedPriceMax !== undefined &&
    parsedPriceMin > parsedPriceMax

  const priceMin =
    priceRangeIsInverted
      ? undefined
      : parsedPriceMin

  const priceMax =
    priceRangeIsInverted
      ? undefined
      : parsedPriceMax

  const requestedVehicleConfigurationId =
    parseVehicleParam(query.vehicle)

  const sort =
    parseSortParam(query.sort)

  const hasInvalidPriceParams =
    (query.priceMin !== undefined &&
      parsedPriceMin === undefined) ||
    (query.priceMax !== undefined &&
      parsedPriceMax === undefined) ||
    priceRangeIsInverted

  const shouldCanonicalizeSort =
    query.sort !== undefined &&
    sort === undefined

  const [result, allCategories] =
    await Promise.all([
      getCatalogCategoryPageBySlug(
        slug,
        {
          inStockOnly,
          brandSlugs:
            selectedBrandSlugs,
          priceMin,
          priceMax,
          vehicleConfigurationId:
            requestedVehicleConfigurationId,
          sort,
        },
      ),
      listCatalogCategories(),
    ])

  if (!result) {
    notFound()
  }

  const {
    category,
    brands,
    vehicleConfigurations,
    products,
  } = result

  const selectedVehicleConfiguration =
    requestedVehicleConfigurationId
      ? vehicleConfigurations.find(
          (configuration) =>
            configuration.id ===
            requestedVehicleConfigurationId,
        )
      : undefined

  const hasInvalidVehicleParam =
    query.vehicle !== undefined &&
    !selectedVehicleConfiguration

  const selectedVehicleConfigurationId =
    selectedVehicleConfiguration?.id

  if (
    hasInvalidPriceParams ||
    hasInvalidVehicleParam ||
    shouldCanonicalizeSort
  ) {
    redirect(
      buildCategoryHref(
        category.slug,
        {
          inStockOnly,
          brandSlugs:
            selectedBrandSlugs,
          priceMin,
          priceMax,
          vehicleConfigurationId:
            selectedVehicleConfigurationId,
          sort,
        },
      ),
    )
  }

  const hasPriceFilter =
    priceMin !== undefined ||
    priceMax !== undefined

  const hasVehicleFilter =
    selectedVehicleConfigurationId !==
    undefined

  const hasActiveFilters =
    inStockOnly ||
    selectedBrandSlugs.length > 0 ||
    hasPriceFilter ||
    hasVehicleFilter

  const activeFilterCount =
    Number(inStockOnly) +
    selectedBrandSlugs.length +
    Number(hasPriceFilter) +
    Number(hasVehicleFilter)

  const clearFiltersHref =
    buildCategoryHref(
      category.slug,
      {
        inStockOnly: false,
        brandSlugs: [],
        sort,
      },
    )

  const removeStockHref =
    buildCategoryHref(
      category.slug,
      {
        inStockOnly: false,
        brandSlugs:
          selectedBrandSlugs,
        priceMin,
        priceMax,
        vehicleConfigurationId:
          selectedVehicleConfigurationId,
        sort,
      },
    )

  const removePriceHref =
    buildCategoryHref(
      category.slug,
      {
        inStockOnly,
        brandSlugs:
          selectedBrandSlugs,
        vehicleConfigurationId:
          selectedVehicleConfigurationId,
        sort,
      },
    )

  const removeVehicleHref =
    buildCategoryHref(
      category.slug,
      {
        inStockOnly,
        brandSlugs:
          selectedBrandSlugs,
        priceMin,
        priceMax,
        sort,
      },
    )

  const supportCopy =
    category.description?.trim() ||
    getCategorySupportCopy(
      category.name,
      category.slug,
    )

  const footerCategories =
    getFooterCategories(allCategories)

  return (
    <main className="min-h-screen bg-[#0b0d0f] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 lg:px-8 lg:pb-20 lg:pt-9">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-semibold text-white/38"
        >
          <Link
            href="/"
            className="transition hover:text-white"
          >
            Início
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-white/66">
            {category.name}
          </span>
        </nav>

        <header className="max-w-3xl pb-9 pt-7 lg:pb-12 lg:pt-9">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            Catálogo PFAutoParts
          </p>

          <h1 className="mt-2.5 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            {category.name}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/54 sm:text-base">
            {supportCopy}
          </p>
        </header>

        <div className="border-y border-white/8 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white/54">
              <span className="text-white">
                {products.length}
              </span>{' '}
              {products.length === 1
                ? 'resultado'
                : 'resultados'}
            </p>

            <div className="flex items-center gap-2">
              <MobileFilterDrawer
                activeCount={
                  activeFilterCount
                }
              >
                <FilterPanel
                  categorySlug={
                    category.slug
                  }
                  brands={brands}
                  vehicleConfigurations={
                    vehicleConfigurations
                  }
                  selectedVehicleConfigurationId={
                    selectedVehicleConfigurationId
                  }
                  selectedBrandSlugs={
                    selectedBrandSlugs
                  }
                  inStockOnly={
                    inStockOnly
                  }
                  priceMin={priceMin}
                  priceMax={priceMax}
                  sort={sort}
                />
              </MobileFilterDrawer>

              <CategorySortControl
                categorySlug={
                  category.slug
                }
                value={sort}
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 py-4">
            {inStockOnly && (
              <Link
                href={removeStockHref}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
              >
                Em stock
                <span aria-hidden="true">
                  ×
                </span>
              </Link>
            )}

            {selectedBrandSlugs.map(
              (brandSlug) => {
                const brand =
                  brands.find(
                    (item) =>
                      item.slug ===
                      brandSlug,
                  )

                if (!brand) {
                  return null
                }

                const href =
                  buildCategoryHref(
                    category.slug,
                    {
                      inStockOnly,
                      brandSlugs:
                        selectedBrandSlugs.filter(
                          (slug) =>
                            slug !==
                            brandSlug,
                        ),
                      priceMin,
                      priceMax,
                      vehicleConfigurationId:
                        selectedVehicleConfigurationId,
                      sort,
                    },
                  )

                return (
                  <Link
                    key={brand.id}
                    href={href}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    {brand.name}
                    <span aria-hidden="true">
                      ×
                    </span>
                  </Link>
                )
              },
            )}

            {hasPriceFilter && (
              <Link
                href={removePriceHref}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
              >
                {priceMin !== undefined &&
                priceMax !== undefined
                  ? `${formatPrice(priceMin)} – ${formatPrice(priceMax)}`
                  : priceMin !== undefined
                    ? `Desde ${formatPrice(priceMin)}`
                    : `Até ${formatPrice(priceMax ?? 0)}`}
                <span aria-hidden="true">
                  ×
                </span>
              </Link>
            )}

            {selectedVehicleConfiguration && (
              <Link
                href={removeVehicleHref}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
              >
                {
                  selectedVehicleConfiguration
                    .generation.model.brand
                    .name
                }{' '}
                {
                  selectedVehicleConfiguration
                    .generation.model.name
                }
                <span aria-hidden="true">
                  ×
                </span>
              </Link>
            )}

            <Link
              href={clearFiltersHref}
              className="ml-1 text-[10px] font-black uppercase tracking-[0.09em] text-white/38 transition hover:text-brand"
            >
              Limpar filtros
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-12">
          <aside
            aria-label="Filtros de produtos"
            className="hidden lg:block"
          >
            <div className="sticky top-36">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.12em]">
                  Filtros
                </h2>

                {hasActiveFilters && (
                  <Link
                    href={
                      clearFiltersHref
                    }
                    className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/34 transition hover:text-brand"
                  >
                    Limpar
                  </Link>
                )}
              </div>

              <FilterPanel
                categorySlug={
                  category.slug
                }
                brands={brands}
                vehicleConfigurations={
                  vehicleConfigurations
                }
                selectedVehicleConfigurationId={
                  selectedVehicleConfigurationId
                }
                selectedBrandSlugs={
                  selectedBrandSlugs
                }
                inStockOnly={
                  inStockOnly
                }
                priceMin={priceMin}
                priceMax={priceMax}
                sort={sort}
              />
            </div>
          </aside>

          <section
            aria-labelledby="products-heading"
            className="min-w-0"
          >
            <h2
              id="products-heading"
              className="sr-only"
            >
              Produtos
            </h2>

            {products.length === 0 ? (
              <div className="border border-white/8 bg-[#111315] px-6 py-12 sm:px-8">
                <p className="text-xl font-black tracking-tight">
                  Nenhum produto encontrado
                </p>

                <p className="mt-2 max-w-lg text-sm leading-6 text-white/46">
                  Não existem produtos que
                  correspondam aos filtros
                  selecionados. Remove um ou
                  mais filtros para voltares
                  a ver esta categoria.
                </p>

                {hasActiveFilters && (
                  <Link
                    href={clearFiltersHref}
                    className="mt-6 inline-flex rounded-sm bg-brand px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Remover filtros
                  </Link>
                )}
              </div>
            ) : (
              <div
                className={`grid gap-5 sm:grid-cols-2 ${products.length === 1
                  ? 'max-w-md'
                  : products.length === 2
                    ? 'max-w-3xl'
                    : 'xl:grid-cols-3'}`}
              >
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
          </section>
        </div>
      </div>

      <StorefrontFooter
        categories={footerCategories}
      />
    </main>
  )
}
