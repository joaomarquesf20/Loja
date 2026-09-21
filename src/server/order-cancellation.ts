import { prisma } from './db'
import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  type LifecycleFulfillmentMethod,
  type LifecycleOrderStatus,
  type LifecyclePaymentStatus,
  type OrderLifecycleState,
} from './order-lifecycle'

type CancellationOrderItem = {
  productId: string
  productVariantId?: string
  quantity: number
}

type CancellationOrderRecord = {
  id: string
  userId: string | null
  status: LifecycleOrderStatus
  paymentStatus: LifecyclePaymentStatus
  fulfillmentMethod:
    LifecycleFulfillmentMethod
  paymentProvider: string | null
  paymentReference: string | null
  items: CancellationOrderItem[]
}

type CancellationUpdateManyArgs = {
  where: {
    id: string
    userId?: string
    status: LifecycleOrderStatus
    paymentStatus:
      LifecyclePaymentStatus
  }
  data: {
    status: 'CANCELLED'
  }
}

type ProductRestockArgs = {
  where: {
    id: string
  }
  data: {
    stockQuantity: {
      increment: number
    }
  }
}

type CancellationOrderEventCreateArgs = {
  data: {
    orderId: string
    type: 'CANCELLED'
    fromOrderStatus:
      LifecycleOrderStatus
    toOrderStatus: 'CANCELLED'
  }
}

export interface OrderCancellationTransactionClient {
  order: {
    findUnique(args: {
      where: {
        id: string
      }
      select:
        Record<string, unknown>
    }): Promise<
      CancellationOrderRecord | null
    >
    updateMany(
      args: CancellationUpdateManyArgs,
    ): Promise<{
      count: number
    }>
  }
  productVariant?: {
    updateMany(
      args: ProductRestockArgs,
    ): Promise<{
      count: number
    }>
  }
  product: {
    updateMany(
      args: ProductRestockArgs,
    ): Promise<{
      count: number
    }>
  }
  orderEvent: {
    create(
      args:
        CancellationOrderEventCreateArgs,
    ): Promise<{ id: string }>
  }
}

export interface OrderCancellationClient {
  $transaction<T>(
    callback: (
      transaction:
        OrderCancellationTransactionClient,
    ) => Promise<T>,
  ): Promise<T>
}

const legacyCancellationOrderSelect = {
  id: true,
  userId: true,
  status: true,
  paymentStatus: true,
  fulfillmentMethod: true,
  paymentProvider: true,
  paymentReference: true,
  items: {
    select: {
      productId: true,
      quantity: true,
    },
  },
} as const

const variantCancellationOrderSelect = {
  ...legacyCancellationOrderSelect,
  items: {
    select: {
      productId: true,
      productVariantId: true,
      quantity: true,
    },
  },
} as const

const cancellableStatuses =
  new Set<LifecycleOrderStatus>([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_PICKUP',
  ])

const cancellablePaymentStatuses =
  new Set<LifecyclePaymentStatus>([
    'PENDING',
    'FAILED',
    'REFUNDED',
  ])

function getClient(
  client?: OrderCancellationClient,
): OrderCancellationClient {
  return (
    client ??
    (prisma as unknown as
      OrderCancellationClient)
  )
}

function normalizeOrderId(
  value: unknown,
) {
  if (
    typeof value !== 'string'
  ) {
    throw new OrderLifecycleValidationError(
      'orderId',
      'Encomenda inválida',
    )
  }

  const normalized =
    value.trim()

  if (!normalized) {
    throw new OrderLifecycleValidationError(
      'orderId',
      'Encomenda inválida',
    )
  }

  return normalized
}

function normalizeOwnerUserId(
  value: string,
) {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new OrderLifecycleNotFoundError()
  }

  return normalized
}

