import { prisma } from './db'

type CartPrice =
  | number
  | string
  | {
      toString(): string
    }

type CartProductRecord = {
  id: string
  name: string
  slug: string
  price: CartPrice
  stockQuantity: number
  isActive: boolean
  images: string[]
}

type CartItemRecord = {
  id: string
  productId: string
  quantity: number
  product: CartProductRecord
}

type ExistingCartItemRecord = {
  id: string
  quantity: number
}

type AddableProductRecord = {
  id: string
  stockQuantity: number
}

type RemovableCartItemRecord = {
  id: string
}

export type CartItem = {
  id: string
  productId: string
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string[]
  }
  inStock: boolean
  isAvailable: boolean
  canIncrease: boolean
}

export class CartValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CartValidationError'
  }
}

export class CartProductUnavailableError extends Error {
  constructor(
    message = 'Produto indisponível',
  ) {
    super(message)
    this.name =
      'CartProductUnavailableError'
  }
}

export class CartInsufficientStockError extends Error {
  constructor(
    message = 'Stock insuficiente',
  ) {
    super(message)
    this.name =
      'CartInsufficientStockError'
  }
}

export class CartItemNotFoundError extends Error {
  constructor(
    message = 'Item do carrinho não encontrado',
  ) {
    super(message)
    this.name = 'CartItemNotFoundError'
  }
}

type CartItemSelect = {
  id: true
  productId: true
  quantity: true
  product: {
    select: {
      id: true
      name: true
      slug: true
      price: true
      stockQuantity: true
      isActive: true
      images: true
    }
  }
}

export interface CartClient {
  product: {
    findFirst(args: {
      where: {
        id: string
        isActive: true
      }
      select: {
        id: true
        stockQuantity: true
      }
    }): Promise<AddableProductRecord | null>
  }

  cartItem: {
    findMany(args: {
      where: {
        userId: string
      }
      orderBy: {
        id: 'asc'
      }
      select: CartItemSelect
    }): Promise<CartItemRecord[]>

    findUnique(args: {
      where: {
        userId_productId: {
          userId: string
          productId: string
        }
      }
      select:
        | {
            id: true
            quantity: true
          }
        | {
            id: true
          }
    }): Promise<
      | ExistingCartItemRecord
      | RemovableCartItemRecord
      | null
    >

    create(args: {
      data: {
        userId: string
        productId: string
        quantity: number
      }
      select: CartItemSelect
    }): Promise<CartItemRecord>

    update(args: {
      where: {
        id: string
      }
      data: {
        quantity: number
      }
      select: CartItemSelect
    }): Promise<CartItemRecord>

    delete(args: {
      where: {
        id: string
      }
      select: {
        id: true
      }
    }): Promise<{
      id: string
    }>
  }
}

const cartItemSelect: CartItemSelect = {
  id: true,
  productId: true,
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      stockQuantity: true,
      isActive: true,
      images: true,
    },
  },
}

function getClient(
  client?: CartClient,
): CartClient {
  return (
    client ??
    (prisma as unknown as CartClient)
  )
}

function normalizeId(
  value: string,
  fieldName: string,
) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new CartValidationError(
      `${fieldName} é obrigatório`,
    )
  }

  return normalizedValue
}

function validateQuantity(
  quantity: number,
) {
  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new CartValidationError(
      'A quantidade deve ser um número inteiro superior a zero',
    )
  }
}

function toCartItem(
  item: CartItemRecord,
): CartItem {
  const inStock =
    item.product.isActive &&
    item.product.stockQuantity > 0

  const isAvailable =
    item.product.isActive &&
    item.product.stockQuantity >=
      item.quantity

  const canIncrease =
    item.product.isActive &&
    item.product.stockQuantity >
      item.quantity

  return {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      price: Number(
        item.product.price.toString(),
      ),
      images: item.product.images,
    },
    inStock,
    isAvailable,
    canIncrease,
  }
}

