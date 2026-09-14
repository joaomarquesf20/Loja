import {
  randomUUID,
} from 'node:crypto'

import { prisma } from './db'

export const SIMULATED_PAYMENT_PROVIDER =
  'PFA_SIMULATED'

export type PaymentInitiationField =
  | 'userId'
  | 'orderId'

export class PaymentInitiationValidationError extends Error {
  constructor(
    public readonly field: PaymentInitiationField,
    message: string,
  ) {
    super(message)
    this.name =
      'PaymentInitiationValidationError'
  }
}

export class PaymentInitiationNotFoundError extends Error {
  constructor() {
    super('Encomenda não encontrada')
    this.name =
      'PaymentInitiationNotFoundError'
  }
}

export class PaymentInitiationConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name =
      'PaymentInitiationConflictError'
  }
}

export type PaymentInitiationMethod =
  | 'CARD'
  | 'INSTALLMENTS'

type MoneyValue =
  | string
  | number
  | {
      toString(): string
    }

export type PaymentInitiationResult = {
  orderId: string
  paymentStatus: 'PENDING'
  paymentMethod: PaymentInitiationMethod
  installmentCount: number | null
  paymentProvider: typeof SIMULATED_PAYMENT_PROVIDER
  paymentReference: string
  amount: string
}

type PaymentOrderRecord = {
  id: string
  total: MoneyValue
  paymentStatus:
    | 'PENDING'
    | 'AUTHORIZED'
    | 'PAID'
    | 'FAILED'
    | 'REFUNDED'
  paymentMethod:
    | PaymentInitiationMethod
    | null
  installmentCount: number | null
  paymentProvider: string | null
  paymentReference: string | null
}

type PaymentOrderSelect = {
  id: true
  total: true
  paymentStatus: true
  paymentMethod: true
  installmentCount: true
  paymentProvider: true
  paymentReference: true
}

type PaymentOrderFindFirstArgs = {
  where: {
    id: string
    userId: string
  }
  select: PaymentOrderSelect
}

type PaymentOrderUpdateManyArgs = {
  where: {
    id: string
    userId: string
    paymentStatus: 'PENDING'
    paymentProvider: null
    paymentReference: null
  }
  data: {
    paymentProvider:
      typeof SIMULATED_PAYMENT_PROVIDER
    paymentReference: string
  }
}

export interface PaymentInitiationClient {
  order: {
    findFirst(
      args: PaymentOrderFindFirstArgs,
    ): Promise<PaymentOrderRecord | null>
    updateMany(
      args: PaymentOrderUpdateManyArgs,
    ): Promise<{ count: number }>
  }
}

type PaymentReferenceFactory =
  () => string

const paymentOrderSelect: PaymentOrderSelect = {
  id: true,
  total: true,
  paymentStatus: true,
  paymentMethod: true,
  installmentCount: true,
  paymentProvider: true,
  paymentReference: true,
}

function getClient(
  client?: PaymentInitiationClient,
): PaymentInitiationClient {
  return (
    client ??
    (prisma as unknown as PaymentInitiationClient)
  )
}

function normalizeRequiredString(
  value: unknown,
  field: PaymentInitiationField,
  message: string,
) {
  if (typeof value !== 'string') {
    throw new PaymentInitiationValidationError(
      field,
      message,
    )
  }

  const normalized = value.trim()

  if (!normalized) {
    throw new PaymentInitiationValidationError(
      field,
      message,
    )
  }

  return normalized
}

function isUniqueConstraintViolation(
  error: unknown,
) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

function moneyToString(
  value: MoneyValue,
) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return value.toString()
}

function validatePaymentTerms(
  order: PaymentOrderRecord,
) {
  if (order.paymentMethod === null) {
    throw new PaymentInitiationConflictError(
      'A encomenda não tem método de pagamento definido',
    )
  }

  if (
    order.paymentMethod === 'CARD' &&
    order.installmentCount !== null
  ) {
    throw new PaymentInitiationConflictError(
      'Os termos de pagamento da encomenda são inválidos',
    )
  }

  if (
    order.paymentMethod ===
      'INSTALLMENTS' &&
    (
      order.installmentCount === null ||
      !Number.isSafeInteger(
        order.installmentCount,
      ) ||
      order.installmentCount < 2
    )
  ) {
    throw new PaymentInitiationConflictError(
      'Os termos de pagamento da encomenda são inválidos',
    )
  }
}

