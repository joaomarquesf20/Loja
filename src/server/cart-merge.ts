import { createHash } from 'node:crypto'
import { prisma } from './db'
import {
  CartInsufficientStockError,
  CartProductUnavailableError,
  CartValidationError,
} from './cart'
import {
  normalizeGuestCartInputItems,
  type GuestCartInputItem,
} from './guest-cart'

type MergeProductRecord = {
  id: string
  stockQuantity: number
  isActive: boolean
}

type MergeVariantRecord = {
  id: string
  productId: string
  optionKey: string
  stockQuantity: number
  isActive: boolean
  product: {
    id: string
    isActive: boolean
  }
}

type ExistingCartItemRecord = {
  id: string
  productId: string
  productVariantId?: string
  quantity: number
}

type MergeReceiptRecord = {
  userId: string
  payloadHash: string
  mergedItemCount: number
}

type PreparedMergeItem = {
  productId: string
  productVariantId?: string
  quantity: number
  existingItemId: string | null
}

export type CartMergeResult = {
  mergedItemCount: number
}

export class CartMergeUserUnavailableError extends Error {
  constructor(
    message = 'Utilizador indisponível',
  ) {
    super(message)
    this.name =
      'CartMergeUserUnavailableError'
  }
}

export class CartMergeConflictError extends Error {
  constructor(
    message =
      'Identificador de merge já utilizado com dados diferentes',
  ) {
    super(message)
    this.name =
      'CartMergeConflictError'
  }
}

class CartMergeReceiptRaceError extends Error {
  constructor() {
    super(
      'Receipt de merge ainda não visível',
    )
    this.name =
      'CartMergeReceiptRaceError'
  }
}

type CartMergeTransactionClient = {
  user: {
    findFirst(args: {
      where: {
        id: string
        isActive: true
      }
      select: {
        id: true
      }
    }): Promise<
      {
        id: string
      } | null
    >
  }

  productVariant?: {
    findMany(args: {
      where: Record<string, unknown>
      select: {
        id: true
        productId: true
        optionKey: true
        stockQuantity: true
        isActive: true
        product: {
          select: {
            id: true
            isActive: true
          }
        }
      }
    }): Promise<
      MergeVariantRecord[]
    >
  }

  product: {
    findMany(args: {
      where: {
        id: {
          in: string[]
        }
      }
      select: {
        id: true
        stockQuantity: true
        isActive: true
      }
    }): Promise<
      MergeProductRecord[]
    >
  }

  cartItem: {
    findMany(args: {
      where:
        | {
            userId: string
            productId: {
              in: string[]
            }
          }
        | {
            userId: string
            productVariantId: {
              in: string[]
            }
          }
      select: {
        id: true
        productId: true
        productVariantId?: true
        quantity: true
      }
    }): Promise<
      ExistingCartItemRecord[]
    >

    update(args: {
      where: {
        id: string
      }
      data: {
        quantity: number
      }
      select: {
        id: true
      }
    }): Promise<{
      id: string
    }>

    create(args: {
      data: {
        userId: string
        productId: string
        productVariantId?: string
        quantity: number
      }
      select: {
        id: true
      }
    }): Promise<{
      id: string
    }>
  }

  guestCartMerge: {
    createMany(args: {
      data: Array<{
        mergeKey: string
        userId: string
        payloadHash: string
        mergedItemCount: number
      }>
      skipDuplicates: true
    }): Promise<{
      count: number
    }>

    findUnique(args: {
      where: {
        mergeKey: string
      }
      select: {
        userId: true
        payloadHash: true
        mergedItemCount: true
      }
    }): Promise<
      MergeReceiptRecord | null
    >
  }
}

export interface CartMergeClient {
  $transaction<T>(
    callback: (
      tx: CartMergeTransactionClient,
    ) => Promise<T>,
    options: {
      isolationLevel: 'Serializable'
    },
  ): Promise<T>
}

const MAX_TRANSACTION_ATTEMPTS = 3
const MAX_MERGE_KEY_LENGTH = 128

function getClient(
  client?: CartMergeClient,
): CartMergeClient {
  return (
    client ??
    (prisma as unknown as CartMergeClient)
  )
}

function normalizeUserId(
  userId: string,
) {
  const normalizedUserId =
    userId.trim()

  if (!normalizedUserId) {
    throw new CartValidationError(
      'Utilizador é obrigatório',
    )
  }

  return normalizedUserId
}

function normalizeMergeKey(
  mergeKey: string,
) {
  const normalizedMergeKey =
    mergeKey.trim()

  if (
    !normalizedMergeKey ||
    normalizedMergeKey.length >
      MAX_MERGE_KEY_LENGTH
  ) {
    throw new CartValidationError(
      'Identificador de merge inválido',
    )
  }

  return normalizedMergeKey
}

