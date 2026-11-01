import {
  getCategoryFilterProfile,
  shouldShowVehicleFilter,
} from '@/lib/storefront-category-profile'
import type {
  ProductImageMetadata,
} from '@/lib/product-images'
import { prisma } from './db'

type CatalogPrice =
  | number
  | string
  | {
      toString(): string
    }

type CatalogVariantRecord = {
  id: string
  sku: string
  price: CatalogPrice
  priceSet: CatalogPrice | null
  stockQuantity: number
  isActive: boolean
  images: string[]
  position: number
  selections: Array<{
    optionValue: {
      id: string
      value: string
      option: {
        id: string
        code: string
        name: string
        position: number
      }
    }
  }>
}

type CatalogProductRecord = {
  id: string
  name: string
  slug: string
  description: string | null
  images: string[]
  defaultFinish?: string | null
  category: {
    id: string
    name: string
    slug: string
  }
  brand: {
    id: string
    name: string
    slug: string
  } | null
  variants?: CatalogVariantRecord[]
}

type CatalogProductDetailRecord =
  CatalogProductRecord & {
    sku: string
  }

type CatalogImageRecord = {
  id: string
  productId: string
  url: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
  finishValueId: string | null
  finishValue: {
    value: string
    option: {
      code: string
    }
  } | null
}

type CatalogCategoryRecord = {
  id: string
  parentId: string | null
  name: string
  slug: string
  description: string | null
  _count: {
    products: number
  }
}

type CatalogBrandRecord = {
  id: string
  name: string
  slug: string
}

type CatalogVehicleCompatibilityRecord = {
  vehicleSpec: {
    id: string
    engine: string
    engineCode: string | null
    yearStart: number
    yearEnd: number | null
    fuelType: string
    powerHp: CatalogPrice | null
    model: {
      id: string
      name: string
      make: {
        id: string
        name: string
      }
    }
  }
}

export type CatalogVariantOption = {
  code: string
  name: string
  value: string
}

export type CatalogVariant = {
  id: string
  sku: string
  price: number
  /** Preço opcional do conjunto de 4 jantes. */
  priceSet: number | null
  inStock: boolean
  options: CatalogVariantOption[]
  image: string | null
}

export type CatalogProduct = {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  inStock: boolean
  images: string[]
  imageMetadata?: ProductImageMetadata[]
  defaultFinish?: string | null
  category: {
    id: string
    name: string
    slug: string
  }
  brand: {
    id: string
    name: string
    slug: string
  } | null
  variants: CatalogVariant[]
}

export type CatalogProductDetail =
  CatalogProduct & {
    sku: string
  }

export type CatalogCategory = {
  id: string
  parentId: string | null
  name: string
  slug: string
  description: string | null
}

export type CatalogBrand = {
  id: string
  name: string
  slug: string
}

export type CatalogVehicleSpec = {
  id: string
  engine: string
  engineCode: string | null
  yearStart: number
  yearEnd: number | null
  fuelType: string
  powerHp: number | null
  model: {
    id: string
    name: string
    make: {
      id: string
      name: string
    }
  }
}

export type CatalogSort =
  | 'newest'
  | 'name-asc'
  | 'name-desc'
  | 'price-asc'
  | 'price-desc'

export type CatalogCategoryPage = {
  category: CatalogCategory
  brands: CatalogBrand[]
  vehicleSpecs: CatalogVehicleSpec[]
  products: CatalogProduct[]
}

export type CatalogVariantSelection = {
  code: string
  values: string[]
}

export type CatalogCategoryFilters = {
  inStockOnly?: boolean
  brandSlugs?: string[]
  priceMin?: number
  priceMax?: number
  /**
   * Veículo selecionado. Um produto é compatível quando
   * tem uma compatibilidade da marca, do modelo ou da
   * especificação selecionados (valores do mesmo nível
   * são alternativas).
   */
  vehicleMakeIds?: string[]
  vehicleModelIds?: string[]
  vehicleSpecIds?: string[]
  variantSelections?:
    CatalogVariantSelection[]
  sort?: CatalogSort
}

export type CatalogVariantFacet = {
  code: string
  name: string
  values: Array<{
    value: string
    productCount: number
  }>
}

type CatalogProductOrderBy =
  | {
      name: 'asc' | 'desc'
    }
  | {
      createdAt: 'desc'
    }
  | [
      {
        createdAt: 'desc'
      },
      {
        name: 'asc'
      },
    ]

type CatalogVariantSelect = {
  select: {
    id: true
    sku: true
    price: true
    priceSet: true
    stockQuantity: true
    isActive: true
    images: true
    position: true
    selections: {
      select: {
        optionValue: {
          select: {
            id: true
            value: true
            option: {
              select: {
                id: true
                code: true
                name: true
                position: true
              }
            }
          }
        }
      }
    }
  }
}

function getCatalogVariantSelect(): CatalogVariantSelect {
  return {
    select: {
      id: true,
      sku: true,
      price: true,
      priceSet: true,
      stockQuantity: true,
      isActive: true,
      images: true,
      position: true,
      selections: {
        select: {
          optionValue: {
            select: {
              id: true,
              value: true,
              option: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  position: true,
                },
              },
            },
          },
        },
      },
    },
  }
}

const catalogProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  images: true,
  defaultFinish: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  variants: getCatalogVariantSelect(),
} as const