export async function listCartItems(
  userId: string,
  client?: CartClient,
): Promise<CartItem[]> {
  const normalizedUserId = normalizeId(
    userId,
    'Utilizador',
  )

  const db = getClient(client)

  const items =
    await db.cartItem.findMany({
      where: {
        userId: normalizedUserId,
      },
      orderBy: {
        id: 'asc',
      },
      select: cartItemSelect,
    })

  return items.map(toCartItem)
}

export async function addCartItem(
  userId: string,
  productId: string,
  quantity = 1,
  client?: CartClient,
): Promise<CartItem> {
  const normalizedUserId = normalizeId(
    userId,
    'Utilizador',
  )

  const normalizedProductId =
    normalizeId(
      productId,
      'Produto',
    )

  validateQuantity(quantity)

  const db = getClient(client)

  const product =
    await db.product.findFirst({
      where: {
        id: normalizedProductId,
        isActive: true,
      },
      select: {
        id: true,
        stockQuantity: true,
      },
    })

  if (!product) {
    throw new CartProductUnavailableError()
  }

  if (product.stockQuantity <= 0) {
    throw new CartInsufficientStockError()
  }

  const existingItem =
    await db.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: normalizedUserId,
          productId:
            normalizedProductId,
        },
      },
      select: {
        id: true,
        quantity: true,
      },
    })

  const existingQuantity =
    existingItem &&
    'quantity' in existingItem
      ? existingItem.quantity
      : 0

  const nextQuantity =
    existingQuantity + quantity

  if (
    nextQuantity >
    product.stockQuantity
  ) {
    throw new CartInsufficientStockError()
  }

  if (existingItem) {
    const updatedItem =
      await db.cartItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: nextQuantity,
        },
        select: cartItemSelect,
      })

    return toCartItem(updatedItem)
  }

  const createdItem =
    await db.cartItem.create({
      data: {
        userId: normalizedUserId,
        productId:
          normalizedProductId,
        quantity,
      },
      select: cartItemSelect,
    })

  return toCartItem(createdItem)
}

export async function updateCartItemQuantity(
  userId: string,
  productId: string,
  quantity: number,
  client?: CartClient,
): Promise<CartItem> {
  const normalizedUserId = normalizeId(
    userId,
    'Utilizador',
  )

  const normalizedProductId =
    normalizeId(
      productId,
      'Produto',
    )

  validateQuantity(quantity)

  const db = getClient(client)

  const existingItem =
    await db.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: normalizedUserId,
          productId:
            normalizedProductId,
        },
      },
      select: {
        id: true,
        quantity: true,
      },
    })

  if (!existingItem) {
    throw new CartItemNotFoundError()
  }

  const product =
    await db.product.findFirst({
      where: {
        id: normalizedProductId,
        isActive: true,
      },
      select: {
        id: true,
        stockQuantity: true,
      },
    })

  if (!product) {
    throw new CartProductUnavailableError()
  }

  if (
    quantity >
    product.stockQuantity
  ) {
    throw new CartInsufficientStockError()
  }

  const updatedItem =
    await db.cartItem.update({
      where: {
        id: existingItem.id,
      },
      data: {
        quantity,
      },
      select: cartItemSelect,
    })

  return toCartItem(updatedItem)
}

export async function removeCartItem(
  userId: string,
  productId: string,
  client?: CartClient,
): Promise<void> {
  const normalizedUserId = normalizeId(
    userId,
    'Utilizador',
  )

  const normalizedProductId =
    normalizeId(
      productId,
      'Produto',
    )

  const db = getClient(client)

  const existingItem =
    await db.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: normalizedUserId,
          productId:
            normalizedProductId,
        },
      },
      select: {
        id: true,
      },
    })

  if (!existingItem) {
    throw new CartItemNotFoundError()
  }

  await db.cartItem.delete({
    where: {
      id: existingItem.id,
    },
    select: {
      id: true,
    },
  })
}