function toLifecycleState(
  order: CancellationOrderRecord,
  status = order.status,
): OrderLifecycleState {
  return {
    id: order.id,
    status,
    paymentStatus:
      order.paymentStatus,
    fulfillmentMethod:
      order.fulfillmentMethod,
    paymentProvider:
      order.paymentProvider,
    paymentReference:
      order.paymentReference,
  }
}

function validateCancellation(
  order: CancellationOrderRecord,
) {
  if (
    order.status ===
    'CANCELLED'
  ) {
    return
  }

  if (
    !cancellableStatuses.has(
      order.status,
    )
  ) {
    throw new OrderLifecycleConflictError(
      'O estado atual da encomenda já não permite cancelamento',
    )
  }

  if (
    order.paymentStatus ===
    'PAID'
  ) {
    throw new OrderLifecycleConflictError(
      'O pagamento tem de ser reembolsado antes de cancelar a encomenda',
    )
  }

  if (
    order.paymentStatus ===
    'AUTHORIZED'
  ) {
    throw new OrderLifecycleConflictError(
      'O pagamento autorizado tem de ser anulado antes de cancelar a encomenda',
    )
  }

  if (
    !cancellablePaymentStatuses.has(
      order.paymentStatus,
    )
  ) {
    throw new OrderLifecycleConflictError(
      'O estado atual do pagamento não permite cancelar a encomenda',
    )
  }
}

function validateRestockQuantity(
  quantity: number,
) {
  if (
    !Number.isSafeInteger(
      quantity,
    ) ||
    quantity <= 0
  ) {
    throw new OrderLifecycleConflictError(
      'Os artigos da encomenda não permitem repor o stock com segurança',
    )
  }
}

function addQuantity(
  current: number,
  quantity: number,
) {
  const next =
    current + quantity

  if (
    !Number.isSafeInteger(next)
  ) {
    throw new OrderLifecycleConflictError(
      'A quantidade a repor excede o limite suportado',
    )
  }

  return next
}

function aggregateLegacyRestockQuantities(
  items: CancellationOrderItem[],
) {
  const quantities =
    new Map<string, number>()

  for (const item of items) {
    if (
      typeof item.productId !==
        'string' ||
      !item.productId.trim()
    ) {
      throw new OrderLifecycleConflictError(
        'Os artigos da encomenda não permitem repor o stock com segurança',
      )
    }

    validateRestockQuantity(
      item.quantity,
    )

    const productId =
      item.productId.trim()

    quantities.set(
      productId,
      addQuantity(
        quantities.get(
          productId,
        ) ?? 0,
        item.quantity,
      ),
    )
  }

  return quantities
}

function aggregateVariantRestockQuantities(
  items: CancellationOrderItem[],
) {
  const quantities =
    new Map<
      string,
      {
        productId: string
        quantity: number
      }
    >()

  for (const item of items) {
    const productId =
      item.productId?.trim()

    const productVariantId =
      item.productVariantId?.trim()

    if (
      !productId ||
      !productVariantId
    ) {
      throw new OrderLifecycleConflictError(
        'Os artigos da encomenda não permitem repor a variante com segurança',
      )
    }

    validateRestockQuantity(
      item.quantity,
    )

    const current =
      quantities.get(
        productVariantId,
      )

    if (
      current &&
      current.productId !==
        productId
    ) {
      throw new OrderLifecycleConflictError(
        'Os artigos da encomenda têm dados de variante inconsistentes',
      )
    }

    quantities.set(
      productVariantId,
      {
        productId,
        quantity: addQuantity(
          current?.quantity ?? 0,
          item.quantity,
        ),
      },
    )
  }

  return quantities
}

/**
 * Cancela uma encomenda e repõe o stock exatamente uma vez.
 *
 * A variante comprada é a unidade de inventário autoritativa.
 * Product.stockQuantity permanece apenas como campo legado durante
 * a migração e não é alterado por este fluxo variant-aware.
 *
 * A alteração do estado e todos os incrementos de stock acontecem na
 * mesma transação. Um segundo cancelamento encontra CANCELLED e devolve
 * o estado atual sem voltar a incrementar stock.
 *
 * Encomendas PAID/AUTHORIZED não são canceladas aqui: primeiro é
 * necessário tratar o reembolso/anulação do pagamento no fornecedor.
 */