type CatalogProductFindManyArgs = {
  where: {
    isActive: true
    categoryId?: {
      in: string[]
    }
    productBrandId?: {
      in: string[]
    }
    variants?: {
      some: {
        isActive: true
        price?: {
          gte?: number
          lte?: number
        }
        stockQuantity?: {
          gt: number
        }
        AND?: Array<{
          selections: {
            some: {
              optionValue: {
                value: {
                  in: string[]
                }
                option: {
                  code: string
                }
              }
            }
          }
        }>
      }
    }
    compatibilities?: {
      some: {
        OR: Array<{
          vehicleSpecId?: {
            in: string[]
          }
          vehicleSpec?: {
            modelId?: {
              in: string[]
            }
            model?: {
              makeId: {
                in: string[]
              }
            }
          }
        }>
      }
    }
  }
  orderBy: CatalogProductOrderBy
  select: typeof catalogProductSelect
}

export interface CatalogClient {
  productImage?: {
    findMany(args: {
      where: {
        productId: {
          in: string[]
        }
      }
      orderBy: Array<
        | { sortOrder: 'asc' }
        | { id: 'asc' }
      >
      select: {
        id: true
        productId: true
        url: true
        altText: true
        sortOrder: true
        isPrimary: true
        finishValueId: true
        finishValue: {
          select: {
            value: true
            option: {
              select: {
                code: true
              }
            }
          }
        }
      }
    }): Promise<CatalogImageRecord[]>
  }

  product: {
    findMany(
      args: CatalogProductFindManyArgs,
    ): Promise<CatalogProductRecord[]>

    findFirst(args: {
      where: {
        slug: string
        isActive: true
      }
      select: typeof catalogProductSelect & {
        sku: true
      }
    }): Promise<CatalogProductDetailRecord | null>
  }

  category: {
    findMany(args: {
      orderBy: {
        name: 'asc'
      }
      select: {
        id: true
        parentId: true
        name: true
        slug: true
        description: true
        _count: {
          select: {
            products: {
              where: {
                isActive: true
              }
            }
          }
        }
      }
    }): Promise<CatalogCategoryRecord[]>
  }

  productBrand: {
    findMany(args: {
      where: {
        products: {
          some: {
            isActive: true
            categoryId: {
              in: string[]
            }
          }
        }
      }
      orderBy: {
        name: 'asc'
      }
      select: {
        id: true
        name: true
        slug: true
      }
    }): Promise<CatalogBrandRecord[]>
  }

