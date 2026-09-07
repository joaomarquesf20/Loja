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

export type CatalogCategoryPage = {
  category: CatalogCategory
  products: CatalogProduct[]
}

export type CatalogCategoryFilters = {
  inStockOnly?: boolean
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