function createPayloadHash(
  items: GuestCartInputItem[],
) {
  const canonicalItems = [
    ...items,
  ].sort((left, right) => {
    const leftKey =
      left.productVariantId
        ? `variant:${left.productVariantId}`
        : `product:${left.productId}`

    const rightKey =
      right.productVariantId
        ? `variant:${right.productVariantId}`
        : `product:${right.productId}`

    if (leftKey === rightKey) {
      return 0
    }

    return leftKey < rightKey
      ? -1
      : 1
  })

  return createHash('sha256')
    .update(
      JSON.stringify(canonicalItems),
      'utf8',
    )
    .digest('hex')
}

function getPrismaErrorCode(
  error: unknown,
) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error)
  ) {
    return null
  }

  const code = (
    error as {
      code?: unknown
    }
  ).code

  return typeof code === 'string'
    ? code
    : null
}

function isRetryableTransactionError(
  error: unknown,
) {
  if (
    error instanceof
    CartMergeReceiptRaceError
  ) {
    return true
  }

  const code =
    getPrismaErrorCode(error)

  return (
    code === 'P2034' ||
    code === 'P2002'
  )
}

async function runSerializableTransaction<T>(
  client: CartMergeClient,
  callback: (
    tx: CartMergeTransactionClient,
  ) => Promise<T>,
) {
  for (
    let attempt = 1;
    attempt <=
    MAX_TRANSACTION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await client.$transaction(
        callback,
        {
          isolationLevel:
            'Serializable',
        },
      )
    } catch (error) {
      if (
        !isRetryableTransactionError(
          error,
        ) ||
        attempt ===
          MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error
      }
    }
  }

  throw new Error(
    'Falha inesperada na transação',
  )
}

