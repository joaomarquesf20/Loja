import type {
  CatalogSort,
  CatalogVariantFacet,
  CatalogVariantSelection,
  CatalogVehicleMakeFacet,
} from '@/server/catalog'

export const VARIANT_FILTER_PREFIX = 'v_'

export type CategoryFilterState = {
  inStockOnly: boolean
  brandSlugs: string[]
  priceMin?: number
  priceMax?: number
  vehicleMakeIds: string[]
  vehicleModelIds: string[]
  vehicleSpecIds: string[]
  variantSelections: CatalogVariantSelection[]
  sort?: CatalogSort
}

export type CategoryQuery = Record<
  string,
  string | string[] | undefined
>

export function getSearchParamValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value
}

export function getSearchParamValues(
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

export function parsePriceParam(
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

export function parseSortParam(
  value: string | string[] | undefined,
): CatalogSort | undefined {
  const rawValue =
    getSearchParamValue(value)?.trim()

  if (
    rawValue === 'newest' ||
    rawValue === 'price-asc' ||
    rawValue === 'price-desc'
  ) {
    return rawValue
  }

  return undefined
}

function sameValues(
  first: string[],
  second: string[],
) {
  if (first.length !== second.length) {
    return false
  }

  return first.every(
    (value, index) =>
      value === second[index],
  )
}

export function buildCategoryHref(
  categorySlug: string,
  filters: CategoryFilterState,
  overrides?: Partial<CategoryFilterState>,
) {
  const {
    inStockOnly,
    brandSlugs,
    priceMin,
    priceMax,
    vehicleMakeIds,
    vehicleModelIds,
    vehicleSpecIds,
    variantSelections,
    sort,
  } = {
    ...filters,
    ...overrides,
  }

  const params = new URLSearchParams()

  if (inStockOnly) {
    params.set('stock', 'available')
  }

  for (const brandSlug of brandSlugs) {
    params.append('brand', brandSlug)
  }

  if (priceMin !== undefined) {
    params.set(
      'priceMin',
      String(priceMin),
    )
  }

  if (priceMax !== undefined) {
    params.set(
      'priceMax',
      String(priceMax),
    )
  }

  for (const makeId of vehicleMakeIds) {
    params.append('make', makeId)
  }

  for (const modelId of vehicleModelIds) {
    params.append('model', modelId)
  }

  for (const specId of vehicleSpecIds) {
    params.append('spec', specId)
  }

  for (const selection of variantSelections) {
    for (const value of selection.values) {
      params.append(
        `${VARIANT_FILTER_PREFIX}${selection.code}`,
        value,
      )
    }
  }

  // "Novidades" é a ordenação por omissão, por isso
  // não precisa de aparecer na URL.
  if (
    sort &&
    sort !== 'newest'
  ) {
    params.set('sort', sort)
  }

  const query = params.toString()

  return query
    ? `/categorias/${categorySlug}?${query}`
    : `/categorias/${categorySlug}`
}

export function toggleVariantSelection(
  selections: CatalogVariantSelection[],
  code: string,
  value: string,
): CatalogVariantSelection[] {
  const current = selections.find(
    (selection) => selection.code === code,
  )

  const otherSelections =
    selections.filter(
      (selection) => selection.code !== code,
    )

  const currentValues = current?.values ?? []

  const nextValues =
    currentValues.includes(value)
      ? currentValues.filter(
          (item) => item !== value,
        )
      : [...currentValues, value]

  return nextValues.length > 0
    ? [
        ...otherSelections,
        {
          code,
          values: nextValues,
        },
      ]
    : otherSelections
}

export function getSelectedVariantValues(
  selections: CatalogVariantSelection[],
  code: string,
) {
  return (
    selections.find(
      (selection) => selection.code === code,
    )?.values ?? []
  )
}

export function removeVariantValue(
  selections: CatalogVariantSelection[],
  code: string,
  value: string,
) {
  return toggleVariantSelection(
    selections,
    code,
    value,
  )
}

/**
 * Lê as opções de variante da query. Os nomes dos eixos
 * (`v_diameter`, `v_pcd`, ...) e os valores têm de
 * existir no catálogo real da categoria; caso contrário
 * são removidos da URL para não haver filtros que não
 * correspondem a combinações existentes.
 */
export function parseVariantSelections(
  query: CategoryQuery,
  availableFacets: CatalogVariantFacet[],
): {
  selections: CatalogVariantSelection[]
  hasInvalidValues: boolean
} {
  const availableByCode = new Map(
    availableFacets.map((facet) => [
      facet.code,
      new Set(
        facet.values.map(
          (facetValue) => facetValue.value,
        ),
      ),
    ]),
  )

  const selections: CatalogVariantSelection[] = []
  let hasInvalidValues = false

  for (const [key, rawValue] of Object.entries(
    query,
  )) {
    if (
      !key.startsWith(
        VARIANT_FILTER_PREFIX,
      )
    ) {
      continue
    }

    const code = key.slice(
      VARIANT_FILTER_PREFIX.length,
    )

    const availableValues =
      availableByCode.get(code)

    if (!availableValues) {
      hasInvalidValues = true
      continue
    }

    const values = getSearchParamValues(
      rawValue,
    ).filter((value) => {
      const isAvailable =
        availableValues.has(value)

      if (!isAvailable) {
        hasInvalidValues = true
      }

      return isAvailable
    })

    if (values.length > 0) {
      selections.push({
        code,
        values,
      })
    }
  }

  return {
    selections,
    hasInvalidValues,
  }
}

export function normalizeBrandSlugs(
  brandSlugs: string[],
  availableBrandSlugs: string[],
) {
  const available = new Set(
    availableBrandSlugs,
  )

  const hasInvalid =
    brandSlugs.some(
      (slug) => !available.has(slug),
    )

  return {
    brandSlugs: brandSlugs.filter(
      (slug) => available.has(slug),
    ),
    hasInvalid,
  }
}

export type NormalizedVehicleSelections = {
  vehicleMakeIds: string[]
  vehicleModelIds: string[]
  vehicleSpecIds: string[]
  hasInvalid: boolean
}

/**
 * Valida a seleção de veículo contra a árvore real da
 * categoria e mantém a hierarquia coerente: um modelo só
 * fica selecionado se pertencer a uma marca selecionada e
 * uma especificação só se pertencer a um modelo
 * selecionado.
 */
export function normalizeVehicleSelections({
  makeIds,
  modelIds,
  specIds,
  makes,
}: {
  makeIds: string[]
  modelIds: string[]
  specIds: string[]
  makes: CatalogVehicleMakeFacet[]
}): NormalizedVehicleSelections {
  let hasInvalid = makeIds.some(
    (id) =>
      !makes.some((make) => make.id === id),
  )

  const validMakeIds = makeIds.filter((id) =>
    makes.some((make) => make.id === id),
  )

  const makeIdSet = new Set(validMakeIds)

  const validModelIds =
    modelIds.filter((modelId) => {
      const isValid =
        makes.some((make) =>
          make.models.some(
            (model) =>
              model.id === modelId,
          ),
        )

      if (!isValid) {
        hasInvalid = true
      }

      if (
        validMakeIds.length > 0 &&
        !makes.some((make) =>
          make.models.some(
            (model) =>
              model.id === modelId &&
              makeIdSet.has(make.id),
          ),
        )
      ) {
        hasInvalid = true
        return false
      }

      return isValid
    })

  const modelIdSet = new Set(validModelIds)

  const validSpecIds =
    specIds.filter(
      (specId) => {
        const isValid =
          makes.some((make) =>
            make.models.some((model) =>
              model.specs.some(
                (spec) =>
                  spec.id ===
                  specId,
              ),
            ),
          )

        if (!isValid) {
          hasInvalid = true
        }

        if (
          validModelIds.length > 0 &&
          !makes.some((make) =>
            make.models.some(
              (model) =>
                modelIdSet.has(model.id) &&
                model.specs.some(
                  (spec) =>
                    spec.id ===
                    specId,
                ),
            ),
          )
        ) {
          hasInvalid = true
          return false
        }

        return isValid
      },
    )

  return {
    vehicleMakeIds: validMakeIds,
    vehicleModelIds: validModelIds,
    vehicleSpecIds: validSpecIds,
    hasInvalid,
  }
}

export function hasSameVehicleSelections(
  first: {
    vehicleMakeIds: string[]
    vehicleModelIds: string[]
    vehicleSpecIds: string[]
  },
  second: {
    vehicleMakeIds: string[]
    vehicleModelIds: string[]
    vehicleSpecIds: string[]
  },
) {
  return (
    sameValues(
      first.vehicleMakeIds,
      second.vehicleMakeIds,
    ) &&
    sameValues(
      first.vehicleModelIds,
      second.vehicleModelIds,
    ) &&
    sameValues(
      first.vehicleSpecIds,
      second.vehicleSpecIds,
    )
  )
}

/**
 * Modelos visíveis: apenas os das marcas selecionadas
 * (selecionar uma marca restringe os modelos).
 */
export function getVisibleVehicleModels(
  makes: CatalogVehicleMakeFacet[],
  selectedMakeIds: string[],
) {
  const selected = new Set(selectedMakeIds)

  const makesToShow =
    selectedMakeIds.length > 0
      ? makes.filter(
          (make) => selected.has(make.id),
        )
      : makes

  return makesToShow.flatMap(
    (make) =>
      make.models.map((model) => ({
        ...model,
        makeId: make.id,
        makeName: make.name,
      })),
  )
}

export function getVisibleVehicleSpecs(
  models: Array<{
    id: string
    name: string
    makeName: string
    specs: Array<{
      id: string
      engine: string
      engineCode: string | null
      yearStart: number
      yearEnd: number | null
      fuelType: string
      powerHp: number | null
      productCount: number
    }>
  }>,
  selectedModelIds: string[],
) {
  const selected = new Set(selectedModelIds)

  const modelsToShow =
    selectedModelIds.length > 0
      ? models.filter(
          (model) => selected.has(model.id),
        )
      : models

  return modelsToShow.flatMap(
    (model) =>
      model.specs.map(
        (spec) => ({
          ...spec,
          modelId: model.id,
          modelName: model.name,
          makeName: model.makeName,
        }),
      ),
  )
}

export function toggleId(
  values: string[],
  value: string,
) {
  return values.includes(value)
    ? values.filter(
        (item) => item !== value,
      )
    : [...values, value]
}
