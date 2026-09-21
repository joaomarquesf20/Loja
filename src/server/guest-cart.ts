import { prisma } from './db'

type GuestCartPrice =
  | number
  | string
  | {
      toString(): string
    }

type GuestCartProductRecord = {
  id: string
  name: string
  slug: string
  price: GuestCartPrice
  stockQuantity: number
  isActive: boolean
  images: string[]
}

type GuestCartVariantRecord = {
  id: string
  productId: string
  sku: string
  optionKey: string
  price: GuestCartPrice
  stockQuantity: number
  isActive: boolean
  images: string[]
  product: {
    id: string
    name: string
    slug: string
    isActive: boolean
    images: string[]
  }
}

export type GuestCartInputItem = {
  productId: string
  productVariantId?: string
  quantity: number
}

export type ResolvedGuestCartItem = {
  productId: string
  productVariantId?: string
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string[]
  } | null
  variant?: {
    id: string
    sku: string
  }
  inStock: boolean
  isAvailable: boolean
  canIncrease: boolean
}

type ProductVariantDelegate = {
  findMany(args: {
    where: Record<string, unknown>
    orderBy: Array<
      | { product: { name: 'asc' } }
      | { position: 'asc' }
      | { id: 'asc' }
    >
    select: {
      id: true
      productId: true
      sku: true
      optionKey: true
      price: true
      stockQuantity: true
      isActive: true
      images: true
      product: {
        select: {
          id: true
          name: true
          slug: true
          isActive: true
          images: true
        }
      }
    }
  }): Promise<GuestCartVariantRecord[]>
}

export class GuestCartServerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name =
      'GuestCartServerValidationError'
  }
}

export interface GuestCartClient {
  productVariant?: ProductVariantDelegate

  product: {
    findMany(args: {
      where: {
        id: {
          in: string[]
        }
      }
      orderBy: {
        name: 'asc'
      }
      select: {
        id: true
        name: true
        slug: true
        price: true
        stockQuantity: true
        isActive: true
        images: true
      }
    }): Promise<
      GuestCartProductRecord[]
    >
  }
}

function getClient(
  client?: GuestCartClient,
): GuestCartClient {
  return (
    client ??
    (prisma as unknown as GuestCartClient)
  )
}

function normalizeProductId(
  productId: string,
) {
  const normalizedProductId =
    productId.trim()

  if (!normalizedProductId) {
    throw new GuestCartServerValidationError(
      'Produto inválido',
    )
  }

  return normalizedProductId
}

function normalizeVariantId(
  productVariantId:
    | string
    | undefined,
) {
  if (productVariantId === undefined) {
    return undefined
  }

  const normalized =
    productVariantId.trim()

  if (!normalized) {
    throw new GuestCartServerValidationError(
      'Variante inválida',
    )
  }

  return normalized
}

function validateQuantity(
  quantity: number,
) {
  if (
    !Number.isSafeInteger(
      quantity,
    ) ||
    quantity <= 0
  ) {
    throw new GuestCartServerValidationError(
      'Quantidade inválida',
    )
  }
}

function getGuestItemKey(
  item: GuestCartInputItem,
) {
  return item.productVariantId
    ? `variant:${item.productVariantId}`
    : `product:${item.productId}`
}

export function normalizeGuestCartInputItems(
  items: GuestCartInputItem[],
): GuestCartInputItem[] {
  if (items.length > 100) {
    throw new GuestCartServerValidationError(
      'Carrinho demasiado grande',
    )
  }

  const normalizedByKey =
    new Map<string, GuestCartInputItem>()

  for (const item of items) {
    const productId =
      normalizeProductId(
        item.productId,
      )

    const productVariantId =
      normalizeVariantId(
        item.productVariantId,
      )

    validateQuantity(
      item.quantity,
    )

    const normalizedItem: GuestCartInputItem =
      {
        productId,
        ...(productVariantId
          ? { productVariantId }
          : {}),
        quantity: item.quantity,
      }

    const key =
      getGuestItemKey(
        normalizedItem,
      )

    const current =
      normalizedByKey.get(key)

    const nextQuantity =
      (current?.quantity ?? 0) +
      item.quantity

    if (
      !Number.isSafeInteger(
        nextQuantity,
      )
    ) {
      throw new GuestCartServerValidationError(
        'Quantidade inválida',
      )
    }

    normalizedByKey.set(key, {
      ...normalizedItem,
      quantity: nextQuantity,
    })
  }

  return Array.from(
    normalizedByKey.values(),
  )
}