  productCompatibility?: {
    findMany(
      args:
        | {
            where: {
              product: {
                isActive: true
                categoryId: {
                  in: string[]
                }
              }
            }
            select: {
              vehicleSpec: {
                select: {
                  id: true
                  engine: true
                  engineCode: true
                  yearStart: true
                  yearEnd: true
                  fuelType: true
                  powerHp: true
                  model: {
                    select: {
                      id: true
                      name: true
                      make: {
                        select: {
                          id: true
                          name: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        | {
            where: {
              product: {
                isActive: true
                categoryId: {
                  in: string[]
                }
              }
            }
            select: {
              productId: true
              vehicleSpec: {
                select: {
                  id: true
                  model: {
                    select: {
                      id: true
                      make: {
                        select: {
                          id: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
    ): Promise<CatalogCompatibilityFindManyResult>
  }

  vehicleMake?: {
    findMany(args?: {
      orderBy?: { name: 'asc' }
      select?: Record<string, unknown>
    }): Promise<CatalogVehicleMakeRecord[]>
  }
}

function getClient(
  client?: CatalogClient,
): CatalogClient {
  return (
    client ??
    (prisma as unknown as CatalogClient)
  )
}

function isCatalogClient(
  value:
    | CatalogCategoryFilters
    | CatalogClient
    | undefined,
): value is CatalogClient {
  if (!value) {
    return false
  }

  return (
    'product' in value &&
    'category' in value
  )
}

function sortVariants(
  variants: CatalogVariantRecord[],
): CatalogVariantRecord[] {
  return [...variants].sort(
    (first, second) =>
      first.position - second.position ||
      first.sku.localeCompare(second.sku),
  )
}

function toCatalogVariant(
  variant: CatalogVariantRecord,
): CatalogVariant {
  const options = variant.selections
    .map((selection) => ({
      code: selection.optionValue.option.code,
      name: selection.optionValue.option.name,
      value: selection.optionValue.value,
      optionPosition:
        selection.optionValue.option.position,
    }))
    .sort(
      (first, second) =>
        first.optionPosition -
          second.optionPosition ||
        first.code.localeCompare(second.code),
    )
    .map(
      ({ code, name, value }) => ({
        code,
        name,
        value,
      }),
    )

  return {
    id: variant.id,
    sku: variant.sku,
    price: Number(variant.price),
    priceSet:
      variant.priceSet === null
        ? null
        : Number(variant.priceSet),
    inStock:
      variant.isActive &&
      variant.stockQuantity > 0,
    options,
    image:
      variant.images.find(
        (candidate) =>
          candidate.trim().length > 0,
      ) ?? null,
  }
}

async function getCatalogImageMetadata(
  db: CatalogClient,
  productIds: string[],
) {
  const metadataByProductId =
    new Map<
      string,
      ProductImageMetadata[]
    >()

  if (
    !db.productImage ||
    productIds.length === 0
  ) {
    return metadataByProductId
  }

  const records =
    await db.productImage.findMany({
      where: {
        productId: {
          in: productIds,
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        productId: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        finishValueId: true,
        finishValue: {
          select: {
            value: true,
            option: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    })

  for (const record of records) {
    const images =
      metadataByProductId.get(
        record.productId,
      ) ?? []
    images.push({
      id: record.id,
      url: record.url,
      altText: record.altText,
      sortOrder: record.sortOrder,
      isPrimary: record.isPrimary,
      finish:
        record.finishValue?.option.code ===
        'finish'
          ? record.finishValue.value
          : null,
      finishValueId:
        record.finishValue?.option.code ===
        'finish'
          ? record.finishValueId
          : null,
    })
    metadataByProductId.set(
      record.productId,
      images,
    )
  }

  return metadataByProductId
}

function toCatalogProduct(
  product: CatalogProductRecord,
  imageMetadata: ProductImageMetadata[] = [],
): CatalogProduct {
  const sellableVariants =
    (product.variants ?? []).filter(
      (variant) => variant.isActive,
    )

  const hasVariants =
    sellableVariants.length > 0

  // O preço de listagem é a variante ativa mais barata.
  // Sem variantes ativas não há preço de listagem: usa-se 0
  // para manter a forma da resposta (o produto não aparece
  // como comprável no storefront).
  const price = hasVariants
    ? Math.min(
        ...sellableVariants.map((variant) =>
          Number(variant.price),
        ),
      )
    : 0

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price,
    inStock: hasVariants
      ? sellableVariants.some(
          (variant) =>
            variant.stockQuantity > 0,
        )
      : false,
    images: product.images,
    ...(imageMetadata.length > 0
      ? { imageMetadata }
      : {}),
    ...(product.defaultFinish
      ? {
          defaultFinish:
            product.defaultFinish,
        }
      : {}),
    category: product.category,
    brand: product.brand,
    variants: sortVariants(
      sellableVariants,
    ).map(toCatalogVariant),
  }
}

function toCatalogCategory(
  category: CatalogCategoryRecord,
): CatalogCategory {
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    slug: category.slug,
    description: category.description,
  }
}

function toCatalogBrand(
  brand: CatalogBrandRecord,
): CatalogBrand {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
  }
}

function toCatalogVehicleSpec(
  spec: CatalogVehicleCompatibilityRecord['vehicleSpec'],
): CatalogVehicleSpec {
  return {
    id: spec.id,
    engine: spec.engine,
    engineCode: spec.engineCode,
    yearStart: spec.yearStart,
    yearEnd: spec.yearEnd,
    fuelType: spec.fuelType,
    powerHp:
      spec.powerHp === null
        ? null
        : Number(
            spec.powerHp.toString(),
          ),
    model: {
      id: spec.model.id,
      name: spec.model.name,
      make: {
        id: spec.model.make.id,
        name: spec.model.make.name,
      },
    },
  }
}

async function getCategoryRecords(
  db: CatalogClient,
) {
  return db.category.findMany({
    orderBy: {
      name: 'asc',
    },
    select: {
      id: true,
      parentId: true,
      name: true,
      slug: true,
      description: true,
      _count: {
        select: {
          products: {
            where: {
              isActive: true,
            },
          },
        },
      },
    },
  })
}

function getCategoryAndDescendantIds(
  categories: CatalogCategoryRecord[],
  rootCategoryId: string,
) {
  const categoryIds = new Set<string>([
    rootCategoryId,
  ])

  let foundNewCategory = true

  while (foundNewCategory) {
    foundNewCategory = false

    for (const category of categories) {
      if (
        category.parentId &&
        categoryIds.has(category.parentId) &&
        !categoryIds.has(category.id)
      ) {
        categoryIds.add(category.id)
        foundNewCategory = true
      }
    }
  }

  return Array.from(categoryIds)
}

function normalizeIdList(
  values: string[] | undefined,
) {
  if (!values) {
    return []
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  )
}

function normalizeBrandSlugs(
  brandSlugs: string[] | undefined,
) {
  if (!brandSlugs) {
    return []
  }

  return Array.from(
    new Set(
      brandSlugs
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0),
    ),
  )
}

function normalizePriceBound(
  value: number | undefined,
) {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return undefined
  }

  return value
}

function getPriceFilter(
  priceMin: number | undefined,
  priceMax: number | undefined,
) {
  const normalizedPriceMin =
    normalizePriceBound(priceMin)

  const normalizedPriceMax =
    normalizePriceBound(priceMax)

  if (
    normalizedPriceMin !== undefined &&
    normalizedPriceMax !== undefined &&
    normalizedPriceMin >
      normalizedPriceMax
  ) {
    return undefined
  }

  if (
    normalizedPriceMin === undefined &&
    normalizedPriceMax === undefined
  ) {
    return undefined
  }

  return {
    ...(normalizedPriceMin !== undefined
      ? {
          gte: normalizedPriceMin,
        }
      : {}),
    ...(normalizedPriceMax !== undefined
      ? {
          lte: normalizedPriceMax,
        }
      : {}),
  }
}

function normalizeVariantSelections(
  variantSelections:
    | CatalogVariantSelection[]
    | undefined,
): CatalogVariantSelection[] {
  if (!variantSelections) {
    return []
  }

  const valuesByCode = new Map<
    string,
    Set<string>
  >()

  for (const selection of variantSelections) {
    const code = selection.code.trim()

    if (!code) {
      continue
    }

    let values = valuesByCode.get(code)

    if (!values) {
      values = new Set()

      valuesByCode.set(code, values)
    }

    for (const value of selection.values) {
      const normalizedValue =
        value.trim()

      if (normalizedValue) {
        values.add(normalizedValue)
      }
    }
  }

  return Array.from(
    valuesByCode.entries(),
  )
    .filter(
      ([, values]) => values.size > 0,
    )
    .map(([code, values]) => ({
      code,
      values: Array.from(values),
    }))
}

/**
 * Deriva as facetas de opções de variante a partir dos
 * produtos reais do catálogo (sem listas fixas de
 * valores). Os valores vêm sempre das variantes ativas
 * dos produtos devolvidos e a contagem de cada valor só
 * inclui produtos quando existe uma variante real que
 * combina esse valor com a seleção atual dos OUTROS
 * eixos. Os valores do próprio eixo continuam listados
 * (com contagem 0 quando não combinam) para se poder
 * trocar a seleção sem perder as alternativas do mesmo
 * eixo.
 */
function buildVariantFacets(
  products: CatalogProductRecord[],
  variantSelections: CatalogVariantSelection[] = [],
): CatalogVariantFacet[] {
  const facets: CatalogVariantFacet[] = []

  const nameByCode = new Map<
    string,
    string
  >()

  const valuesByCode = new Map<
    string,
    Set<string>
  >()

  const productIdsByCode = new Map<
    string,
    Map<string, Set<string>>
  >()

  // Nomes de eixo e valores reais, a partir das
  // variantes ativas dos produtos devolvidos.
  for (const product of products) {
    for (const variant of product.variants ??
      []) {
      if (!variant.isActive) {
        continue
      }

      for (const selection of variant.selections) {
        const option =
          selection.optionValue.option

        if (!nameByCode.has(option.code)) {
          nameByCode.set(
            option.code,
            option.name,
          )
        }

        let values = valuesByCode.get(
          option.code,
        )

        if (!values) {
          values = new Set()

          valuesByCode.set(
            option.code,
            values,
          )
        }

        values.add(
          selection.optionValue.value,
        )
      }
    }
  }

  for (const product of products) {
    for (const variant of product.variants ??
      []) {
      if (!variant.isActive) {
        continue
      }

      for (const selection of variant.selections) {
        const code =
          selection.optionValue.option.code

        const value =
          selection.optionValue.value

        // Só conta o valor quando a variante
        // combina com a seleção atual dos OUTROS
        // eixos. Dentro do mesmo eixo os valores
        // selecionados são alternativas (OR), por
        // isso a seleção do próprio eixo é ignorada.
        const matchesOtherAxes =
          variantSelections.every(
            (selected) =>
              selected.code === code ||
              variant.selections.some(
                (other) =>
                  other.optionValue.option
                    .code === selected.code &&
                  selected.values.includes(
                    other.optionValue.value,
                  ),
              ),
          )

        if (!matchesOtherAxes) {
          continue
        }

        let countsByValue =
          productIdsByCode.get(code)

        if (!countsByValue) {
          countsByValue = new Map()

          productIdsByCode.set(
            code,
            countsByValue,
          )
        }

        let productIds =
          countsByValue.get(value)

        if (!productIds) {
          productIds = new Set()

          countsByValue.set(
            value,
            productIds,
          )
        }

        productIds.add(product.id)
      }
    }
  }

  for (const [
    code,
    valuesByCodeEntry,
  ] of valuesByCode) {
    const countsByValue =
      productIdsByCode.get(code)

    const values = Array.from(
      valuesByCodeEntry,
    )
      .map(
        (value) => ({
          value: value,
          productCount:
            countsByValue?.get(value)
              ?.size ?? 0,
        }),
      )
      .sort(
        (first, second) =>
          first.value.localeCompare(
            second.value,
            'pt-PT',
            {
              numeric: true,
            },
          ),
      )

    facets.push({
      code,
      name:
        nameByCode.get(code) ?? code,
      values,
    })
  }

  facets.sort((first, second) =>
    first.name.localeCompare(
      second.name,
      'pt-PT',
    ),
  )

  return facets
}

function getCatalogProductOrderBy(
  sort: CatalogSort | undefined,
): CatalogProductOrderBy {
  if (sort === 'newest') {
    return [
      {
        createdAt: 'desc',
      },
      {
        name: 'asc',
      },
    ]
  }

  if (sort === 'name-desc') {
    return {
      name: 'desc',
    }
  }

  // A ordenação por preço já não usa a coluna legada do
  // Product: as linhas são ordenadas em memória pelo preço
  // de listagem calculado (ver sortCatalogProducts).

  return {
    name: 'asc',
  }
}

/**
 * Ordena os produtos pelo preço de listagem calculado a
 * partir das variantes ativas (a variante mais barata).
 * O nome é usado como desempate para manter a ordem
 * estável entre produtos com o mesmo preço.
 */
function sortCatalogProducts(
  products: CatalogProduct[],
  sort: CatalogSort | undefined,
): CatalogProduct[] {
  if (sort !== 'price-asc' && sort !== 'price-desc') {
    return products
  }

  const direction =
    sort === 'price-asc' ? 1 : -1

  return products.slice().sort(
    (first, second) => {
      const priceDifference =
        (first.price - second.price) * direction

      if (priceDifference !== 0) {
        return priceDifference
      }

      return first.name.localeCompare(
        second.name,
      )
    },
  )
}

function compareVehicleSpecs(
  first: CatalogVehicleSpec,
  second: CatalogVehicleSpec,
) {
  const firstBrand =
    first.model.make.name

  const secondBrand =
    second.model.make.name

  const brandComparison =
    firstBrand.localeCompare(secondBrand)

  if (brandComparison !== 0) {
    return brandComparison
  }

  const modelComparison =
    first.model.name.localeCompare(
      second.model.name,
    )

  if (modelComparison !== 0) {
    return modelComparison
  }

  const engineComparison =
    first.engine.localeCompare(
      second.engine,
    )

  if (engineComparison !== 0) {
    return engineComparison
  }

  return first.yearStart - second.yearStart
}

async function listCatalogVehicleSpecs(
  db: CatalogClient,
  categoryIds: string[],
) {
  if (!db.productCompatibility) {
    return []
  }

  const compatibilities =
    (
      await db.productCompatibility.findMany({
        where: {
          product: {
            isActive: true,
            categoryId: {
              in: categoryIds,
            },
          },
        },
        select: {
          vehicleSpec: {
            select: {
              id: true,
              engine: true,
              engineCode: true,
              yearStart: true,
              yearEnd: true,
              fuelType: true,
              powerHp: true,
              model: {
                select: {
                  id: true,
                  name: true,
                  make: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    ) as CatalogVehicleCompatibilityRecord[]

  const specsById =
    new Map<
      string,
      CatalogVehicleSpec
    >()

  for (const compatibility of compatibilities) {
    const spec =
      compatibility.vehicleSpec

    if (specsById.has(spec.id)) {
      continue
    }

    specsById.set(
      spec.id,
      toCatalogVehicleSpec(spec),
    )
  }

  return Array.from(
    specsById.values(),
  ).sort(compareVehicleSpecs)
}

export async function listCatalogProducts(
  client?: CatalogClient,
): Promise<CatalogProduct[]> {
  const db = getClient(client)

  const products = await db.product.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
    select: catalogProductSelect,
  })

  const metadataByProductId =
    await getCatalogImageMetadata(
      db,
      products.map((product) => product.id),
    )

  return products.map((product) =>
    toCatalogProduct(
      product,
      metadataByProductId.get(
        product.id,
      ),
    ),
  )
}

export async function getCatalogProductBySlug(
  slug: string,
  client?: CatalogClient,
): Promise<CatalogProductDetail | null> {
  const normalizedSlug = slug.trim()

  if (!normalizedSlug) {
    return null
  }

  const db = getClient(client)

  const product =
    await db.product.findFirst({
      where: {
        slug: normalizedSlug,
        isActive: true,
      },
      select: {
        ...catalogProductSelect,
        sku: true,
      },
    })

  if (!product) {
    return null
  }

  const metadataByProductId =
    await getCatalogImageMetadata(
      db,
      [product.id],
    )

  return {
    ...toCatalogProduct(
      product,
      metadataByProductId.get(product.id),
    ),
    sku: product.sku,
  }
}

export function getCatalogCategoryPageBySlug(
  slug: string,
  client?: CatalogClient,
): Promise<CatalogCategoryPage | null>

export function getCatalogCategoryPageBySlug(
  slug: string,
  filters: CatalogCategoryFilters,
  client?: CatalogClient,
): Promise<CatalogCategoryPage | null>

export async function getCatalogCategoryPageBySlug(
  slug: string,
  filtersOrClient?:
    | CatalogCategoryFilters
    | CatalogClient,
  maybeClient?: CatalogClient,
): Promise<CatalogCategoryPage | null> {
  const normalizedSlug = slug.trim()

  if (!normalizedSlug) {
    return null
  }

  const filters: CatalogCategoryFilters =
    isCatalogClient(filtersOrClient)
      ? {}
      : filtersOrClient ?? {}

  const client = isCatalogClient(
    filtersOrClient,
  )
    ? filtersOrClient
    : maybeClient

  const db = getClient(client)

  const categories =
    await getCategoryRecords(db)

  const category = categories.find(
    (item) =>
      item.slug === normalizedSlug,
  )

  if (!category) {
    return null
  }

  const categoryIds =
    getCategoryAndDescendantIds(
      categories,
      category.id,
    )

  const categoryIdSet =
    new Set(categoryIds)

  const hasActiveProductsInTree =
    categories.some(
      (item) =>
        categoryIdSet.has(item.id) &&
        item._count.products > 0,
    )

  const [
    brands,
    vehicleSpecs,
  ] = await Promise.all([
    db.productBrand.findMany({
      where: {
        products: {
          some: {
            isActive: true,
            categoryId: {
              in: categoryIds,
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    listCatalogVehicleSpecs(
      db,
      categoryIds,
    ),
  ])

  const normalizedBrandSlugs =
    normalizeBrandSlugs(
      filters.brandSlugs,
    )

  const selectedBrandIds =
    normalizedBrandSlugs.length === 0
      ? []
      : brands
          .filter((brand) =>
            normalizedBrandSlugs.includes(
              brand.slug,
            ),
          )
          .map((brand) => brand.id)

  const normalizedVehicleMakeIds =
    normalizeIdList(
      filters.vehicleMakeIds,
    )

  const normalizedVehicleModelIds =
    normalizeIdList(
      filters.vehicleModelIds,
    )

  const normalizedVehicleSpecIds =
    normalizeIdList(
      filters.vehicleSpecIds,
    )

  const where: CatalogProductFindManyArgs['where'] =
    {
      isActive: true,
      categoryId: {
        in: categoryIds,
      },
    }

  if (filters.inStockOnly) {
    // O stock de listagem vem das variantes: basta uma
    // variante ativa com stock para o produto estar
    // disponível.
    where.variants = {
      some: {
        isActive: true,
        stockQuantity: {
          gt: 0,
        },
      },
    }
  }

  if (normalizedBrandSlugs.length > 0) {
    where.productBrandId = {
      in: selectedBrandIds,
    }
  }

  const priceFilter = getPriceFilter(
    filters.priceMin,
    filters.priceMax,
  )

  if (priceFilter) {
    // O preço de listagem de um produto é o da variante
    // ativa mais barata: o filtro SQL é avaliado apenas nas
    // variantes ativas.
    where.variants = {
      ...where.variants,
      some: {
        ...where.variants?.some,
        isActive: true,
        price: priceFilter,
      },
    }
  }

  if (
    normalizedVehicleMakeIds.length > 0 ||
    normalizedVehicleModelIds.length > 0 ||
    normalizedVehicleSpecIds.length > 0
  ) {
    where.compatibilities = {
      some: {
        OR: [
          ...(normalizedVehicleMakeIds.length >
          0
            ? [
                {
                  vehicleSpec: {
                    model: {
                      makeId: {
                        in:
                          normalizedVehicleMakeIds,
                      },
                    },
                  },
                },
              ]
            : []),
          ...(normalizedVehicleModelIds.length >
          0
            ? [
                {
                  vehicleSpec: {
                    modelId: {
                      in:
                        normalizedVehicleModelIds,
                    },
                  },
                },
              ]
            : []),
          ...(normalizedVehicleSpecIds
            .length > 0
            ? [
                {
                  vehicleSpecId: {
                    in:
                      normalizedVehicleSpecIds,
                  },
                },
              ]
            : []),
        ],
      },
    }
  }

  // Filtros por opções de variante (ex.:
  // diameter=19", pcd=5x112, front_drop_mm=40). Uma
  // variante só corresponde se tiver um dos valores
  // selecionados de cada eixo escolhido (OR dentro do
  // eixo) e valores de todos os eixos selecionados (AND
  // entre eixos: a mesma variante tem de combinar uma
  // configuração que existe mesmo no catálogo).
  const variantSelections =
    normalizeVariantSelections(
      filters.variantSelections,
    )

  let productWhere: CatalogProductFindManyArgs['where'] =
    where

  if (variantSelections.length > 0) {
    productWhere = {
      ...where,
      variants: {
        some: {
          ...(where.variants?.some ?? {}),
          isActive: true,
          AND: variantSelections.map(
            (selection) => ({
              selections: {
                some: {
                  optionValue: {
                    value: {
                      in: selection.values,
                    },
                    option: {
                      code: selection.code,
                    },
                  },
                },
              },
            }),
          ),
        },
      },
    }
  }

  const orderBy =
    getCatalogProductOrderBy(
      filters.sort,
    )

  const products =
    await db.product.findMany({
      where: productWhere,
      orderBy,
      select: catalogProductSelect,
    })

  if (
    products.length === 0 &&
    !hasActiveProductsInTree
  ) {
    return null
  }

  const metadataByProductId =
    await getCatalogImageMetadata(
      db,
      products.map((product) => product.id),
    )

  const mappedProducts = products.map(
    (product) =>
      toCatalogProduct(
        product,
        metadataByProductId.get(
          product.id,
        ),
      ),
  )

  return {
    category:
      toCatalogCategory(category),
    brands:
      brands.map(toCatalogBrand),
    vehicleSpecs,
    products: sortCatalogProducts(
      mappedProducts,
      filters.sort,
    ),
  }
}

export async function listCatalogCategories(
  client?: CatalogClient,
): Promise<CatalogCategory[]> {
  const db = getClient(client)

  const categories =
    await getCategoryRecords(db)

  const categoriesById = new Map(
    categories.map((category) => [
      category.id,
      category,
    ]),
  )

  const visibleCategoryIds =
    new Set<string>()

  for (const category of categories) {
    if (category._count.products === 0) {
      continue
    }

    let current:
      | CatalogCategoryRecord
      | undefined = category

    while (current) {
      if (
        visibleCategoryIds.has(current.id)
      ) {
        break
      }

      visibleCategoryIds.add(current.id)

      current = current.parentId
        ? categoriesById.get(
            current.parentId,
          )
        : undefined
    }
  }  return categories
    .filter((category) =>
      visibleCategoryIds.has(category.id),
    )
    .map(toCatalogCategory)
}

export type CatalogVehicleSpecFacet = {
  id: string
  engine: string
  engineCode: string | null
  yearStart: number
  yearEnd: number | null
  fuelType: string
  powerHp: number | null
  modelId: string
  productCount: number
}

export type CatalogVehicleModelFacet = {
  id: string
  name: string
  makeId: string
  productCount: number
  specs: CatalogVehicleSpecFacet[]
}

export type CatalogVehicleMakeFacet = {
  id: string
  name: string
  productCount: number
  models: CatalogVehicleModelFacet[]
}

export type CatalogBrandFacet = CatalogBrand & {
  productCount: number
}

export type CatalogCategoryFacets = {
  inStockCount: number
  brands: CatalogBrandFacet[]
  vehicleMakes: CatalogVehicleMakeFacet[]
  variantFacets: CatalogVariantFacet[]
}

type CatalogProductVehicleRecord = {
  productId: string
  vehicleSpecId: string
  modelId: string
  makeId: string
}

type CatalogFlatCompatibilityRecord = {
  productId: string
  vehicleSpec: {
    id: string
    model: {
      id: string
      make: {
        id: string
      }
    }
  }
}

type CatalogCompatibilityFindManyResult =
  | CatalogVehicleCompatibilityRecord[]
  | CatalogFlatCompatibilityRecord[]

type CatalogVehicleMakeRecord = {
  id: string
  name: string
  models: Array<{
    id: string
    name: string
    specs: Array<{
      id: string
      engine: string
      engineCode: string | null
      yearStart: number
      yearEnd: number | null
      fuelType: string
      powerHp: number | null
    }>
  }>
}

type FacetDimension =
  | 'stock'
  | 'brand'
  | 'price'
  | 'vehicle'
  | 'variant'

function isPriceInRange(
  price: number,
  filters: CatalogCategoryFilters,
) {
  return (
    (filters.priceMin === undefined ||
      price >= filters.priceMin) &&
    (filters.priceMax === undefined ||
      price <= filters.priceMax)
  )
}

/**
 * Espelha a consulta SQL do filtro de preço: alguma
 * variante ativa tem de ter o preço no intervalo, para as
 * contagens nunca divergirem dos resultados.
 */
function getFacetProductPrice(
  product: CatalogProductRecord,
  filters: CatalogCategoryFilters,
) {
  return (product.variants ?? []).some(
    (variant) =>
      variant.isActive &&
      isPriceInRange(
        Number(variant.price),
        filters,
      ),
  )
}

/**
 * Espelha a consulta SQL do filtro de stock: basta uma
 * variante ativa com stock.
 */
function getFacetProductInStock(
  product: CatalogProductRecord,
) {
  return (product.variants ?? []).some(
    (variant) =>
      variant.isActive &&
      variant.stockQuantity > 0,
  )
}

function getFacetProductVehicle(
  product: CatalogProductRecord,
  compatibilitiesByProductId: Map<
    string,
    CatalogProductVehicleRecord[]
  >,
) {
  return (
    compatibilitiesByProductId.get(product.id) ??
    []
  )
}

function matchesVehicleSelection(
  compatibilities: CatalogProductVehicleRecord[],
  makeIds: string[],
  modelIds: string[],
  specIds: string[],
) {
  return compatibilities.some(
    (compatibility) =>
      makeIds.includes(
        compatibility.makeId,
      ) ||
      modelIds.includes(
        compatibility.modelId,
      ) ||
      specIds.includes(
        compatibility.vehicleSpecId,
      ),
  )
}

function matchesVariantSelections(
  product: CatalogProductRecord,
  selections: CatalogVariantSelection[],
) {
  if (selections.length === 0) {
    return true
  }

  return (product.variants ?? []).some(
    (variant) =>
      variant.isActive &&
      selections.every((selection) =>
        variant.selections.some(
          (variantSelection) =>
            variantSelection.optionValue
                .option.code ===
              selection.code &&
            selection.values.includes(
              variantSelection.optionValue
                .value,
            ),
        ),
      ),
  )
}

function matchesFacetFilters(
  product: CatalogProductRecord,
  filters: CatalogCategoryFilters,
  options: {
    compatibilitiesByProductId: Map<
      string,
      CatalogProductVehicleRecord[]
    >
    variantSelections: CatalogVariantSelection[]
    makeIds: string[]
    modelIds: string[]
    specIds: string[]
    skip?: FacetDimension
  },
) {
  const brandSlugs =
    normalizeBrandSlugs(filters.brandSlugs)

  if (
    options.skip !== 'stock' &&
    filters.inStockOnly &&
    !getFacetProductInStock(product)
  ) {
    return false
  }

  if (
    options.skip !== 'brand' &&
    brandSlugs.length > 0 &&
    (!product.brand ||
      !brandSlugs.includes(product.brand.slug))
  ) {
    return false
  }

  if (
    options.skip !== 'price' &&
    !getFacetProductPrice(product, filters)
  ) {
    return false
  }

  if (
    options.skip !== 'vehicle' &&
    (options.makeIds.length > 0 ||
      options.modelIds.length > 0 ||
      options.specIds.length > 0) &&
    !matchesVehicleSelection(
      getFacetProductVehicle(
        product,
        options.compatibilitiesByProductId,
      ),
      options.makeIds,
      options.modelIds,
      options.specIds,
    )
  ) {
    return false
  }

  if (
    options.skip !== 'variant' &&
    !matchesVariantSelections(
      product,
      options.variantSelections,
    )
  ) {
    return false
  }

  return true
}

function countProducts(
  products: CatalogProductRecord[],
  predicate: (
    product: CatalogProductRecord,
  ) => boolean,
) {
  let count = 0

  for (const product of products) {
    if (predicate(product)) {
      count += 1
    }
  }

  return count
}

/**
 * Calcula as contagens de todas as facetas da categoria a
 * partir dos produtos reais. Cada faceta é contada com os
 * restantes filtros aplicados (exceto o seu próprio), para
 * que o número mostrado ao lado de cada opção corresponda
 * aos produtos que essa opção devolve.
 */
export function buildCategoryFacets({
  products,
  compatibilities,
  vehicleMakes,
  filters,
}: {
  products: CatalogProductRecord[]
  compatibilities: CatalogProductVehicleRecord[]
  vehicleMakes: CatalogVehicleMakeRecord[]
  filters: CatalogCategoryFilters
}): CatalogCategoryFacets {
  const compatibilitiesByProductId =
    new Map<
      string,
      CatalogProductVehicleRecord[]
    >()

  for (const compatibility of compatibilities) {
    const current =
      compatibilitiesByProductId.get(
        compatibility.productId,
      ) ?? []

    current.push(compatibility)

    compatibilitiesByProductId.set(
      compatibility.productId,
      current,
    )
  }

  const variantSelections =
    normalizeVariantSelections(
      filters.variantSelections,
    )

  const specIds = normalizeIdList(
    filters.vehicleSpecIds,
  )

  const modelIds = normalizeIdList(
    filters.vehicleModelIds,
  )

  const makeIds = normalizeIdList(
    filters.vehicleMakeIds,
  )

  const matchOptions = {
    compatibilitiesByProductId,
    variantSelections,
    makeIds,
    modelIds,
    specIds,
  }

  const matches = (
    product: CatalogProductRecord,
    skip?: FacetDimension,
  ) =>
    matchesFacetFilters(
      product,
      filters,
      skip
        ? { ...matchOptions, skip }
        : matchOptions,
    )

  // Produtos que cumprem tudo menos a variante alimentam
  // as facetas de opção, para que os valores possíveis
  // continuem visíveis quando a seleção atual não tem
  // combinações.
  const productsForVariantFacets =
    products.filter((product) =>
      matches(product, 'variant'),
    )

  const brandIdsBySlug = new Map<string, string>()

  for (const product of products) {
    if (product.brand) {
      brandIdsBySlug.set(
        product.brand.slug,
        product.brand.id,
      )
    }
  }

  const brands: CatalogBrandFacet[] = Array.from(
    brandIdsBySlug.entries(),
  )
    .map(([slug, id]) => {
      const brand =
        products.find(
          (product) =>
            product.brand?.id === id,
        )?.brand

      return {
        id,
        name: brand?.name ?? slug,
        slug,
        productCount: countProducts(
          products,
          (product) =>
            product.brand?.slug === slug &&
            matches(product, 'brand'),
        ),
      }
    })
    .sort((first, second) =>
      first.name.localeCompare(
        second.name,
        'pt-PT',
      ),
    )

  const vehicleMakeFacets: CatalogVehicleMakeFacet[] =
    vehicleMakes
      .map((make) => {
        const models = (make.models ?? []).map((model) => {
            const specs = (model.specs ?? []).map(
                (spec) => ({
                  id: spec.id,
                  engine: spec.engine,
                  engineCode: spec.engineCode,
                  yearStart: spec.yearStart,
                  yearEnd: spec.yearEnd,
                  fuelType: spec.fuelType,
                  powerHp: spec.powerHp,
                  modelId: model.id,
                  productCount:
                    countProducts(
                      products,
                      (product) =>
                        matches(
                          product,
                          'vehicle',
                        ) &&
                        getFacetProductVehicle(
                          product,
                          compatibilitiesByProductId,
                        ).some(
                          (compatibility) =>
                            compatibility
                              .vehicleSpecId ===
                              spec.id,
                        ),
                    ),
                }),
              )
              .sort(
                (first, second) =>
                  first.engine.localeCompare(
                    second.engine,
                    'pt-PT',
                  ) ||
                  first.yearStart -
                    second.yearStart,
              )

            return {
              id: model.id,
              name: model.name,
              makeId: make.id,
              productCount:
                countProducts(
                  products,
                  (product) =>
                    matches(
                      product,
                      'vehicle',
                    ) &&
                    getFacetProductVehicle(
                      product,
                      compatibilitiesByProductId,
                    ).some(
                      (compatibility) =>
                        compatibility
                          .modelId ===
                        model.id,
                    ),
                ),
              specs,
            }
          })
          .sort((first, second) =>
            first.name.localeCompare(
              second.name,
              'pt-PT',
            ),
          )

        return {
          id: make.id,
          name: make.name,
          productCount:
            countProducts(
              products,
              (product) =>
                matches(product, 'vehicle') &&
                getFacetProductVehicle(
                  product,
                  compatibilitiesByProductId,
                ).some(
                  (compatibility) =>
                    compatibility
                      .makeId ===
                    make.id,
                ),
            ),
          models,
        }
      })
      .sort((first, second) =>
        first.name.localeCompare(
          second.name,
          'pt-PT',
        ),
      )

  return {
    inStockCount: countProducts(
      products,
      (product) =>
        getFacetProductInStock(product) &&
        matches(product, 'stock'),
    ),
    brands,
    vehicleMakes: vehicleMakeFacets,
    variantFacets: buildVariantFacets(
      productsForVariantFacets,
      variantSelections,
    ),
  }
}

export async function getCatalogCategoryFacetsBySlug(
  slug: string,
  filters: CatalogCategoryFilters = {},
  options?: {
    includeVehicleFacets?: boolean
    client?: CatalogClient
  },
): Promise<CatalogCategoryFacets | null> {
  const normalizedSlug = slug.trim()

  if (!normalizedSlug) {
    return null
  }

  const db = getClient(options?.client)

  const categories = await getCategoryRecords(db)

  const category = categories.find(
    (item) => item.slug === normalizedSlug,
  )

  if (!category) {
    return null
  }

  // Jantes não mostram filtros de veículo (a
  // compatibilidade vem das especificações da variante),
  // por isso nem sequer consultamos a árvore de veículos
  // para esta categoria.
  const includeVehicleFacets =
    options?.includeVehicleFacets ??
    shouldShowVehicleFilter(
      getCategoryFilterProfile(category),
    )

  const categoryIds =
    getCategoryAndDescendantIds(
      categories,
      category.id,
    )

  const products = await db.product.findMany({
    where: {
      isActive: true,
      categoryId: {
        in: categoryIds,
      },
    },
    orderBy: {
      name: 'asc',
    },
    select: catalogProductSelect,
  })

  const [compatibilityRows, vehicleMakeRecords] =
    await Promise.all([
      db.productCompatibility
        ? (db.productCompatibility.findMany(
            {
              where: {
                product: {
                  isActive: true,
                  categoryId: {
                    in: categoryIds,
                  },
                },
              },
              select: {
                productId: true,
                vehicleSpec: {
                  select: {
                    id: true,
                    model: {
                      select: {
                        id: true,
                        make: {
                          select: {
                            id: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ) as Promise<
            CatalogFlatCompatibilityRecord[]
          >)
        : Promise.resolve([]),
      db.vehicleMake && includeVehicleFacets
        ? db.vehicleMake.findMany({
            orderBy: { name: 'asc' as const },
            select: {
              id: true,
              name: true,
              models: {
                orderBy: { name: 'asc' as const },
                select: {
                  id: true,
                  name: true,
                  specs: {
                    orderBy: [
                      { engine: 'asc' as const },
                      {
                        yearStart:
                          'asc' as const,
                      },
                    ],
                    select: {
                      id: true,
                      engine: true,
                      engineCode: true,
                      yearStart: true,
                      yearEnd: true,
                      fuelType: true,
                      powerHp: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ])

  // Aplaina os registos: cada compatibilidade fica com
  // os ids de make/model/spec que as facetas consultam.
  const compatibilities: CatalogProductVehicleRecord[] =
    compatibilityRows.map((row) => ({
      productId: row.productId,
      vehicleSpecId: row.vehicleSpec.id,
      modelId: row.vehicleSpec.model.id,
      makeId: row.vehicleSpec.model.make.id,
    }))

  return buildCategoryFacets({
    products,
    compatibilities,
    vehicleMakes:
      vehicleMakeRecords as CatalogVehicleMakeRecord[],
    filters,
  })
}
