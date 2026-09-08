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

export type GuestCartInputItem = {
  productId: string
  quantity: number
}

export type ResolvedGuestCartItem = {
  productId: string
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string[]
  } | null
  inStock: boolean
  isAvailable: boolean
  canIncrease: boolean
}

export class GuestCartServerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name =
      'GuestCartServerValidationError'
  }
}

export interface GuestCartClient {
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

export function normalizeGuestCartInputItems(
  items: GuestCartInputItem[],
): GuestCartInputItem[] {
  if (items.length > 100) {
    throw new GuestCartServerValidationError(
      'Carrinho demasiado grande',
    )
  }

  const quantitiesByProductId =
    new Map<string, number>()

  for (const item of items) {
    const productId =
      normalizeProductId(
        item.productId,
      )

    validateQuantity(
      item.quantity,
    )

    const currentQuantity =
      quantitiesByProductId.get(
        productId,
      ) ?? 0

    const nextQuantity =
      currentQuantity +
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

    quantitiesByProductId.set(
      productId,
      nextQuantity,
    )
  }

  return Array.from(
    quantitiesByProductId,
    ([productId, quantity]) => ({
      productId,
      quantity,
    }),
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