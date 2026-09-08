import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'
import {
  getCatalogCategoryPageBySlug,
  type CatalogSort,
} from '@/server/catalog'
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
        .filter((item) => item.length > 0),
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

  const normalizedValue =
    rawValue.replace(',', '.')

  const parsedValue =
    Number(normalizedValue)

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

  if (rawValue === 'name-desc') {
    return 'name-desc'
  }

  if (rawValue === 'price-asc') {
    return 'price-asc'
  }

  if (rawValue === 'price-desc') {
    return 'price-desc'
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

  if (
    filters.vehicleConfigurationId
  ) {
    params.set(
      'vehicle',
      filters.vehicleConfigurationId,
    )
  }

  if (
    filters.sort &&
    filters.sort !== 'name-asc'
  ) {
    params.set(
      'sort',
      filters.sort,
    )
  }

  const query = params.toString()

  return query
    ? `/categorias/${categorySlug}?${query}`
    : `/categorias/${categorySlug}`
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

  const result =
    await getCatalogCategoryPageBySlug(
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
    )

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

  const clearFiltersHref =
    buildCategoryHref(
      category.slug,
      {
        inStockOnly: false,
        brandSlugs: [],
        sort,
      },
    )

  const stockFilterHref =
    buildCategoryHref(
      category.slug,
      {
        inStockOnly: !inStockOnly,
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
          <div className="flex flex-wrap items-start justify-between gap-4">
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

            {hasActiveFilters && (
              <Link
                href={clearFiltersHref}
                className="text-sm font-medium underline underline-offset-4"
              >
                Limpar filtros
              </Link>
            )}
          </div>

          <VehicleFilter
            key={
              selectedVehicleConfigurationId ??
              'no-vehicle'
            }
            categorySlug={category.slug}
            configurations={
              vehicleConfigurations
            }
            selectedConfigurationId={
              selectedVehicleConfigurationId
            }
          />

          <div className="mt-5 border-t pt-5">
            <h3 className="text-sm font-semibold">
              Disponibilidade
            </h3>

            <div className="mt-2 flex flex-wrap gap-2">
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
          </div>

          {brands.length > 0 && (
            <div className="mt-5 border-t pt-5">
              <h3 className="text-sm font-semibold">
                Marca do produto
              </h3>

              <div className="mt-2 flex flex-wrap gap-2">
                {brands.map((brand) => {
                  const isSelected =
                    selectedBrandSlugs.includes(
                      brand.slug,
                    )

                  const nextBrandSlugs =
                    isSelected
                      ? selectedBrandSlugs.filter(
                          (selectedSlug) =>
                            selectedSlug !==
                            brand.slug,
                        )
                      : [
                          ...selectedBrandSlugs,
                          brand.slug,
                        ]

                  const href =
                    buildCategoryHref(
                      category.slug,
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
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border-foreground bg-foreground text-background'
                          : 'hover:border-neutral-500'
                      }`}
                    >
                      {isSelected
                        ? `✓ ${brand.name}`
                        : brand.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">
                Preço
              </h3>

              {hasPriceFilter && (
                <Link
                  href={removePriceHref}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  Remover preço
                </Link>
              )}
            </div>

            <form
              action={`/categorias/${category.slug}`}
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

              <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                <label className="block">
                  <span className="text-sm font-medium">
                    Preço mínimo (€)
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
                    placeholder="0,00"
                    className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">
                    Preço máximo (€)
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
                    placeholder="Sem limite"
                    className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="mt-3 rounded-md border px-4 py-2 text-sm font-medium transition hover:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
              >
                Aplicar preço
              </button>
            </form>
          </div>

          <div className="mt-5 border-t pt-5">
            <h3 className="text-sm font-semibold">
              Ordenação
            </h3>

            <form
              action={`/categorias/${category.slug}`}
              method="get"
              className="mt-3 flex flex-wrap items-end gap-3"
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

              {priceMin !== undefined && (
                <input
                  type="hidden"
                  name="priceMin"
                  value={priceMin}
                />
              )}

              {priceMax !== undefined && (
                <input
                  type="hidden"
                  name="priceMax"
                  value={priceMax}
                />
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

              <label className="block">
                <span className="text-sm font-medium">
                  Ordenar produtos por
                </span>

                <select
                  name="sort"
                  defaultValue={sort ?? ''}
                  className="mt-1 block min-w-60 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground"
                >
                  <option value="">
                    Nome: A–Z
                  </option>

                  <option value="name-desc">
                    Nome: Z–A
                  </option>

                  <option value="price-asc">
                    Preço: menor primeiro
                  </option>

                  <option value="price-desc">
                    Preço: maior primeiro
                  </option>
                </select>
              </label>

              <button
                type="submit"
                className="rounded-md border px-4 py-2 text-sm font-medium transition hover:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
              >
                Ordenar
              </button>
            </form>
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

              {hasActiveFilters && (
                <Link
                  href={clearFiltersHref}
                  className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
                >
                  Limpar filtros
                </Link>
              )}
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