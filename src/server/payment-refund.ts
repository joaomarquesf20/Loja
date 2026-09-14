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

const SIMULATED_PAYMENT_PROVIDER =
  'PFA_SIMULATED'

type RefundOrderRecord = {
  id: string
  status: LifecycleOrderStatus
  paymentStatus: LifecyclePaymentStatus
  fulfillmentMethod:
    LifecycleFulfillmentMethod
  paymentProvider: string | null
  paymentReference: string | null
}

type RefundOrderSelect = {
  id: true
  status: true
  paymentStatus: true
  fulfillmentMethod: true
  paymentProvider: true
  paymentReference: true
}

type RefundUpdateManyArgs = {
  where: {
    id: string
    status: LifecycleOrderStatus
    paymentStatus: 'PAID'
    paymentProvider:
      typeof SIMULATED_PAYMENT_PROVIDER
    paymentReference: string
  }
  data: {
    paymentStatus: 'REFUNDED'
  }
}

type RefundOrderEventCreateArgs = {
  data: {
    orderId: string
    type: 'PAYMENT_REFUNDED'
    fromPaymentStatus: 'PAID'
    toPaymentStatus: 'REFUNDED'
  }
}

type PaymentRefundTransactionClient = {
  order: {
    updateMany(
      args: RefundUpdateManyArgs,
    ): Promise<{
      count: number
    }>
  }
  orderEvent: {
    create(
      args:
        RefundOrderEventCreateArgs,
    ): Promise<{ id: string }>
  }
}

export interface PaymentRefundClient {
  order: {
    findUnique(args: {
      where: {
        id: string
      }
      select: RefundOrderSelect
    }): Promise<
      RefundOrderRecord | null
    >
  }
  $transaction<T>(
    callback: (
      transaction:
        PaymentRefundTransactionClient,
    ) => Promise<T>,
  ): Promise<T>
}

const refundOrderSelect:
  RefundOrderSelect = {
  id: true,
  status: true,
  paymentStatus: true,
  fulfillmentMethod: true,
  paymentProvider: true,
  paymentReference: true,
}

const refundableOrderStatuses =
  new Set<LifecycleOrderStatus>([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_PICKUP',
  ])

function getClient(
  client?: PaymentRefundClient,
): PaymentRefundClient {
  return (
    client ??
    (prisma as unknown as
      PaymentRefundClient)
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

function validateProvider(
  order: RefundOrderRecord,
) {
  if (
    order.paymentProvider !==
    SIMULATED_PAYMENT_PROVIDER
  ) {
    throw new OrderLifecycleConflictError(
      'Este pagamento não pertence ao fornecedor simulado e não pode ser reembolsado por esta operação',
    )
  }

  if (
    typeof order.paymentReference !==
      'string' ||
    !order.paymentReference.trim()
  ) {
    throw new OrderLifecycleConflictError(
      'A referência do pagamento simulado é inválida',
    )
  }
}

function validateOrderStatus(
  order: RefundOrderRecord,
) {
  if (
    !refundableOrderStatuses.has(
      order.status,
    )
  ) {
    throw new OrderLifecycleConflictError(
      'O estado atual da encomenda não permite reembolso administrativo',
    )
  }
}

/**
 * Simula um reembolso apenas para pagamentos PFA_SIMULATED.
 *
 * Não contacta um processador de pagamentos real e não movimenta dinheiro.
 * A função apenas muda o estado persistido de PAID para REFUNDED, de forma
 * idempotente e com proteção contra alterações concorrentes.
 */
export async function refundSimulatedPayment(
  orderIdInput: unknown,
  client?: PaymentRefundClient,
): Promise<OrderLifecycleState> {
  const orderId =
    normalizeOrderId(
      orderIdInput,
    )

  const db =
    getClient(client)

  const order =
    await db.order.findUnique({
      where: {
        id: orderId,
      },
      select:
        refundOrderSelect,
    })

  if (!order) {
    throw new OrderLifecycleNotFoundError()
  }

  validateProvider(
    order,
  )

  validateOrderStatus(
    order,
  )

  if (
    order.paymentStatus ===
    'REFUNDED'
  ) {
    return order
  }

  if (
    order.paymentStatus !==
    'PAID'
  ) {
    throw new OrderLifecycleConflictError(
      'Apenas pagamentos confirmados podem ser reembolsados',
    )
  }

  const paymentReference =
    order.paymentReference
      ?.trim()

  if (!paymentReference) {
    throw new OrderLifecycleConflictError(
      'A referência do pagamento simulado é inválida',
    )
  }

  await db.$transaction(
    async (tx) => {
      const updated =
        await tx.order.updateMany({
          where: {
            id: order.id,
            status:
              order.status,
            paymentStatus:
              'PAID',
            paymentProvider:
              SIMULATED_PAYMENT_PROVIDER,
            paymentReference,
          },
          data: {
            paymentStatus:
              'REFUNDED',
          },
        })

      if (
        updated.count !== 1
      ) {
        throw new OrderLifecycleConflictError(
          'A encomenda foi alterada durante o reembolso',
        )
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type:
            'PAYMENT_REFUNDED',
          fromPaymentStatus:
            'PAID',
          toPaymentStatus:
            'REFUNDED',
        },
      })
    },
  )

  return {
    ...order,
    paymentStatus:
      'REFUNDED',
    paymentReference,
  }
}
