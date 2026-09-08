import { prisma } from './db'

type CatalogPrice =
  | number
  | string
  | {
      toString(): string
    }

type CatalogProductRecord = {
  id: string
  name: string
  slug: string
  description: string | null
  price: CatalogPrice
  stockQuantity: number
  images: string[]
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
}

type CatalogProductDetailRecord =
  CatalogProductRecord & {
    sku: string
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
  vehicleConfiguration: {
    id: string
    name: string
    engineCode: string | null
    engineType: string | null
    displacementCc: number | null
    powerKw: CatalogPrice | null
    bodyType: string | null
    yearFrom: number | null
    yearTo: number | null
    generation: {
      id: string
      name: string
      model: {
        id: string
        name: string
        brand: {
          id: string
          name: string
        }
      }
    }
  } | null
}

export type CatalogProduct = {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  inStock: boolean
  images: string[]
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

export type CatalogVehicleConfiguration = {
  id: string
  name: string
  engineCode: string | null
  engineType: string | null
  displacementCc: number | null
  powerKw: number | null
  bodyType: string | null
  yearFrom: number | null
  yearTo: number | null
  generation: {
    id: string
    name: string
    model: {
      id: string
      name: string
      brand: {
        id: string
        name: string
      }
    }
  }
}

export type CatalogCategoryPage = {
  category: CatalogCategory
  brands: CatalogBrand[]
  vehicleConfigurations:
    CatalogVehicleConfiguration[]
  products: CatalogProduct[]
}

export type CatalogCategoryFilters = {
  inStockOnly?: boolean
  brandSlugs?: string[]
  priceMin?: number
  priceMax?: number
  vehicleConfigurationId?: string
}

type CatalogProductFindManyArgs = {
  where: {
    isActive: true
    categoryId?: {
      in: string[]
    }
    stockQuantity?: {
      gt: number
    }
    productBrandId?: {
      in: string[]
    }
    price?: {
      gte?: number
      lte?: number
    }
    compatibilities?: {
      some: {
        vehicleConfigurationId: string
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
    description: true
    price: true
    stockQuantity: true
    images: true
    category: {
      select: {
        id: true
        name: true
        slug: true
      }
    }
    brand: {
      select: {
        id: true
        name: true
        slug: true
      }
    }
  }
}

export interface CatalogClient {
  product: {
    findMany(
      args: CatalogProductFindManyArgs,
    ): Promise<CatalogProductRecord[]>

    findFirst(args: {
      where: {
        slug: string
        isActive: true
      }
      select: {
        id: true
        name: true
        slug: true
        sku: true
        description: true
        price: true
        stockQuantity: true
        images: true
        category: {
          select: {
            id: true
            name: true
            slug: true
          }
        }
        brand: {
          select: {
            id: true
            name: true
            slug: true
          }
        }
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

  productVehicleCompatibility?: {
    findMany(args: {
      where: {
        product: {
          isActive: true
          categoryId: {
            in: string[]
          }
        }
        vehicleConfigurationId: {
          not: null
        }
      }
      select: {
        vehicleConfiguration: {
          select: {
            id: true
            name: true
            engineCode: true
            engineType: true
            displacementCc: true
            powerKw: true
            bodyType: true
            yearFrom: true
            yearTo: true
            generation: {
              select: {
                id: true
                name: true
                model: {
                  select: {
                    id: true
                    name: true
                    brand: {
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
      }
    }): Promise<
      CatalogVehicleCompatibilityRecord[]
    >
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

function toCatalogProduct(
  product: CatalogProductRecord,
): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    inStock: product.stockQuantity > 0,
    images: product.images,
    category: product.category,
    brand: product.brand,
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

function toCatalogVehicleConfiguration(
  configuration: NonNullable<
    CatalogVehicleCompatibilityRecord[
      'vehicleConfiguration'
    ]
  >,
): CatalogVehicleConfiguration {
  return {
    id: configuration.id,
    name: configuration.name,
    engineCode: configuration.engineCode,
    engineType: configuration.engineType,
    displacementCc:
      configuration.displacementCc,
    powerKw:
      configuration.powerKw === null
        ? null
        : Number(
            configuration.powerKw.toString(),
          ),
    bodyType: configuration.bodyType,
    yearFrom: configuration.yearFrom,
    yearTo: configuration.yearTo,
    generation: {
      id: configuration.generation.id,
      name: configuration.generation.name,
      model: {
        id: configuration.generation.model.id,
        name:
          configuration.generation.model.name,
        brand: {
          id:
            configuration.generation.model.brand
              .id,
          name:
            configuration.generation.model.brand
              .name,
        },
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

function normalizeVehicleConfigurationId(
  value: string | undefined,
) {
  if (value === undefined) {
    return undefined
  }

  const normalizedValue = value.trim()

  return normalizedValue.length > 0
    ? normalizedValue
    : undefined
}

function compareVehicleConfigurations(
  first: CatalogVehicleConfiguration,
  second: CatalogVehicleConfiguration,
) {
  const firstBrand =
    first.generation.model.brand.name

  const secondBrand =
    second.generation.model.brand.name

  const brandComparison =
    firstBrand.localeCompare(secondBrand)

  if (brandComparison !== 0) {
    return brandComparison
  }

  const modelComparison =
    first.generation.model.name.localeCompare(
      second.generation.model.name,
    )

  if (modelComparison !== 0) {
    return modelComparison
  }

  const generationComparison =
    first.generation.name.localeCompare(
      second.generation.name,
    )

  if (generationComparison !== 0) {
    return generationComparison
  }

  return first.name.localeCompare(second.name)
}

async function listCatalogVehicleConfigurations(
  db: CatalogClient,
  categoryIds: string[],
) {
  if (!db.productVehicleCompatibility) {
    return []
  }

  const compatibilities =
    await db.productVehicleCompatibility.findMany({
      where: {
        product: {
          isActive: true,
          categoryId: {
            in: categoryIds,
          },
        },
        vehicleConfigurationId: {
          not: null,
        },
      },
      select: {
        vehicleConfiguration: {
          select: {
            id: true,
            name: true,
            engineCode: true,
            engineType: true,
            displacementCc: true,
            powerKw: true,
            bodyType: true,
            yearFrom: true,
            yearTo: true,
            generation: {
              select: {
                id: true,
                name: true,
                model: {
                  select: {
                    id: true,
                    name: true,
                    brand: {
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
        },
      },
    })

  const configurationsById =
    new Map<
      string,
      CatalogVehicleConfiguration
    >()

  for (const compatibility of compatibilities) {
    const configuration =
      compatibility.vehicleConfiguration

    if (!configuration) {
      continue
    }

    if (
      configurationsById.has(
        configuration.id,
      )
    ) {
      continue
    }

    configurationsById.set(
      configuration.id,
      toCatalogVehicleConfiguration(
        configuration,
      ),
    )
  }

  return Array.from(
    configurationsById.values(),
  ).sort(compareVehicleConfigurations)
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
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      stockQuantity: true,
      images: true,
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
    },
  })

  return products.map(toCatalogProduct)
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
        id: true,
        name: true,
        slug: true,
        sku: true,
        description: true,
        price: true,
        stockQuantity: true,
        images: true,
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
      },
    })

  if (!product) {
    return null
  }

  return {
    ...toCatalogProduct(product),
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
    vehicleConfigurations,
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
    listCatalogVehicleConfigurations(
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

  const normalizedVehicleConfigurationId =
    normalizeVehicleConfigurationId(
      filters.vehicleConfigurationId,
    )

  const where: CatalogProductFindManyArgs['where'] =
    {
      isActive: true,
      categoryId: {
        in: categoryIds,
      },
    }

  if (filters.inStockOnly) {
    where.stockQuantity = {
      gt: 0,
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
    where.price = priceFilter
  }

  if (normalizedVehicleConfigurationId) {
    where.compatibilities = {
      some: {
        vehicleConfigurationId:
          normalizedVehicleConfigurationId,
      },
    }
  }

  const products =
    await db.product.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        stockQuantity: true,
        images: true,
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
      },
    })

  if (
    products.length === 0 &&
    !hasActiveProductsInTree
  ) {
    return null
  }

  return {
    category:
      toCatalogCategory(category),
    brands:
      brands.map(toCatalogBrand),
    vehicleConfigurations,
    products:
      products.map(toCatalogProduct),
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
  }

  return categories
    .filter((category) =>
      visibleCategoryIds.has(category.id),
    )
    .map(toCatalogCategory)
}