function createResult(
  order: PaymentOrderRecord,
): PaymentInitiationResult {
  if (
    order.paymentStatus !== 'PENDING' ||
    order.paymentMethod === null ||
    order.paymentProvider !==
      SIMULATED_PAYMENT_PROVIDER ||
    order.paymentReference === null
  ) {
    throw new PaymentInitiationConflictError(
      'O pagamento não está num estado válido de iniciação',
    )
  }

  return {
    orderId: order.id,
    paymentStatus: 'PENDING',
    paymentMethod:
      order.paymentMethod,
    installmentCount:
      order.installmentCount,
    paymentProvider:
      SIMULATED_PAYMENT_PROVIDER,
    paymentReference:
      order.paymentReference,
    amount:
      moneyToString(order.total),
  }
}

async function loadOwnedOrder(
  userId: string,
  orderId: string,
  client: PaymentInitiationClient,
) {
  const order =
    await client.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: paymentOrderSelect,
    })

  if (!order) {
    throw new PaymentInitiationNotFoundError()
  }

  return order
}

function normalizeGeneratedReference(
  value: unknown,
) {
  if (typeof value !== 'string') {
    throw new PaymentInitiationConflictError(
      'Não foi possível gerar uma referência de pagamento',
    )
  }

  const normalized = value.trim()

  if (
    !normalized ||
    normalized.length > 191
  ) {
    throw new PaymentInitiationConflictError(
      'Não foi possível gerar uma referência de pagamento',
    )
  }

  return normalized
}

export async function initiateSimulatedPayment(
  userIdInput: string,
  orderIdInput: unknown,
  client?: PaymentInitiationClient,
  referenceFactory: PaymentReferenceFactory = () =>
    `pfa_sim_${randomUUID()}`,
): Promise<PaymentInitiationResult> {
  const userId =
    normalizeRequiredString(
      userIdInput,
      'userId',
      'Utilizador inválido',
    )

  const orderId =
    normalizeRequiredString(
      orderIdInput,
      'orderId',
      'Encomenda inválida',
    )

  const db = getClient(client)

  const order =
    await loadOwnedOrder(
      userId,
      orderId,
      db,
    )

  validatePaymentTerms(order)

  if (
    order.paymentStatus !==
    'PENDING'
  ) {
    throw new PaymentInitiationConflictError(
      'A encomenda já não está pendente de pagamento',
    )
  }

  if (
    order.paymentProvider ===
      SIMULATED_PAYMENT_PROVIDER &&
    order.paymentReference !== null
  ) {
    return createResult(order)
  }

  if (
    order.paymentProvider !== null ||
    order.paymentReference !== null
  ) {
    throw new PaymentInitiationConflictError(
      'A encomenda já tem outro pagamento iniciado',
    )
  }

  const paymentReference =
    normalizeGeneratedReference(
      referenceFactory(),
    )

  let updated: {
    count: number
  }

  try {
    updated =
      await db.order.updateMany({
        where: {
          id: orderId,
          userId,
          paymentStatus: 'PENDING',
          paymentProvider: null,
          paymentReference: null,
        },
        data: {
          paymentProvider:
            SIMULATED_PAYMENT_PROVIDER,
          paymentReference,
        },
      })
  } catch (error) {
    if (
      isUniqueConstraintViolation(
        error,
      )
    ) {
      throw new PaymentInitiationConflictError(
        'A referência de pagamento já está associada a outra encomenda',
      )
    }

    throw error
  }

  if (updated.count === 1) {
    return createResult({
      ...order,
      paymentProvider:
        SIMULATED_PAYMENT_PROVIDER,
      paymentReference,
    })
  }

  const currentOrder =
    await loadOwnedOrder(
      userId,
      orderId,
      db,
    )

  validatePaymentTerms(
    currentOrder,
  )

  if (
    currentOrder.paymentStatus ===
      'PENDING' &&
    currentOrder.paymentProvider ===
      SIMULATED_PAYMENT_PROVIDER &&
    currentOrder.paymentReference !==
      null
  ) {
    return createResult(
      currentOrder,
    )
  }

  throw new PaymentInitiationConflictError(
    'A encomenda foi alterada durante a iniciação do pagamento',
  )
}
