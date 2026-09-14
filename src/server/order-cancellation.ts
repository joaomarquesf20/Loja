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
  quantity: number
}

type CancellationOrderRecord = {
  id: string
  status: LifecycleOrderStatus
  paymentStatus: LifecyclePaymentStatus
  fulfillmentMethod:
    LifecycleFulfillmentMethod
  paymentProvider: string | null
  paymentReference: string | null
  items: CancellationOrderItem[]
}

type CancellationOrderSelect = {
  id: true
  status: true
  paymentStatus: true
  fulfillmentMethod: true
  paymentProvider: true
  paymentReference: true
  items: {
    select: {
      productId: true
      quantity: true
    }
  }
}

type CancellationUpdateManyArgs = {
  where: {
    id: string
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
        CancellationOrderSelect
    }): Promise<
      CancellationOrderRecord | null
    >
    updateMany(
      args: CancellationUpdateManyArgs,
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

const cancellationOrderSelect:
  CancellationOrderSelect = {
  id: true,
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
}

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

function aggregateRestockQuantities(
  items: CancellationOrderItem[],
) {
  const quantities =
    new Map<string, number>()

  for (const item of items) {
    if (
      typeof item.productId !==
        'string' ||
      !item.productId.trim() ||
      !Number.isSafeInteger(
        item.quantity,
      ) ||
      item.quantity <= 0
    ) {
      throw new OrderLifecycleConflictError(
        'Os artigos da encomenda não permitem repor o stock com segurança',
      )
    }

    const productId =
      item.productId.trim()

    const nextQuantity =
      (quantities.get(
        productId,
      ) ?? 0) +
      item.quantity

    if (
      !Number.isSafeInteger(
        nextQuantity,
      )
    ) {
      throw new OrderLifecycleConflictError(
        'A quantidade a repor excede o limite suportado',
      )
    }

    quantities.set(
      productId,
      nextQuantity,
    )
  }

  return quantities
}

/**
 * Cancela uma encomenda e repõe o stock exatamente uma vez.
 *
 * A alteração do estado e todos os incrementos de stock acontecem na
 * mesma transação. Um segundo cancelamento encontra CANCELLED e devolve
 * o estado atual sem voltar a incrementar stock.
 *
 * Encomendas PAID/AUTHORIZED não são canceladas aqui: primeiro é
 * necessário tratar o reembolso/anulação do pagamento no fornecedor.
 */
export async function cancelOrderAndRestoreStock(
  orderIdInput: unknown,
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
      const order =
        await tx.order.findUnique({
          where: {
            id: orderId,
          },
          select:
            cancellationOrderSelect,
        })

      if (!order) {
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

      const quantities =
        aggregateRestockQuantities(
          order.items,
        )

      const updated =
        await tx.order.updateMany({
          where: {
            id: order.id,
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

      for (
        const [
          productId,
          quantity,
        ] of quantities
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
