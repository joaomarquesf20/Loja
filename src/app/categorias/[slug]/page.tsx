import Link from 'next/link'
import type { Metadata } from 'next'
import {
  notFound,
  redirect,
} from 'next/navigation'
import ProductCard from '@/components/storefront/product-card'
import StorefrontFooter from '@/components/storefront/storefront-footer'
import { buildPageMetadata } from '@/app/seo'
import {
  isStorefrontCategoryVisible,
  sortStorefrontCategories,
} from '@/lib/storefront-category-media'
import {
  getCatalogCategoryFacetsBySlug,
  getCatalogCategoryPageBySlug,
  type CatalogBrandFacet,
  type CatalogCategoryFacets,
  type CatalogVehicleMakeFacet,
} from '@/server/catalog'
import { getCatalogCategories } from '@/server/catalog-request'
import CategorySortControl from './category-sort-control'
import {
  getBrandFilterLabel,
  getCategoryFilterProfile,
  getVisibleVariantFacets,
  shouldShowVehicleFilter,
  shouldShowVehicleGenerations,
} from '@/lib/storefront-category-profile'
import {
  buildCategoryHref,
  getSearchParamValue,
  getSearchParamValues,
  getSelectedVariantValues,
  getVisibleVehicleGenerations,
  getVisibleVehicleModels,
  hasSameVehicleSelections,
  normalizeBrandSlugs,
  normalizeVehicleSelections,
  parsePriceParam,
  parseSortParam,
  parseVariantSelections,
  removeVariantValue,
  VARIANT_FILTER_PREFIX,
  toggleId,
  toggleVariantSelection,
  type CategoryFilterState,
} from './category-filter-query'
import FilterGroup, {
  type FilterGroupOption,
} from './filter-group'
import MobileFilterDrawer from './mobile-filter-drawer'

export const dynamic = 'force-dynamic'

