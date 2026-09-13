import { prisma } from './db'

export type LifecycleOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'

export type LifecyclePaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

export type LifecycleFulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

export type OrderLifecycleField =
  | 'orderId'
  | 'paymentProvider'
  | 'paymentReference'

export class OrderLifecycleValidationError extends Error {
  constructor(
    public readonly field: OrderLifecycleField,
    message: string,
  ) {
    super(message)
    this.name = 'OrderLifecycleValidationError'
  }
}

export class OrderLifecycleNotFoundError extends Error {
  constructor() {
    super('Encomenda não encontrada')
    this.name = 'OrderLifecycleNotFoundError'
  }
}

export class OrderLifecycleConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrderLifecycleConflictError'
  }
}

export type OrderLifecycleState = {
  id: string
  status: LifecycleOrderStatus
  paymentStatus: LifecyclePaymentStatus
  fulfillmentMethod: LifecycleFulfillmentMethod
  paymentProvider: string | null
  paymentReference: string | null
}

type OrderLifecycleSelect = {
  id: true
  status: true
  paymentStatus: true
  fulfillmentMethod: true
  paymentProvider: true
  paymentReference: true
}

type FindUniqueArgs = {
  where: {
    id: string
  }
  select: OrderLifecycleSelect
}

type FindFirstArgs = {
  where: {
    paymentProvider: string
    paymentReference: string
    NOT: {
      id: string
    }
  }
  select: {
    id: true
  }
}

type PaymentUpdateManyArgs = {
  where: {
    id: string
    paymentStatus: LifecyclePaymentStatus
    paymentProvider: string | null
    paymentReference: string | null
  }
  data: {
    paymentStatus: 'PAID'
    paymentProvider: string
    paymentReference: string
  }
}

type ReadyForPickupUpdateManyArgs = {
  where: {
    id: string
    status: LifecycleOrderStatus
    fulfillmentMethod: 'PICKUP'
    paymentStatus: 'PAID'
  }
  data: {
    status: 'READY_FOR_PICKUP'
  }
}

export interface OrderLifecycleClient {
  order: {
    findUnique(
      args: FindUniqueArgs,
    ): Promise<OrderLifecycleState | null>
    findFirst(
      args: FindFirstArgs,
    ): Promise<{ id: string } | null>
    updateMany(
      args:
        | PaymentUpdateManyArgs
        | ReadyForPickupUpdateManyArgs,
    ): Promise<{ count: number }>
  }
}

export type VerifiedPaymentInput = {
  orderId: string
  paymentProvider: string
  paymentReference: string
}

const orderLifecycleSelect: OrderLifecycleSelect = {
  id: true,
  status: true,
  paymentStatus: true,
  fulfillmentMethod: true,
  paymentProvider: true,
  paymentReference: true,
}

const readyForPickupSourceStatuses =
  new Set<LifecycleOrderStatus>([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
  ])

function getClient(
  client?: OrderLifecycleClient,
): OrderLifecycleClient {
  return (
    client ??
    (prisma as unknown as OrderLifecycleClient)
  )
}

function normalizeRequiredString(
  value: unknown,
  field: OrderLifecycleField,
  message: string,
) {
  if (typeof value !== 'string') {
    throw new OrderLifecycleValidationError(
      field,
      message,
    )
  }

  const normalized = value.trim()

  if (!normalized) {
    throw new OrderLifecycleValidationError(
      field,
      message,
    )
  }

  return normalized
}

function normalizeOrderId(
  value: unknown,
) {
  return normalizeRequiredString(
    value,
    'orderId',
    'Encomenda inválida',
  )
}

async function loadOrder(
  orderId: string,
  client: OrderLifecycleClient,
) {
  const order =
    await client.order.findUnique({
      where: {
        id: orderId,
      },
      select: orderLifecycleSelect,
    })

  if (!order) {
    throw new OrderLifecycleNotFoundError()
  }

  return order
}

async function reloadOrder(
  orderId: string,
  client: OrderLifecycleClient,
) {
  const order =
    await client.order.findUnique({
      where: {
        id: orderId,
      },
      select: orderLifecycleSelect,
    })

  if (!order) {
    throw new OrderLifecycleConflictError(
      'A encomenda foi alterada durante a operação',
    )
  }

  return order
}