async function cancelOrderAndRestoreStockForOwner(
  orderIdInput: unknown,
  ownerUserId: string | null,
  client?: OrderCancellationClient,
): Promise<OrderLifecycleState> {
  const orderId =
    normalizeOrderId(
      orderIdInput,
    )

  const db =
    getClient(client)

  return db.$transaction(
    async (tx) => {
      const useVariants =
        Boolean(tx.productVariant)

      const order =
        await tx.order.findUnique({
          where: {
            id: orderId,
          },
          select: useVariants
            ? variantCancellationOrderSelect
            : legacyCancellationOrderSelect,
        })

      if (
        !order ||
        (
          ownerUserId !== null &&
          order.userId !== ownerUserId
        )
      ) {
        throw new OrderLifecycleNotFoundError()
      }

      validateCancellation(
        order,
      )

      if (
        order.status ===
        'CANCELLED'
      ) {
        return toLifecycleState(
          order,
        )
      }

      const variantQuantities =
        tx.productVariant
          ? aggregateVariantRestockQuantities(
              order.items,
            )
          : null

      const legacyQuantities =
        tx.productVariant
          ? null
          : aggregateLegacyRestockQuantities(
              order.items,
            )

      const updated =
        await tx.order.updateMany({
          where: {
            id: order.id,
            ...(ownerUserId === null
              ? {}
              : {
                  userId:
                    ownerUserId,
                }),
            status:
              order.status,
            paymentStatus:
              order.paymentStatus,
          },
          data: {
            status:
              'CANCELLED',
          },
        })

      if (
        updated.count !== 1
      ) {
        throw new OrderLifecycleConflictError(
          'A encomenda foi alterada durante o cancelamento',
        )
      }

      if (
        tx.productVariant &&
        variantQuantities
      ) {
        for (
          const [
            productVariantId,
            item,
          ] of variantQuantities
        ) {
          const restoredVariant =
            await tx.productVariant.updateMany(
              {
                where: {
                  id:
                    productVariantId,
                },
                data: {
                  stockQuantity: {
                    increment:
                      item.quantity,
                  },
                },
              },
            )

          if (
            restoredVariant.count !== 1
          ) {
            throw new OrderLifecycleConflictError(
              'Não foi possível repor todo o stock das variantes da encomenda',
            )
          }

        }
      } else if (
        legacyQuantities
      ) {
        for (
          const [
            productId,
            quantity,
          ] of legacyQuantities
        ) {
          const restored =
            await tx.product.updateMany({
              where: {
                id: productId,
              },
              data: {
                stockQuantity: {
                  increment:
                    quantity,
                },
              },
            })

          if (
            restored.count !== 1
          ) {
            throw new OrderLifecycleConflictError(
              'Não foi possível repor todo o stock da encomenda',
            )
          }
        }
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: 'CANCELLED',
          fromOrderStatus:
            order.status,
          toOrderStatus:
            'CANCELLED',
        },
      })

      return toLifecycleState(
        order,
        'CANCELLED',
      )
    },
  )
}

export async function cancelOrderAndRestoreStock(
  orderIdInput: unknown,
  client?: OrderCancellationClient,
): Promise<OrderLifecycleState> {
  return cancelOrderAndRestoreStockForOwner(
    orderIdInput,
    null,
    client,
  )
}

export async function cancelUserOrderAndRestoreStock(
  orderIdInput: unknown,
  userId: string,
  client?: OrderCancellationClient,
): Promise<OrderLifecycleState> {
  return cancelOrderAndRestoreStockForOwner(
    orderIdInput,
    normalizeOwnerUserId(userId),
    client,
  )
}