/**
 * Metadados pela categoria base (sem filtros): o canonical da URL
 * filtrada aponta para a categoria limpa e a leitura usa a mesma
 * leitura memoizada por request da página (uma consulta ao total).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    slug: string
  }>
}): Promise<Metadata> {
  const { slug } = await params

  const categories =
    await getCatalogCategories()

  const category = categories.find(
    (item) => item.slug === slug,
  )

  if (!category) {
    return {
      title: 'Categoria não encontrada',
      robots: { index: false },
    }
  }

  const categoryDescription =
    category.description?.trim() ||
    getCategorySupportCopy(
      category.name,
      category.slug,
    )

  return buildPageMetadata({
    title: category.name,
    description: categoryDescription,
    path: `/categorias/${category.slug}`,
  })
}

type CategoryPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    stock?: string | string[]
    brand?: string | string[]
    priceMin?: string | string[]
    priceMax?: string | string[]
    make?: string | string[]
    model?: string | string[]
    generation?: string | string[]
    sort?: string | string[]
    [key: string]: string | string[] | undefined
  }>
}

function formatPrice(value: number) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
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

function buildBrandOptions({
  brands,
  filters,
  categorySlug,
}: {
  brands: CatalogBrandFacet[]
  filters: CategoryFilterState
  categorySlug: string
}): FilterGroupOption[] {
  return brands.map((brand) => {
    const selected =
      filters.brandSlugs.includes(brand.slug)

    return {
      key: brand.id,
      label: brand.name,
      productCount: brand.productCount,
      selected,
      href: buildCategoryHref(
        categorySlug,
        filters,
        {
          brandSlugs: toggleId(
            filters.brandSlugs,
            brand.slug,
          ),
        },
      ),
    }
  })
}

function buildVehicleOptions({
  makes,
  models,
  generations,
  filters,
  categorySlug,
  showModels,
  showGenerations,
}: {
  makes: CatalogVehicleMakeFacet[]
  models: Array<{
    id: string
    name: string
    makeId: string
    makeName: string
    productCount: number
    generations: Array<{
      id: string
      name: string
    }>
  }>
  generations: Array<{
    id: string
    name: string
    modelId: string
    modelName: string
    makeName: string
    productCount: number
  }>
  filters: CategoryFilterState
  categorySlug: string
  showModels: boolean
  showGenerations: boolean
}) {
  const visibleMakeNames = new Set(
    models.map((model) => model.makeName),
  )

  const visibleModelNames = new Set(
    generations.map(
      (generation) => generation.modelName,
    ),
  )

  const makeOptions: FilterGroupOption[] =
    makes.map((make) => ({
      key: make.id,
      label: make.name,
      productCount: make.productCount,
      selected:
        filters.vehicleMakeIds.includes(
          make.id,
        ),
      href: buildCategoryHref(
        categorySlug,
        filters,
        {
          vehicleMakeIds: toggleId(
            filters.vehicleMakeIds,
            make.id,
          ),
        },
      ),
    }))

  const modelOptions: FilterGroupOption[] =
    showModels
      ? models.map((model) => ({
          key: model.id,
          label:
            visibleMakeNames.size > 1
              ? `${model.makeName} ${model.name}`
              : model.name,
          productCount: model.productCount,
          selected:
            filters.vehicleModelIds.includes(
              model.id,
            ),
          href: buildCategoryHref(
            categorySlug,
            filters,
            {
              vehicleModelIds: toggleId(
                filters.vehicleModelIds,
                model.id,
              ),
            },
          ),
        }))
      : []

  const generationOptions: FilterGroupOption[] =
    showGenerations
      ? generations.map((generation) => ({
          key: generation.id,
          label:
            visibleModelNames.size > 1
              ? `${generation.modelName} ${generation.name}`
              : generation.name,
          productCount:
            generation.productCount,
          selected:
            filters.vehicleGenerationIds.includes(
              generation.id,
            ),
          href: buildCategoryHref(
            categorySlug,
            filters,
            {
              vehicleGenerationIds: toggleId(
                filters.vehicleGenerationIds,
                generation.id,
              ),
            },
          ),
        }))
      : []

  return {
    makeOptions,
    modelOptions,
    generationOptions,
  }
}

function buildVariantFacetOptions({
  facets,
  filters,
  categorySlug,
}: {
  facets: ReturnType<typeof getVisibleVariantFacets>
  filters: CategoryFilterState
  categorySlug: string
}): Array<{
  code: string
  name: string
  options: FilterGroupOption[]
  clearHref: string
}> {
  return facets.map((facet) => {
    const selectedValues =
      getSelectedVariantValues(
        filters.variantSelections,
        facet.code,
      )

    return {
      code: facet.code,
      name: facet.name,
      clearHref: buildCategoryHref(
        categorySlug,
        filters,
        {
          variantSelections:
            filters.variantSelections.filter(
              (selection) =>
                selection.code !==
                facet.code,
            ),
        },
      ),
      options: facet.values.map(
        (facetValue) => {
          const selected =
            selectedValues.includes(
              facetValue.value,
            )

          return {
            key: `${facet.code}:${facetValue.value}`,
            label: facetValue.value,
            productCount:
              facetValue.productCount,
            selected,
            href: buildCategoryHref(
              categorySlug,
              filters,
              {
                variantSelections:
                  toggleVariantSelection(
                    filters.variantSelections,
                    facet.code,
                    facetValue.value,
                  ),
              },
            ),
          }
        },
      ),
    }
  })
}

function FilterPanel({
  categorySlug,
  filters,
  facets,
  profile,
}: {
  categorySlug: string
  filters: CategoryFilterState
  facets: CatalogCategoryFacets
  profile: ReturnType<
    typeof getCategoryFilterProfile
  >
}) {
  const visibleVariantFacets =
    getVisibleVariantFacets(
      profile,
      facets.variantFacets,
    )

  const showVehicle =
    shouldShowVehicleFilter(profile)

  const visibleModels =
    getVisibleVehicleModels(
      facets.vehicleMakes,
      filters.vehicleMakeIds,
    )

  const showGenerations =
    shouldShowVehicleGenerations(
      profile,
      visibleModels,
    )

  const visibleGenerations =
    getVisibleVehicleGenerations(
      visibleModels,
      filters.vehicleModelIds,
    )

  const vehicleOptions = buildVehicleOptions({
    makes: facets.vehicleMakes,
    models: visibleModels,
    generations: visibleGenerations,
    filters,
    categorySlug,
    showModels: showVehicle,
    showGenerations:
      showVehicle && showGenerations,
  })

  const variantGroups =
    buildVariantFacetOptions({
      facets: visibleVariantFacets,
      filters,
      categorySlug,
    })

  const hasPriceFilter =
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined

  return (
    <div className="space-y-6">
      <FilterGroup
        title="Disponibilidade"
        options={[
          {
            key: 'stock',
            label: 'Em stock',
            productCount: facets.inStockCount,
            selected: filters.inStockOnly,
            href: buildCategoryHref(
              categorySlug,
              filters,
              {
                inStockOnly:
                  !filters.inStockOnly,
              },
            ),
          },
        ]}
      />

      <FilterGroup
        title={getBrandFilterLabel(profile)}
        options={buildBrandOptions({
          brands: facets.brands,
          filters,
          categorySlug,
        })}
        clearHref={
          filters.brandSlugs.length > 0
            ? buildCategoryHref(
                categorySlug,
                filters,
                {
                  brandSlugs: [],
                },
              )
            : undefined
        }
      />

      {showVehicle && (
        <>
          <FilterGroup
            title="Marca do veículo"
            options={vehicleOptions.makeOptions}
            clearHref={
              filters.vehicleMakeIds.length > 0
                ? buildCategoryHref(
                    categorySlug,
                    filters,
                    {
                      vehicleMakeIds: [],
                    },
                  )
                : undefined
            }
            emptyHint="Produtos com compatibilidade registada para o veículo escolhido."
          />

          <FilterGroup
            title="Modelo"
            options={
              vehicleOptions.modelOptions
            }
            clearHref={
              filters.vehicleModelIds.length >
              0
                ? buildCategoryHref(
                    categorySlug,
                    filters,
                    {
                      vehicleModelIds: [],
                      vehicleGenerationIds: [],
                    },
                  )
                : undefined
            }
          />

          <FilterGroup
            title="Geração"
            options={
              vehicleOptions.generationOptions
            }
            clearHref={
              filters.vehicleGenerationIds
                .length > 0
                ? buildCategoryHref(
                    categorySlug,
                    filters,
                    {
                      vehicleGenerationIds: [],
                    },
                  )
                : undefined
            }
          />
        </>
      )}

      {variantGroups.map((group) => (
        <FilterGroup
          key={group.code}
          title={group.name}
          options={group.options}
          clearHref={
            getSelectedVariantValues(
              filters.variantSelections,
              group.code,
            ).length > 0
              ? group.clearHref
              : undefined
          }
          /**
           * Nas jantes as secções ficam compactas como nos
           * catálogos de referência: colapsadas, exceto quando
           * já têm valores escolhidos.
           */
          defaultOpen={
            profile !== 'wheels' ||
            getSelectedVariantValues(
              filters.variantSelections,
              group.code,
            ).length > 0
          }
        />
      ))}

      <section className="border-t border-white/8 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
            Preço
          </h3>

          {hasPriceFilter && (
            <Link
              href={buildCategoryHref(
                categorySlug,
                filters,
                {
                  priceMin: undefined,
                  priceMax: undefined,
                },
              )}
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
          {filters.inStockOnly && (
            <input
              type="hidden"
              name="stock"
              value="available"
            />
          )}

          {filters.brandSlugs.map((brandSlug) => (
            <input
              key={brandSlug}
              type="hidden"
              name="brand"
              value={brandSlug}
            />
          ))}

          {filters.vehicleMakeIds.map(
            (makeId) => (
              <input
                key={makeId}
                type="hidden"
                name="make"
                value={makeId}
              />
            ),
          )}

          {filters.vehicleModelIds.map(
            (modelId) => (
              <input
                key={modelId}
                type="hidden"
                name="model"
                value={modelId}
              />
            ),
          )}

          {filters.vehicleGenerationIds.map(
            (generationId) => (
              <input
                key={generationId}
                type="hidden"
                name="generation"
                value={generationId}
              />
            ),
          )}

          {filters.variantSelections.flatMap(
            (selection) =>
              selection.values.map((value) => (
                <input
                  key={`${selection.code}:${value}`}
                  type="hidden"
                  name={`v_${selection.code}`}
                  value={value}
                />
              )),
          )}

          {filters.sort && (
            <input
              type="hidden"
              name="sort"
              value={filters.sort}
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
                  filters.priceMin ?? ''
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
                  filters.priceMax ?? ''
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

  const requestedInStockOnly =
    getSearchParamValue(query.stock) ===
    'available'

  const requestedBrandSlugs =
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

  const requestedMakeIds =
    getSearchParamValues(query.make)

  const requestedModelIds =
    getSearchParamValues(query.model)

  const requestedGenerationIds =
    getSearchParamValues(query.generation)

  const requestedSort =
    parseSortParam(query.sort)

  const hasInvalidPriceParams =
    (query.priceMin !== undefined &&
      parsedPriceMin === undefined) ||
    (query.priceMax !== undefined &&
      parsedPriceMax === undefined) ||
    priceRangeIsInverted

  const shouldCanonicalizeSort =
    query.sort !== undefined &&
    requestedSort === undefined

  // Valores crus de v_<código> na URL. Ainda sem validar
  // contra as facetas (isso acontece depois do fetch); a
  // query de produtos aplica-os à mesma — se algum valor
  // for inválido, a página redireciona para a URL limpa.
  const rawVariantSelections = Object.entries(
    query,
  )
    .filter(([key]) =>
      key.startsWith(VARIANT_FILTER_PREFIX),
    )
    .map(([key, rawValue]) => ({
      code: key.slice(VARIANT_FILTER_PREFIX.length),
      values: getSearchParamValues(rawValue),
    }))
    .filter(
      (selection) =>
        selection.code.length > 0 &&
        selection.values.length > 0,
    )

  const requestedVehicle = {
    vehicleMakeIds: requestedMakeIds,
    vehicleModelIds: requestedModelIds,
    vehicleGenerationIds:
      requestedGenerationIds,
  }

  const rawFilters: CategoryFilterState = {
    inStockOnly: requestedInStockOnly,
    brandSlugs: requestedBrandSlugs,
    priceMin,
    priceMax,
    vehicleMakeIds: requestedMakeIds,
    vehicleModelIds: requestedModelIds,
    vehicleGenerationIds:
      requestedGenerationIds,
    variantSelections: [],
    sort: requestedSort ?? 'newest',
  }

  // A marca, o modelo e a geração são níveis
  // alternativos da mesma seleção de veículo: qualquer
  // compatibilidade de um deles devolve o produto.
  const requestedCatalogFilters = {
    inStockOnly: requestedInStockOnly,
    brandSlugs: requestedBrandSlugs,
    priceMin,
    priceMax,
    vehicleMakeIds: requestedMakeIds,
    vehicleModelIds: requestedModelIds,
    vehicleGenerationIds:
      requestedGenerationIds,
    variantSelections: rawVariantSelections,
    sort: requestedSort ?? 'newest',
  } as const

  const [result, facets, allCategories] =
    await Promise.all([
      getCatalogCategoryPageBySlug(
        slug,
        requestedCatalogFilters,
      ),
      getCatalogCategoryFacetsBySlug(
        slug,
        requestedCatalogFilters,
      ),
      getCatalogCategories(),
    ])

  if (!result || !facets) {
    notFound()
  }

  const {
    category,
    brands,
    products,
  } = result

  const { vehicleMakes: vehicles } = facets

  const normalizedBrands =
    normalizeBrandSlugs(
      requestedBrandSlugs,
      facets.brands.map(
        (brand) => brand.slug,
      ),
    )

  const normalizedVehicle =
    normalizeVehicleSelections({
      makeIds: requestedMakeIds,
      modelIds: requestedModelIds,
      generationIds: requestedGenerationIds,
      makes: vehicles,
    })

  const parsedVariantSelections =
    parseVariantSelections(
      query,
      facets.variantFacets,
    )

  const filters: CategoryFilterState = {
    ...rawFilters,
    brandSlugs: normalizedBrands.brandSlugs,
    vehicleMakeIds:
      normalizedVehicle.vehicleMakeIds,
    vehicleModelIds:
      normalizedVehicle.vehicleModelIds,
    vehicleGenerationIds:
      normalizedVehicle.vehicleGenerationIds,
    variantSelections:
      parsedVariantSelections.selections,
  }

  if (
    hasInvalidPriceParams ||
    shouldCanonicalizeSort ||
    normalizedBrands.hasInvalid ||
    normalizedVehicle.hasInvalid ||
    parsedVariantSelections.hasInvalidValues ||
    !hasSameVehicleSelections(
      requestedVehicle,
      filters,
    )
  ) {
    redirect(
      buildCategoryHref(
        category.slug,
        filters,
      ),
    )
  }

  const resultForSelection = products

  const profile = getCategoryFilterProfile(
    category,
  )

  const hasPriceFilter =
    priceMin !== undefined ||
    priceMax !== undefined

  const selectedVariantValueCount =
    filters.variantSelections.reduce(
      (total, selection) =>
        total + selection.values.length,
      0,
    )

  const hasVehicleFilter =
    filters.vehicleMakeIds.length > 0 ||
    filters.vehicleModelIds.length > 0 ||
    filters.vehicleGenerationIds.length > 0

  const hasActiveFilters =
    filters.inStockOnly ||
    filters.brandSlugs.length > 0 ||
    hasPriceFilter ||
    hasVehicleFilter ||
    selectedVariantValueCount > 0

  const activeFilterCount =
    Number(filters.inStockOnly) +
    filters.brandSlugs.length +
    Number(hasPriceFilter) +
    filters.vehicleMakeIds.length +
    filters.vehicleModelIds.length +
    filters.vehicleGenerationIds.length +
    selectedVariantValueCount

  const clearFiltersHref =
    buildCategoryHref(
      category.slug,
      filters,
      {
        inStockOnly: false,
        brandSlugs: [],
        priceMin: undefined,
        priceMax: undefined,
        vehicleMakeIds: [],
        vehicleModelIds: [],
        vehicleGenerationIds: [],
        variantSelections: [],
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

  const visibleModels =
    getVisibleVehicleModels(
      vehicles,
      filters.vehicleMakeIds,
    )

  const visibleGenerations =
    getVisibleVehicleGenerations(
      visibleModels,
      filters.vehicleModelIds,
    )

  const brandById = new Map(
    brands.map((brand) => [
      brand.slug,
      brand,
    ]),
  )

  const makeById = new Map(
    vehicles.map((make) => [
      make.id,
      make,
    ]),
  )

  return (
    <main className="min-h-screen bg-[#0b0d0f] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 lg:px-8 lg:pb-20 lg:pt-9">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-semibold text-white/55"
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
                {resultForSelection.length}
              </span>{' '}
              {resultForSelection.length === 1
                ? 'resultado'
                : 'resultados'}
            </p>

            <div className="flex items-center gap-2">
              <MobileFilterDrawer
                activeCount={activeFilterCount}
              >
                <FilterPanel
                  categorySlug={category.slug}
                  filters={filters}
                  facets={facets}
                  profile={profile}
                />
              </MobileFilterDrawer>

              <CategorySortControl
                categorySlug={category.slug}
                value={filters.sort}
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 py-4">
            {filters.inStockOnly && (
              <Link
                href={buildCategoryHref(
                  category.slug,
                  filters,
                  {
                    inStockOnly: false,
                  },
                )}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
              >
                Em stock
                <span aria-hidden="true">
                  ×
                </span>
              </Link>
            )}

            {filters.brandSlugs.map(
              (brandSlug) => {
                const brand =
                  brandById.get(brandSlug)

                if (!brand) {
                  return null
                }

                return (
                  <Link
                    key={brand.id}
                    href={buildCategoryHref(
                      category.slug,
                      filters,
                      {
                        brandSlugs: toggleId(
                          filters.brandSlugs,
                          brandSlug,
                        ),
                      },
                    )}
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

            {filters.vehicleMakeIds.map(
              (makeId) => {
                const make =
                  makeById.get(makeId)

                if (!make) {
                  return null
                }

                return (
                  <Link
                    key={make.id}
                    href={buildCategoryHref(
                      category.slug,
                      filters,
                      {
                        vehicleMakeIds: toggleId(
                          filters.vehicleMakeIds,
                          makeId,
                        ),
                      },
                    )}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    {make.name}
                    <span aria-hidden="true">
                      ×
                    </span>
                  </Link>
                )
              },
            )}

            {filters.vehicleModelIds.map(
              (modelId) => {
                const model =
                  visibleModels.find(
                    (item) =>
                      item.id === modelId,
                  )

                if (!model) {
                  return null
                }

                return (
                  <Link
                    key={model.id}
                    href={buildCategoryHref(
                      category.slug,
                      filters,
                      {
                        vehicleModelIds: toggleId(
                          filters.vehicleModelIds,
                          modelId,
                        ),
                      },
                    )}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    {model.name}
                    <span aria-hidden="true">
                      ×
                    </span>
                  </Link>
                )
              },
            )}

            {filters.vehicleGenerationIds.map(
              (generationId) => {
                const generation =
                  visibleGenerations.find(
                    (item) =>
                      item.id ===
                      generationId,
                  )

                if (!generation) {
                  return null
                }

                return (
                  <Link
                    key={generation.id}
                    href={buildCategoryHref(
                      category.slug,
                      filters,
                      {
                        vehicleGenerationIds:
                          toggleId(
                            filters.vehicleGenerationIds,
                            generationId,
                          ),
                      },
                    )}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    {generation.name}
                    <span aria-hidden="true">
                      ×
                    </span>
                  </Link>
                )
              },
            )}

            {hasPriceFilter && (
              <Link
                href={buildCategoryHref(
                  category.slug,
                  filters,
                  {
                    priceMin: undefined,
                    priceMax: undefined,
                  },
                )}
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

            {filters.variantSelections.flatMap(
              (selection) => {
                const facet =
                  facets.variantFacets.find(
                    (item) =>
                      item.code ===
                      selection.code,
                  )

                return selection.values.map(
                  (value) => (
                    <Link
                      key={`${selection.code}:${value}`}
                      href={buildCategoryHref(
                        category.slug,
                        filters,
                        {
                          variantSelections:
                            removeVariantValue(
                              filters.variantSelections,
                              selection.code,
                              value,
                            ),
                        },
                      )}
                      className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/68 transition hover:bg-white/[0.09] hover:text-white"
                    >
                      {facet
                        ? `${facet.name}: ${value}`
                        : value}
                      <span aria-hidden="true">
                        ×
                      </span>
                    </Link>
                  ),
                )
              },
            )}

            <Link
              href={clearFiltersHref}
              className="ml-1 text-[10px] font-black uppercase tracking-[0.09em] text-white/55 transition hover:text-brand"
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
                    href={clearFiltersHref}
                    className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/34 transition hover:text-brand"
                  >
                    Limpar
                  </Link>
                )}
              </div>

              <FilterPanel
                categorySlug={category.slug}
                filters={filters}
                facets={facets}
                profile={profile}
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

            {resultForSelection.length === 0 ? (
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
                className={`grid gap-5 sm:grid-cols-2 ${
                  resultForSelection.length === 1
                    ? 'max-w-md'
                    : resultForSelection.length ===
                        2
                      ? 'max-w-3xl'
                      : 'xl:grid-cols-3'
                }`}
              >
                {resultForSelection.map(
                  (product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variant="category"
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
