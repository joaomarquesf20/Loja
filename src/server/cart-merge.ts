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

type ExistingCartItemRecord = {
  id: string
  productId: string
  quantity: number
}

type PreparedMergeItem = {
  productId: string
  quantity: number
  existingItemId:
    | string
    | null
}

export type CartMergeResult = {
  mergedItemCount: number
}

export class CartMergeUserUnavailableError extends Error {
  constructor(
    message =
      'Utilizador indisponível',
  ) {
    super(message)
    this.name =
      'CartMergeUserUnavailableError'
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
      where: {
        userId: string
        productId: {
          in: string[]
        }
      }
      select: {
        id: true
        productId: true
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
        quantity: number
      }
      select: {
        id: true
      }
    }): Promise<{
      id: string
    }>
  }
}

export interface CartMergeClient {
  $transaction<T>(
    callback: (
      tx: CartMergeTransactionClient,
    ) => Promise<T>,
    options: {
      isolationLevel:
        'Serializable'
    },
  ): Promise<T>
}

const MAX_TRANSACTION_ATTEMPTS =
  3

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

function isRetryableTransactionError(
  error: unknown,
) {
  if (
    typeof error !==
      'object' ||
    error === null ||
    !('code' in error)
  ) {
    return false
  }

  return (
    (
      error as {
        code?: unknown
      }
    ).code === 'P2034'
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
  items: GuestCartInputItem[],
  client?: CartMergeClient,
): Promise<CartMergeResult> {
  const normalizedUserId =
    normalizeUserId(userId)

  const normalizedItems =
    normalizeGuestCartInputItems(
      items,
    )

  if (
    normalizedItems.length ===
    0
  ) {
    return {
      mergedItemCount: 0,
    }
  }

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
          existingItem?.quantity ??
          0

        if (
          existingItem &&
          (
            !Number.isSafeInteger(
              existingQuantity,
            ) ||
            existingQuantity <=
              0
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