/**
 * Regista um pagamento que já foi validado pelo servidor junto do
 * fornecedor de pagamentos. Esta função NÃO valida assinaturas de
 * webhooks; essa validação pertence ao adaptador/rota do fornecedor.
 */
export async function recordVerifiedPayment(
  input: VerifiedPaymentInput,
  client?: OrderLifecycleClient,
): Promise<OrderLifecycleState> {
  const orderId =
    normalizeOrderId(input.orderId)

  const paymentProvider =
    normalizeRequiredString(
      input.paymentProvider,
      'paymentProvider',
      'Fornecedor de pagamento inválido',
    )

  const paymentReference =
    normalizeRequiredString(
      input.paymentReference,
      'paymentReference',
      'Referência de pagamento inválida',
    )

  const db =
    getClient(client)

  const order =
    await loadOrder(
      orderId,
      db,
    )

  if (
    order.paymentStatus === 'PAID'
  ) {
    if (
      order.paymentProvider ===
        paymentProvider &&
      order.paymentReference ===
        paymentReference
    ) {
      return order
    }

    throw new OrderLifecycleConflictError(
      'A encomenda já tem outro pagamento confirmado',
    )
  }

  if (
    order.paymentStatus ===
    'REFUNDED'
  ) {
    throw new OrderLifecycleConflictError(
      'Um pagamento reembolsado não pode ser confirmado novamente',
    )
  }

  const duplicateReference =
    await db.order.findFirst({
      where: {
        paymentProvider,
        paymentReference,
        NOT: {
          id: orderId,
        },
      },
      select: {
        id: true,
      },
    })

  if (duplicateReference) {
    throw new OrderLifecycleConflictError(
      'A referência de pagamento já pertence a outra encomenda',
    )
  }

  const updated =
    await db.order.updateMany({
      where: {
        id: orderId,
        paymentStatus:
          order.paymentStatus,
        paymentProvider:
          order.paymentProvider,
        paymentReference:
          order.paymentReference,
      },
      data: {
        paymentStatus: 'PAID',
        paymentProvider,
        paymentReference,
      },
    })

  if (updated.count !== 1) {
    throw new OrderLifecycleConflictError(
      'A encomenda foi alterada durante a confirmação do pagamento',
    )
  }

  return reloadOrder(
    orderId,
    db,
  )
}

/**
 * Marca uma encomenda de levantamento como pronta. O estado só pode
 * avançar quando o método é PICKUP e o pagamento já está PAID.
 */
export async function markOrderReadyForPickup(
  orderIdInput: string,
  client?: OrderLifecycleClient,
): Promise<OrderLifecycleState> {
  const orderId =
    normalizeOrderId(orderIdInput)

  const db =
    getClient(client)

  const order =
    await loadOrder(
      orderId,
      db,
    )

  if (
    order.fulfillmentMethod !==
    'PICKUP'
  ) {
    throw new OrderLifecycleConflictError(
      'Apenas encomendas para levantamento podem ficar prontas para levantamento',
    )
  }

  if (
    order.paymentStatus !==
    'PAID'
  ) {
    throw new OrderLifecycleConflictError(
      'O pagamento tem de estar confirmado antes do levantamento',
    )
  }

  if (
    order.status ===
    'READY_FOR_PICKUP'
  ) {
    return order
  }

  if (
    !readyForPickupSourceStatuses.has(
      order.status,
    )
  ) {
    throw new OrderLifecycleConflictError(
      'O estado atual da encomenda não permite marcar o levantamento como pronto',
    )
  }

  const updated =
    await db.order.updateMany({
      where: {
        id: orderId,
        status: order.status,
        fulfillmentMethod:
          'PICKUP',
        paymentStatus: 'PAID',
      },
      data: {
        status:
          'READY_FOR_PICKUP',
      },
    })

  if (updated.count !== 1) {
    throw new OrderLifecycleConflictError(
      'A encomenda foi alterada durante a atualização do estado',
    )
  }

  return reloadOrder(
    orderId,
    db,
  )
}
