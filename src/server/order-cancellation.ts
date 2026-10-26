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

type VariantRestockArgs = {
  where: {
    id: string
  }
  data: {
    stockQuantity: {
      increment: number
    }
  }
}

type VariantRestockReadArgs = {
  where: {
    id: string
  }
  select: {
    stockQuantity: true
  }
}

type VariantRestockRecord = {
  stockQuantity: number
}

type StockMovementCreateArgs = {
  data: {
    variantId: string
    type: 'RETURN'
    quantityChange: number
    previousStock: number
    newStock: number
    actorUserId: string | null
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
  productVariant: {
    findUnique(
      args: VariantRestockReadArgs,
    ): Promise<VariantRestockRecord | null>
    updateMany(
      args: VariantRestockArgs,
    ): Promise<{
      count: number
    }>
  }
  stockMovement: {
    create(
      args: StockMovementCreateArgs,
    ): Promise<{ id: string }>
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

const cancellationOrderSelect = {
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
 * O Product já não tem campos de stock: a reposição acontece
 * exclusivamente nas variantes compradas.
 *
 * A alteração do estado, todos os incrementos de stock e o registo do
 * histórico de movimentos (`RETURN`) acontecem na mesma transação. Um
 * segundo cancelamento encontra CANCELLED e devolve
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
      const order =
        await tx.order.findUnique({
          where: {
            id: orderId,
          },
          select:
            cancellationOrderSelect,
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
        aggregateVariantRestockQuantities(
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

      for (
        const [
          productVariantId,
          item,
        ] of variantQuantities
      ) {
        // Leitura do stock anterior na mesma transação: alimenta os
        // campos previous/new do movimento de reposição.
        const variantBefore =
          await tx.productVariant.findUnique(
            {
              where: {
                id:
                  productVariantId,
              },
              select: {
                stockQuantity: true,
              },
            },
          )

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

        // Épico 6: movimento RETURN gravado na mesma transação do
        // incremento; um rollback reverte também o histórico. O ator é
        // o cliente quando é ele quem cancela a encomenda; nos
        // cancelamentos feitos pela administração fica a `null`.
        await tx.stockMovement.create(
          {
            data: {
              variantId:
                productVariantId,
              type: 'RETURN',
              quantityChange:
                item.quantity,
              previousStock:
                variantBefore?.stockQuantity ??
                0,
              newStock:
                (variantBefore?.stockQuantity ??
                  0) +
                item.quantity,
              actorUserId:
                ownerUserId ?? null,
            },
          },
        )
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