export async function mergeGuestCartIntoUserCart(
  userId: string,
  mergeKey: string,
  items: GuestCartInputItem[],
  client?: CartMergeClient,
): Promise<CartMergeResult> {
  const normalizedUserId =
    normalizeUserId(userId)

  const normalizedMergeKey =
    normalizeMergeKey(mergeKey)

  const normalizedItems =
    normalizeGuestCartInputItems(
      items,
    )

  if (
    normalizedItems.length === 0
  ) {
    return {
      mergedItemCount: 0,
    }
  }

  const payloadHash =
    createPayloadHash(
      normalizedItems,
    )

  const db = getClient(client)

  return runSerializableTransaction(
    db,
    async (tx) => {
      const user =
        await tx.user.findFirst({
          where: {
            id: normalizedUserId,
            isActive: true,
          },
          select: {
            id: true,
          },
        })

      if (!user) {
        throw new CartMergeUserUnavailableError()
      }

      const receiptClaim =
        await tx.guestCartMerge.createMany(
          {
            data: [
              {
                mergeKey:
                  normalizedMergeKey,
                userId: user.id,
                payloadHash,
                mergedItemCount:
                  normalizedItems.length,
              },
            ],
            skipDuplicates: true,
          },
        )

      if (receiptClaim.count === 0) {
        const existingReceipt =
          await tx.guestCartMerge.findUnique(
            {
              where: {
                mergeKey:
                  normalizedMergeKey,
              },
              select: {
                userId: true,
                payloadHash: true,
                mergedItemCount: true,
              },
            },
          )

        if (!existingReceipt) {
          throw new CartMergeReceiptRaceError()
        }

        if (
          existingReceipt.userId !==
            user.id ||
          existingReceipt.payloadHash !==
            payloadHash
        ) {
          throw new CartMergeConflictError()
        }

        return {
          mergedItemCount:
            existingReceipt.mergedItemCount,
        }
      }

      if (tx.productVariant) {
        const explicitVariantIds =
          normalizedItems.flatMap(
            (item) =>
              item.productVariantId
                ? [
                    item.productVariantId,
                  ]
                : [],
          )

        const legacyProductIds =
          normalizedItems
            .filter(
              (item) =>
                !item.productVariantId,
            )
            .map(
              (item) =>
                item.productId,
            )

        const variants =
          await tx.productVariant.findMany(
            {
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
              select: {
                id: true,
                productId: true,
                optionKey: true,
                stockQuantity: true,
                isActive: true,
                product: {
                  select: {
                    id: true,
                    isActive: true,
                  },
                },
              },
            },
          )

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

        const quantitiesByVariantId =
          new Map<
            string,
            {
              productId: string
              productVariantId: string
              quantity: number
              stockQuantity: number
            }
          >()

        for (const item of normalizedItems) {
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
              item.productId ||
            !variant.isActive ||
            !variant.product.isActive
          ) {
            throw new CartProductUnavailableError()
          }

          const existing =
            quantitiesByVariantId.get(
              variant.id,
            )

          const nextQuantity =
            (existing?.quantity ?? 0) +
            item.quantity

          if (
            !Number.isSafeInteger(
              nextQuantity,
            )
          ) {
            throw new CartValidationError(
              'Quantidade inválida',
            )
          }

          quantitiesByVariantId.set(
            variant.id,
            {
              productId:
                variant.productId,
              productVariantId:
                variant.id,
              quantity:
                nextQuantity,
              stockQuantity:
                variant.stockQuantity,
            },
          )
        }

        const resolvedItems =
          Array.from(
            quantitiesByVariantId.values(),
          )

        const variantIds =
          resolvedItems.map(
            (item) =>
              item.productVariantId,
          )

        const existingItems =
          await tx.cartItem.findMany({
            where: {
              userId: user.id,
              productVariantId: {
                in: variantIds,
              },
            },
            select: {
              id: true,
              productId: true,
              productVariantId: true,
              quantity: true,
            },
          })

        const existingByVariantId =
          new Map(
            existingItems.map(
              (item) => [
                item.productVariantId,
                item,
              ],
            ),
          )

        const preparedItems:
          PreparedMergeItem[] = []

        for (const item of resolvedItems) {
          const existingItem =
            existingByVariantId.get(
              item.productVariantId,
            )

          const existingQuantity =
            existingItem?.quantity ?? 0

          if (
            existingItem &&
            (
              !Number.isSafeInteger(
                existingQuantity,
              ) ||
              existingQuantity <= 0
            )
          ) {
            throw new CartValidationError(
              'Quantidade do carrinho inválida',
            )
          }

          const nextQuantity =
            existingQuantity +
            item.quantity

          if (
            !Number.isSafeInteger(
              nextQuantity,
            )
          ) {
            throw new CartValidationError(
              'Quantidade inválida',
            )
          }

          if (
            nextQuantity >
            item.stockQuantity
          ) {
            throw new CartInsufficientStockError()
          }

          preparedItems.push({
            productId:
              item.productId,
            productVariantId:
              item.productVariantId,
            quantity:
              nextQuantity,
            existingItemId:
              existingItem?.id ??
              null,
          })
        }

        for (const item of preparedItems) {
          if (item.existingItemId) {
            await tx.cartItem.update({
              where: {
                id:
                  item.existingItemId,
              },
              data: {
                quantity:
                  item.quantity,
              },
              select: {
                id: true,
              },
            })

            continue
          }

          await tx.cartItem.create({
            data: {
              userId: user.id,
              productId:
                item.productId,
              productVariantId:
                item.productVariantId,
              quantity:
                item.quantity,
            },
            select: {
              id: true,
            },
          })
        }

        return {
          mergedItemCount:
            normalizedItems.length,
        }
      }

      const productIds =
        normalizedItems.map(
          (item) =>
            item.productId,
        )

      const products =
        await tx.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
          select: {
            id: true,
            stockQuantity: true,
            isActive: true,
          },
        })

      const existingItems =
        await tx.cartItem.findMany({
          where: {
            userId: user.id,
            productId: {
              in: productIds,
            },
          },
          select: {
            id: true,
            productId: true,
            quantity: true,
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

      const existingItemsByProductId =
        new Map(
          existingItems.map(
            (item) => [
              item.productId,
              item,
            ],
          ),
        )

      const preparedItems:
        PreparedMergeItem[] = []

      for (
        const item of
        normalizedItems
      ) {
        const product =
          productsById.get(
            item.productId,
          )

        if (
          !product ||
          !product.isActive
        ) {
          throw new CartProductUnavailableError()
        }

        const existingItem =
          existingItemsByProductId.get(
            item.productId,
          )

        const existingQuantity =
          existingItem?.quantity ?? 0

        if (
          existingItem &&
          (
            !Number.isSafeInteger(
              existingQuantity,
            ) ||
            existingQuantity <= 0
          )
        ) {
          throw new CartValidationError(
            'Quantidade do carrinho inválida',
          )
        }

        const nextQuantity =
          existingQuantity +
          item.quantity

        if (
          !Number.isSafeInteger(
            nextQuantity,
          )
        ) {
          throw new CartValidationError(
            'Quantidade inválida',
          )
        }

        if (
          nextQuantity >
          product.stockQuantity
        ) {
          throw new CartInsufficientStockError()
        }

        preparedItems.push({
          productId:
            item.productId,
          quantity:
            nextQuantity,
          existingItemId:
            existingItem?.id ??
            null,
        })
      }

      for (
        const item of
        preparedItems
      ) {
        if (
          item.existingItemId
        ) {
          await tx.cartItem.update(
            {
              where: {
                id: item.existingItemId,
              },
              data: {
                quantity:
                  item.quantity,
              },
              select: {
                id: true,
              },
            },
          )

          continue
        }

        await tx.cartItem.create({
          data: {
            userId: user.id,
            productId:
              item.productId,
            quantity:
              item.quantity,
          },
          select: {
            id: true,
          },
        })
      }

      return {
        mergedItemCount:
          preparedItems.length,
      }
    },
  )
}