export async function resolveGuestCartItems(
  items: GuestCartInputItem[],
  client?: GuestCartClient,
): Promise<
  ResolvedGuestCartItem[]
> {
  const normalizedItems =
    normalizeGuestCartInputItems(
      items,
    )

  if (
    normalizedItems.length ===
    0
  ) {
    return []
  }

  const db = getClient(client)

  if (!db.productVariant) {
    const products =
      await db.product.findMany({
        where: {
          id: {
            in: normalizedItems.map(
              (item) =>
                item.productId,
            ),
          },
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          stockQuantity: true,
          isActive: true,
          images: true,
        },
      })

    const productsById =
      new Map(
        products.map(
          (product) => [
            product.id,
            product,
          ],
        ),
      )

    return normalizedItems.map(
      (item) => {
        const product =
          productsById.get(
            item.productId,
          )

        if (!product) {
          return {
            productId:
              item.productId,
            quantity:
              item.quantity,
            product: null,
            inStock: false,
            isAvailable: false,
            canIncrease: false,
          }
        }

        const inStock =
          product.isActive &&
          product.stockQuantity >
            0

        const isAvailable =
          product.isActive &&
          product.stockQuantity >=
            item.quantity

        const canIncrease =
          product.isActive &&
          product.stockQuantity >
            item.quantity

        return {
          productId:
            item.productId,
          quantity:
            item.quantity,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: Number(
              product.price.toString(),
            ),
            images:
              product.images,
          },
          inStock,
          isAvailable,
          canIncrease,
        }
      },
    )
  }

  const explicitVariantIds =
    normalizedItems.flatMap(
      (item) =>
        item.productVariantId
          ? [item.productVariantId]
          : [],
    )

  const legacyProductIds =
    normalizedItems
      .filter(
        (item) =>
          !item.productVariantId,
      )
      .map(
        (item) => item.productId,
      )

  const variants =
    await db.productVariant.findMany({
      where: {
        OR: [
          ...(explicitVariantIds.length
            ? [
                {
                  id: {
                    in:
                      explicitVariantIds,
                  },
                },
              ]
            : []),
          ...(legacyProductIds.length
            ? [
                {
                  productId: {
                    in:
                      legacyProductIds,
                  },
                  optionKey:
                    'default',
                },
              ]
            : []),
        ],
      },
      orderBy: [
        {
          product: {
            name: 'asc',
          },
        },
        {
          position: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      select: {
        id: true,
        productId: true,
        sku: true,
        price: true,
        stockQuantity: true,
        isActive: true,
        images: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            images: true,
          },
        },
      },
    })

  const variantsById =
    new Map(
      variants.map(
        (variant) => [
          variant.id,
          variant,
        ],
      ),
    )

  const defaultsByProductId =
    new Map(
      variants
        .filter(
          (variant) =>
            variant.optionKey ===
              'default' &&
            legacyProductIds.includes(
              variant.productId,
            ),
        )
        .map(
          (variant) => [
            variant.productId,
            variant,
          ],
        ),
    )

  return normalizedItems.map(
    (item) => {
      const variant =
        item.productVariantId
          ? variantsById.get(
              item.productVariantId,
            )
          : defaultsByProductId.get(
              item.productId,
            )

      if (
        !variant ||
        variant.productId !==
          item.productId
      ) {
        return {
          productId:
            item.productId,
          ...(item.productVariantId
            ? {
                productVariantId:
                  item.productVariantId,
              }
            : {}),
          quantity:
            item.quantity,
          product: null,
          inStock: false,
          isAvailable: false,
          canIncrease: false,
        }
      }

      const active =
        variant.product.isActive &&
        variant.isActive

      const inStock =
        active &&
        variant.stockQuantity > 0

      const isAvailable =
        active &&
        variant.stockQuantity >=
          item.quantity

      const canIncrease =
        active &&
        variant.stockQuantity >
          item.quantity

      return {
        productId:
          variant.productId,
        productVariantId:
          variant.id,
        quantity:
          item.quantity,
        product: {
          id: variant.product.id,
          name:
            variant.product.name,
          slug:
            variant.product.slug,
          price: Number(
            variant.price.toString(),
          ),
          images:
            variant.images.length > 0
              ? variant.images
              : variant.product.images,
        },
        variant: {
          id: variant.id,
          sku: variant.sku,
        },
        inStock,
        isAvailable,
        canIncrease,
      }
    },
  )
}
