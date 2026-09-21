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

type CartVariantRecord = {
  id: string
  productId: string
  sku: string
  price: CartPrice
  stockQuantity: number
  isActive: boolean
  images: string[]
}

type PurchasableVariantRecord =
  CartVariantRecord & {
    product: {
      id: string
      isActive: boolean
    }
  }

type CartItemRecord = {
  id: string
  productId: string
  productVariantId?: string
  quantity: number
  product: CartProductRecord
  variant?: CartVariantRecord
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

export type CartTargetInput =
  | string
  | {
      productId?: string
      productVariantId?: string
    }

export type CartItem = {
  id: string
  productId: string
  productVariantId?: string
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string[]
  }
  variant?: {
    id: string
    sku: string
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
  productVariantId?: true
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
  variant?: {
    select: {
      id: true
      productId: true
      sku: true
      price: true
      stockQuantity: true
      isActive: true
      images: true
    }
  }
}

type ProductVariantDelegate = {
  findFirst(args: {
    where: Record<string, unknown>
    select: {
      id: true
      productId: true
      sku: true
      price: true
      stockQuantity: true
      isActive: true
      images: true
      product: {
        select: {
          id: true
          isActive: true
        }
      }
    }
  }): Promise<PurchasableVariantRecord | null>
}

export interface CartClient {
  productVariant?: ProductVariantDelegate

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
      where:
        | {
            userId_productId: {
              userId: string
              productId: string
            }
          }
        | {
            userId_productVariantId: {
              userId: string
              productVariantId: string
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
        productVariantId?: string
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

const legacyCartItemSelect: CartItemSelect = {
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

const variantCartItemSelect: CartItemSelect = {
  ...legacyCartItemSelect,
  productVariantId: true,
  variant: {
    select: {
      id: true,
      productId: true,
      sku: true,
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

function normalizeTarget(
  target: CartTargetInput,
) {
  if (typeof target === 'string') {
    return {
      productId: normalizeId(
        target,
        'Produto',
      ),
      productVariantId:
        undefined,
    }
  }

  const productId =
    target.productId === undefined
      ? undefined
      : normalizeId(
          target.productId,
          'Produto',
        )

  const productVariantId =
    target.productVariantId ===
    undefined
      ? undefined
      : normalizeId(
          target.productVariantId,
          'Variante',
        )

  if (
    !productId &&
    !productVariantId
  ) {
    throw new CartValidationError(
      'Produto ou variante é obrigatório',
    )
  }

  return {
    productId,
    productVariantId,
  }
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

async function resolveVariant(
  db: CartClient,
  target: CartTargetInput,
  requirePurchasable = true,
) {
  const normalized =
    normalizeTarget(target)

  if (!db.productVariant) {
    if (!normalized.productId) {
      throw new CartProductUnavailableError()
    }

    const product =
      await db.product.findFirst({
        where: {
          id: normalized.productId,
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

    return {
      id: `pv_default_${product.id}`,
      productId: product.id,
      stockQuantity:
        product.stockQuantity,
      isActive: true,
      productActive: true,
      legacy: true as const,
    }
  }

  const where: Record<string, unknown> =
    normalized.productVariantId
      ? {
          id:
            normalized.productVariantId,
        }
      : {
          productId:
            normalized.productId,
          optionKey: 'default',
        }

  const variant =
    await db.productVariant.findFirst({
      where,
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
            isActive: true,
          },
        },
      },
    })

  if (
    !variant ||
    (normalized.productId &&
      variant.productId !==
        normalized.productId)
  ) {
    throw new CartProductUnavailableError()
  }

  if (
    requirePurchasable &&
    (!variant.isActive ||
      !variant.product.isActive)
  ) {
    throw new CartProductUnavailableError()
  }

  return {
    id: variant.id,
    productId: variant.productId,
    stockQuantity:
      variant.stockQuantity,
    isActive: variant.isActive,
    productActive:
      variant.product.isActive,
    legacy: false as const,
  }
}

function toCartItem(
  item: CartItemRecord,
): CartItem {
  const variant = item.variant

  const sellableActive =
    item.product.isActive &&
    (variant?.isActive ?? true)

  const stockQuantity =
    variant?.stockQuantity ??
    item.product.stockQuantity

  const price =
    variant?.price ??
    item.product.price

  const images =
    variant &&
    variant.images.length > 0
      ? variant.images
      : item.product.images

  const inStock =
    sellableActive &&
    stockQuantity > 0

  const isAvailable =
    sellableActive &&
    stockQuantity >=
      item.quantity

  const canIncrease =
    sellableActive &&
    stockQuantity >
      item.quantity

  return {
    id: item.id,
    productId: item.productId,
    ...(item.productVariantId
      ? {
          productVariantId:
            item.productVariantId,
        }
      : {}),
    quantity: item.quantity,
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      price: Number(
        price.toString(),
      ),
      images,
    },
    ...(variant
      ? {
          variant: {
            id: variant.id,
            sku: variant.sku,
          },
        }
      : {}),
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
      select:
        db.productVariant
          ? variantCartItemSelect
          : legacyCartItemSelect,
    })

  return items.map(toCartItem)
}

export async function addCartItem(
  userId: string,
  target: CartTargetInput,
  quantity = 1,
  client?: CartClient,
): Promise<CartItem> {
  const normalizedUserId = normalizeId(
    userId,
    'Utilizador',
  )

  validateQuantity(quantity)

  const db = getClient(client)

  const variant =
    await resolveVariant(
      db,
      target,
      true,
    )

  if (variant.stockQuantity <= 0) {
    throw new CartInsufficientStockError()
  }

  const existingItem =
    await db.cartItem.findUnique({
      where:
        db.productVariant
          ? {
              userId_productVariantId:
                {
                  userId:
                    normalizedUserId,
                  productVariantId:
                    variant.id,
                },
            }
          : {
              userId_productId: {
                userId:
                  normalizedUserId,
                productId:
                  variant.productId,
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
    variant.stockQuantity
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
        select:
          db.productVariant
            ? variantCartItemSelect
            : legacyCartItemSelect,
      })

    return toCartItem(updatedItem)
  }

  const createdItem =
    await db.cartItem.create({
      data: {
        userId: normalizedUserId,
        productId:
          variant.productId,
        ...(db.productVariant
          ? {
              productVariantId:
                variant.id,
            }
          : {}),
        quantity,
      },
      select:
        db.productVariant
          ? variantCartItemSelect
          : legacyCartItemSelect,
    })

  return toCartItem(createdItem)
}

export async function updateCartItemQuantity(
  userId: string,
  target: CartTargetInput,
  quantity: number,
  client?: CartClient,
): Promise<CartItem> {
  const normalizedUserId = normalizeId(
    userId,
    'Utilizador',
  )

  validateQuantity(quantity)

  const db = getClient(client)

  const variant =
    await resolveVariant(
      db,
      target,
      true,
    )

  const existingItem =
    await db.cartItem.findUnique({
      where:
        db.productVariant
          ? {
              userId_productVariantId:
                {
                  userId:
                    normalizedUserId,
                  productVariantId:
                    variant.id,
                },
            }
          : {
              userId_productId: {
                userId:
                  normalizedUserId,
                productId:
                  variant.productId,
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

  if (
    quantity >
    variant.stockQuantity
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
      select:
        db.productVariant
          ? variantCartItemSelect
          : legacyCartItemSelect,
    })

  return toCartItem(updatedItem)
}

export async function removeCartItem(
  userId: string,
  target: CartTargetInput,
  client?: CartClient,
): Promise<void> {
  const normalizedUserId = normalizeId(
    userId,
    'Utilizador',
  )

  const db = getClient(client)

  const variant =
    await resolveVariant(
      db,
      target,
      false,
    )

  const existingItem =
    await db.cartItem.findUnique({
      where:
        db.productVariant
          ? {
              userId_productVariantId:
                {
                  userId:
                    normalizedUserId,
                  productVariantId:
                    variant.id,
                },
            }
          : {
              userId_productId: {
                userId:
                  normalizedUserId,
                productId:
                  variant.productId,
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
