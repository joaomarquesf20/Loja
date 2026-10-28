import { z } from 'zod'

import { prisma } from './db'

/**
 * Épico 7 — motor de cupões e descontos.
 *
 * Responsabilidades:
 * 1. Validar um código de cupão contra o estado da base de dados
 *    (ativo, janela temporal, limite de utilizações e total mínimo do
 *    carrinho) — leitura pura, sem efeitos secundários.
 * 2. Aplicar o cupão DENTRO da transação do checkout: reavaliação +
 *    incremento atómico do contador de utilizações. O incremento é
 *    guardado (`usedCount < maxUses`) com `updateMany`, de modo a que
 *    duas transações concorrentes nunca excedam o limite.
 *
 * Nota de precisão: os campos `discountValue`/`minOrderValue` são
 * `Float` (por decisão de schema). Todo o cálculo é arredondado para
 * cêntimos (`roundToCents`) e o desconto nunca excede o total do
 * carrinho. O checkout converte o desconto para cêntimos inteiros com
 * `couponAmountToCents` antes de o persistir ou enviar ao Stripe.
 */

export const COUPON_CODE_MAX_LENGTH = 40

/**
 * Teto do total do carrinho aceite na validação — espelha o intervalo
 * do Decimal(10,2) usado nos montantes persistidos.
 */
export const COUPON_MAX_CART_TOTAL = 999999

export type CouponDiscountType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'

export type CouponFailureReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'LIMIT_REACHED'
  | 'MIN_ORDER_NOT_MET'

/**
 * Erro de negócio do motor de cupões. O `reason` permite às rotas e ao
 * cliente distinguir a causa (código desconhecido, expirado, limite
 * atingido, total mínimo, etc.). Os motivos existentes:
 *
 * - NOT_FOUND — código inexistente;
 * - INACTIVE — cupão desativado;
 * - NOT_STARTED — ainda antes de `startsAt`;
 * - EXPIRED — depois de `expiresAt`;
 * - LIMIT_REACHED — `usedCount` já atingiu `maxUses`;
 * - MIN_ORDER_NOT_MET — subtotal de produtos abaixo de `minOrderValue`.
 */
export class CouponRejectedError extends Error {
  readonly reason: CouponFailureReason

  constructor(
    reason: CouponFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'CouponRejectedError'
    this.reason = reason
  }
}

/**
 * Registo cru de cupão lido da base de dados (Float/Int/Boolean ficam
 * como primitivos JS; datas como Date).
 */
export type CouponRecord = {
  id: string
  code: string
  discountType: CouponDiscountType
  discountValue: number
  minOrderValue: number | null
  maxUses: number | null
  usedCount: number
  startsAt: Date | null
  expiresAt: Date | null
  isActive: boolean
}

export type CouponSelect = {
  id: true
  code: true
  discountType: true
  discountValue: true
  minOrderValue: true
  maxUses: true
  usedCount: true
  startsAt: true
  expiresAt: true
  isActive: true
}

const couponSelect: CouponSelect = {
  id: true,
  code: true,
  discountType: true,
  discountValue: true,
  minOrderValue: true,
  maxUses: true,
  usedCount: true,
  startsAt: true,
  expiresAt: true,
  isActive: true,
}

type CouponLookupDelegate = {
  findUnique(args: {
    where: {
      code: string
    }
    select: CouponSelect
  }): Promise<CouponRecord | null>
}

/** Cliente de leitura para a validação fora de transação. */
export interface CouponDbClient {
  coupon: CouponLookupDelegate
}

/**
 * Cliente de transação para a aplicação do cupão no checkout: a leitura
 * e o incremento atómico partilham a MESMA transação serializável que
 * cria a encomenda.
 */
export interface CouponTransactionClient {
  coupon: {
    findUnique: CouponLookupDelegate['findUnique']
    updateMany(args: {
      where:
        | {
            id: string
          }
        | {
            id: string
            usedCount: {
              lt: number
            }
          }
      data: {
        usedCount: {
          increment: number
        }
      }
    }): Promise<{
      count: number
    }>
  }
}

export type CouponValidationInput =
  | {
      code?: unknown
      cartTotal?: unknown
    }
  | undefined

export type CouponValidationSuccess = {
  valid: true
  coupon: {
    id: string
    code: string
    discountType: CouponDiscountType
    discountValue: number
  }
  /** Desconto calculado, em euros (Float — ver nota no cabeçalho). */
  discount: number
  /** Total do carrinho após o desconto, em euros. */
  newTotal: number
}

export type CouponValidationFailure = {
  valid: false
  reason: CouponFailureReason
  message: string
}

export type CouponValidationResult =
  | CouponValidationSuccess
  | CouponValidationFailure

/**
 * Resultado da avaliação de um cupão DENTRO de uma transação. Inclui
 * `maxUses` para que o chamador possa invocar `incrementCouponUsage`
 * após a criação da encomenda sem reler o cupão.
 */
export type CouponEvaluation = {
  couponId: string
  code: string
  discountType: CouponDiscountType
  discountValue: number
  discount: number
  newTotal: number
  maxUses: number | null
}

const COUPON_CODE_MESSAGE =
  'Introduz um código de cupão válido'

const COUPON_CART_TOTAL_MESSAGE =
  'O total do carrinho deve ser um número'

const couponCodeSchema = z
  .string({
    message: COUPON_CODE_MESSAGE,
  })
  .trim()
  .min(1, { message: COUPON_CODE_MESSAGE })
  .max(COUPON_CODE_MAX_LENGTH, {
    message: `O código de cupão não pode exceder ${COUPON_CODE_MAX_LENGTH} caracteres`,
  })
  .transform((value) => value.toUpperCase())

const couponCartTotalSchema = z.coerce
  .number({
    message: COUPON_CART_TOTAL_MESSAGE,
  })
  .min(0, {
    message:
      'O total do carrinho não pode ser negativo',
  })
  .max(COUPON_MAX_CART_TOTAL, {
    message:
      'O total do carrinho excede o máximo suportado',
  })

/**
 * Validação estrita da entrada de cupão: código (texto, cortado,
 * normalizado em maiúsculas) + total do carrinho (número não negativo,
 * limitado). ZodError → 400 nas rotas.
 */
export const couponValidationSchema =
  z.object({
    code: couponCodeSchema,
    cartTotal: couponCartTotalSchema,
  })

function roundToCents(value: number): number {
  return (
    Math.round(value * 100) / 100
  )
}

/**
 * Converte um montante em euros (Float) para cêntimos inteiros — a
 * moeda interna do checkout e do Stripe. O arredondamento para o cêntimo
 * mais próximo elimina o ruído binário do Float.
 */
export function couponAmountToCents(
  value: number,
): number {
  return Math.round(value * 100)
}

/**
 * Converte a representação em texto de um Decimal(10,2) do Prisma para
 * cêntimos (mesma aritmética de `decimalMoneyToCents` do Stripe, sem
 * depender do domínio de pagamento).
 */
function moneyStringToCents(
  value: string,
): number {
  const normalized = value.trim()

  if (
    !/^\d{1,8}(?:\.\d{1,2})?$/.test(
      normalized,
    )
  ) {
    throw new Error(
      `Montante monetário inválido: ${normalized}`,
    )
  }

  const [whole, fraction = ''] =
    normalized.split('.')

  return (
    Number(whole) * 100 +
    Number(fraction.padEnd(2, '0'))
  )
}

/**
 * Calcula o desconto do cupão sobre o total do carrinho:
 * - PERCENTAGE — `discountValue` % do carrinho;
 * - FIXED_AMOUNT — `discountValue` em euros.
 * O desconto nunca é negativo nem excede o próprio carrinho (cupões com
 * percentagem > 100 ou fixo acima do total são limitados ao total).
 */
function computeCouponDiscount(
  coupon: CouponRecord,
  cartTotal: number,
): {
  discount: number
  newTotal: number
} {
  const base = roundToCents(cartTotal)

  const raw =
    coupon.discountType ===
    'PERCENTAGE'
      ? (base * coupon.discountValue) / 100
      : coupon.discountValue

  const discount = Math.max(
    0,
    Math.min(
      roundToCents(raw),
      base,
    ),
  )

  return {
    discount,
    newTotal: roundToCents(base - discount),
  }
}

/**
 * Verificações de negócio de um cupão lido da base de dados. A ordem é
 * determinística (documentada no `reason` do erro):
 * INACTIVE → NOT_STARTED → EXPIRED → LIMIT_REACHED → MIN_ORDER_NOT_MET.
 * Limites temporais: `startsAt` é inclusivo no instante (`== now` passa)
 * e `expiresAt` é exclusivo (`== now` já expirou).
 */
function assertCouponUsable(
  coupon: CouponRecord,
  cartTotal: number,
  now: Date = new Date(),
): void {
  if (!coupon.isActive) {
    throw new CouponRejectedError(
      'INACTIVE',
      'Este cupão não está ativo.',
    )
  }

  if (
    coupon.startsAt !== null &&
    coupon.startsAt.getTime() >
      now.getTime()
  ) {
    throw new CouponRejectedError(
      'NOT_STARTED',
      'Este cupão ainda não está ativo.',
    )
  }

  if (
    coupon.expiresAt !== null &&
    coupon.expiresAt.getTime() <=
      now.getTime()
  ) {
    throw new CouponRejectedError(
      'EXPIRED',
      'Este cupão expirou.',
    )
  }

  if (
    coupon.maxUses !== null &&
    coupon.usedCount >= coupon.maxUses
  ) {
    throw new CouponRejectedError(
      'LIMIT_REACHED',
      'Este cupão já atingiu o limite de utilizações.',
    )
  }

  if (
    coupon.minOrderValue !== null &&
    cartTotal < coupon.minOrderValue
  ) {
    throw new CouponRejectedError(
      'MIN_ORDER_NOT_MET',
      `Este cupão exige um subtotal mínimo de ${roundToCents(
        coupon.minOrderValue,
      ).toFixed(2)} €.`,
    )
  }
}

function getCouponDbClient(
  client?: CouponDbClient,
): CouponDbClient {
  return (
    client ??
    (prisma as unknown as CouponDbClient)
  )
}

function couponFailure(
  reason: CouponFailureReason,
  message: string,
): CouponValidationFailure {
  return {
    valid: false,
    reason,
    message,
  }
}

/**
 * Validação de leitura pura de um código de cupão, para uso no
 * endpoint público (autenticado) antes do pagamento. Nunca lança erros
 * de negócio: o resultado é uma união com `valid: false` e o motivo.
 * Apenas falha (ZodError) quando a ENTRADA é malformada — as rotas
 * convertem em 400.
 */
export async function validateCouponCode(
  input: CouponValidationInput,
  client?: CouponDbClient,
): Promise<CouponValidationResult> {
  const parsed =
    couponValidationSchema.parse({
      code: input?.code,
      cartTotal: input?.cartTotal,
    })

  const couponClient =
    getCouponDbClient(client)

  const coupon =
    await couponClient.coupon.findUnique(
      {
        where: {
          code: parsed.code,
        },
        select: couponSelect,
      },
    )

  if (!coupon) {
    return couponFailure(
      'NOT_FOUND',
      'Código de cupão não encontrado.',
    )
  }

  try {
    assertCouponUsable(
      coupon,
      parsed.cartTotal,
    )
  } catch (error) {
    if (
      error instanceof
      CouponRejectedError
    ) {
      return couponFailure(
        error.reason,
        error.message,
      )
    }

    throw error
  }

  const { discount, newTotal } =
    computeCouponDiscount(
      coupon,
      parsed.cartTotal,
    )

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    },
    discount,
    newTotal,
  }
}

/**
 * Avalia o cupão DENTRO de uma transação (leitura + verificações de
 * negócio) sem escrever nada. Usado pelo checkout no `prepareCheckout`
 * para aplicar o desconto ao pricing e ao fingerprint. Falha com
 * `CouponRejectedError` quando o cupão não pode ser aplicado.
 */
export async function evaluateCoupon(
  transaction: CouponTransactionClient,
  input: CouponValidationInput,
): Promise<CouponEvaluation> {
  const parsed =
    couponValidationSchema.parse({
      code: input?.code,
      cartTotal: input?.cartTotal,
    })

  const coupon =
    await transaction.coupon.findUnique(
      {
        where: {
          code: parsed.code,
        },
        select: couponSelect,
      },
    )

  if (!coupon) {
    throw new CouponRejectedError(
      'NOT_FOUND',
      'Código de cupão não encontrado.',
    )
  }

  assertCouponUsable(
    coupon,
    parsed.cartTotal,
  )

  const { discount, newTotal } =
    computeCouponDiscount(
      coupon,
      parsed.cartTotal,
    )

  return {
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discount,
    newTotal,
    maxUses: coupon.maxUses,
  }
}

/**
 * Incremento atómico do contador de utilizações. O `updateMany` é
 * guardado com `usedCount < maxUses` (quando existe limite): se outra
 * transação consumir a última utilização, esta falha com
 * LIMIT_REACHED em vez de exceder o limite.
 */
export async function incrementCouponUsage(
  transaction: CouponTransactionClient,
  input: {
    couponId: string
    maxUses: number | null
  },
): Promise<void> {
  const guard =
    input.maxUses === null
      ? {
          id: input.couponId,
        }
      : {
          id: input.couponId,
          usedCount: {
            lt: input.maxUses,
          },
        }

  const result =
    await transaction.coupon.updateMany(
      {
        where: guard,
        data: {
          usedCount: {
            increment: 1,
          },
        },
      },
    )

  if (result.count !== 1) {
    throw new CouponRejectedError(
      'LIMIT_REACHED',
      'Este cupão já não está disponível.',
    )
  }
}

/**
 * Aplica um cupão a uma encomenda DENTRO da transação do checkout:
 * avalia o cupão contra o total corrente e incrementa o uso de forma
 * atómica. A encomenda registada pelo chamador já reflete o desconto —
 * qualquer falha reverte a transação inteira.
 */
export async function applyCouponToOrder(
  transaction: CouponTransactionClient,
  input: CouponValidationInput,
): Promise<CouponEvaluation> {
  const evaluation =
    await evaluateCoupon(
      transaction,
      input,
    )

  await incrementCouponUsage(
    transaction,
    {
      couponId: evaluation.couponId,
      maxUses: evaluation.maxUses,
    },
  )

  return evaluation
}

/**
 * Cliente estrutural de leitura do carrinho, para calcular o subtotal
 * de produtos no servidor (endpoint de validação de cupões).
 */
export interface CartSubtotalClient {
  cartItem: {
    findMany(args: {
      where: {
        userId: string
      }
      orderBy: {
        id: 'asc'
      }
      select: {
        quantity: true
        variant: {
          select: {
            isActive: true
            price: true
          }
        }
        product: {
          select: {
            isActive: true
          }
        }
      }
    }): Promise<
      Array<{
        quantity: number
        variant: {
          isActive: boolean
          price: {
            toString(): string
          }
        }
        product: {
          isActive: boolean
        }
      }>
    >
  }
}

export type CartSubtotalRecord = {
  /** Subtotal de produtos vendáveis, em cêntimos. */
  subtotalCents: number
  /** Número de LINHAS do carrinho (0 = carrinho vazio). */
  itemCount: number
}

/**
 * Lê o subtotal de produtos do carrinho do utilizador com a mesma
 * disciplina do checkout: só itens de produto + variante ativos, com
 * quantidade válida, convertidos para cêntimos inteiros.
 */
export async function readCartSubtotalCents(
  userId: string,
  client?: CartSubtotalClient,
): Promise<CartSubtotalRecord> {
  const normalizedUserId =
    typeof userId === 'string'
      ? userId.trim()
      : ''

  if (!normalizedUserId) {
    return {
      subtotalCents: 0,
      itemCount: 0,
    }
  }

  const cartClient =
    (client ??
      (prisma as unknown as CartSubtotalClient))

  const items =
    await cartClient.cartItem.findMany({
      where: {
        userId: normalizedUserId,
      },
      orderBy: {
        id: 'asc',
      },
      select: {
        quantity: true,
        variant: {
          select: {
            isActive: true,
            price: true,
          },
        },
        product: {
          select: {
            isActive: true,
          },
        },
      },
    })

  let subtotalCents = 0
  let itemCount = 0

  for (const item of items) {
    itemCount += 1

    if (!item.product.isActive) {
      continue
    }

    if (!item.variant.isActive) {
      continue
    }

    if (
      !Number.isSafeInteger(
        item.quantity,
      ) ||
      item.quantity <= 0
    ) {
      continue
    }

    const priceCents =
      moneyStringToCents(
        item.variant.price.toString(),
      )

    subtotalCents +=
      priceCents * item.quantity
  }

  return {
    subtotalCents,
    itemCount,
  }
}

// ===========================================================================
// Épico 7 — etapa 2: reversão do uso (anulação/reembolso) + gestão admin
// ===========================================================================

/**
 * Argumentos do `updateMany` que marca a reversão na encomenda. O guard
 * `couponReversedAt: null` faz com que a marca só seja escrita UMA vez:
 * numa corrida concorrente apenas uma transação obtém `count === 1`.
 */
export type CouponReversalMarkerArgs = {
  where: {
    id: string
    couponReversedAt: null
  }
  data: {
    couponReversedAt: Date
  }
}

/**
 * Argumentos do `updateMany` que devolve uma utilização ao cupão. O
 * guard `usedCount: { gt: 0 }` impede contadores negativos e o código
 * evita depender do `id` (o cupão pode ter sido recriado).
 */
export type CouponReversalDecrementArgs = {
  where: {
    code: string
    usedCount: {
      gt: number
    }
  }
  data: {
    usedCount: {
      decrement: number
    }
  }
}

/**
 * Cliente de transação necessário para a reversão: a marca na encomenda
 * e o decremento no cupão partilham a MESMA transação da transição
 * (cancelamento ou reembolso), de modo que qualquer falha reverte tudo.
 */
export interface CouponReversalTransactionClient {
  order: {
    updateMany(
      args: CouponReversalMarkerArgs,
    ): Promise<{
      count: number
    }>
  }
  coupon: {
    updateMany(
      args: CouponReversalDecrementArgs,
    ): Promise<{
      count: number
    }>
  }
}

/**
 * Devolve uma utilização do cupão ao inventory de usos: decrementa
 * `usedCount` do cupão aplicado a uma encomenda anulada ou reembolsada.
 *
 * Tem de ser chamada DENTRO da transação da transição — se algo falhar,
 * nem o estado da encomenda nem o contador mudam.
 *
 * Comportamento:
 * - `couponCode` ausente/vazio → no-op (`false`): encomendas sem cupão
 *   nunca tocam nos delegates;
 * - marca primeiro (`couponReversedAt`, guard de `null`): se a marca já
 *   existir (reembolso seguido de cancelamento, ou corrida concorrente),
 *   devolve `false` sem tocar no cupão — a reversão acontece no máximo
 *   uma vez por encomenda;
 * - o decremento é guardado com `usedCount > 0` e é "best-effort": se o
 *   cupão já não existir (ou o contador já estiver a zero), a transição
 *   do pedido NÃO falha por causa do cupão.
 */
export async function decrementCouponUsage(
  transaction: CouponReversalTransactionClient,
  input: {
    orderId: string
    couponCode: string | null | undefined
    now?: Date
  },
): Promise<boolean> {
  const couponCode =
    typeof input.couponCode ===
    'string'
      ? input.couponCode.trim()
      : ''

  if (!couponCode) {
    return false
  }

  const marked =
    await transaction.order.updateMany(
      {
        where: {
          id: input.orderId,
          couponReversedAt: null,
        },
        data: {
          couponReversedAt:
            input.now ?? new Date(),
        },
      },
    )

  if (marked.count !== 1) {
    // Já revertido (ou corrida concorrente): não decrementar outra vez.
    return false
  }

  const reversed =
    await transaction.coupon.updateMany(
      {
        where: {
          code: couponCode.toUpperCase(),
          usedCount: {
            gt: 0,
          },
        },
        data: {
          usedCount: {
            decrement: 1,
          },
        },
      },
    )

  // Cupão eliminado ou contador já a zero: a transição do pedido não
  // falha por causa do cupão — a marca fica registada na encomenda.
  return reversed.count === 1
}

/** Estado administrativo derivado de um cupão (badge da tabela). */
export type AdminCouponStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'LIMIT_REACHED'

export const ADMIN_COUPON_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'EXPIRED',
  'LIMIT_REACHED',
] as const

/**
 * Estado efetivo do cupão para o backoffice. A precedência é
 * determinística: INACTIVE (desativado manualmente) → EXPIRED →
 * LIMIT_REACHED → ACTIVE. A janela temporal usa a mesma semântica do
 * motor: `expiresAt` é exclusivo (`== now` já expirou).
 */
export function adminCouponStatusFrom(
  coupon: CouponRecord,
  now: Date = new Date(),
): AdminCouponStatus {
  if (!coupon.isActive) {
    return 'INACTIVE'
  }

  if (
    coupon.expiresAt !== null &&
    coupon.expiresAt.getTime() <=
      now.getTime()
  ) {
    return 'EXPIRED'
  }

  if (
    coupon.maxUses !== null &&
    coupon.usedCount >= coupon.maxUses
  ) {
    return 'LIMIT_REACHED'
  }

  return 'ACTIVE'
}

/** Linha da tabela admin: cupão serializável + estado calculado. */
export type AdminCouponRow = {
  id: string
  code: string
  discountType: CouponDiscountType
  discountValue: number
  minOrderValue: number | null
  maxUses: number | null
  usedCount: number
  startsAt: string | null
  expiresAt: string | null
  isActive: boolean
  status: AdminCouponStatus
}

/** KPIs de topo da vista de cupões (sempre globais, sem filtros). */
export type AdminCouponKpis = {
  totalCoupons: number
  activeCoupons: number
  totalUses: number
}

/** Página da listagem admin: linhas filtradas + KPIs globais. */
export type AdminCouponsPage = {
  coupons: AdminCouponRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  kpis: AdminCouponKpis
}

export type CouponAdminField =
  | 'id'
  | 'code'
  | 'discountType'
  | 'discountValue'
  | 'minOrderValue'
  | 'maxUses'
  | 'startsAt'
  | 'expiresAt'
  | 'isActive'
  | 'status'

/** Erro de validação de negócio do backoffice (→ 400 na rota). */
export class CouponAdminValidationError extends Error {
  readonly field: CouponAdminField

  constructor(
    field: CouponAdminField,
    message: string,
  ) {
    super(message)
    this.name =
      'CouponAdminValidationError'
    this.field = field
  }
}

/** Cupão inexistente para a operação pedida (→ 404 na rota). */
export class CouponAdminNotFoundError extends Error {
  constructor(
    message = 'Cupão não encontrado',
  ) {
    super(message)
    this.name =
      'CouponAdminNotFoundError'
  }
}

/** Código único já ocupado na criação (→ 409 na rota). */
export class CouponCodeConflictError extends Error {
  constructor(
    message = 'Já existe um cupão com este código',
  ) {
    super(message)
    this.name =
      'CouponCodeConflictError'
  }
}

function toAdminCouponRow(
  record: CouponRecord,
  now: Date,
): AdminCouponRow {
  return {
    id: record.id,
    code: record.code,
    discountType:
      record.discountType,
    discountValue:
      record.discountValue,
    minOrderValue:
      record.minOrderValue,
    maxUses: record.maxUses,
    usedCount: record.usedCount,
    startsAt:
      record.startsAt?.toISOString() ??
      null,
    expiresAt:
      record.expiresAt?.toISOString() ??
      null,
    isActive: record.isActive,
    status:
      adminCouponStatusFrom(
        record,
        now,
      ),
  }
}

/**
 * Cliente admin do cupão: leituras e escritas do backoffice correm
 * todas sobre este delegate estrutural (o Prisma real chega por
 * conversão no helper `getAdminCouponDbClient`).
 */
export interface AdminCouponDbClient {
  coupon: {
    findMany(args: {
      orderBy: Array<
        | { createdAt: 'desc' }
        | { id: 'desc' }
      >
      take: number
      select: CouponSelect
    }): Promise<CouponRecord[]>

    findUnique(args: {
      where: {
        id: string
      }
      select: CouponSelect
    }): Promise<CouponRecord | null>

    create(args: {
      data: {
        code: string
        discountType: CouponDiscountType
        discountValue: number
        minOrderValue: number | null
        maxUses: number | null
        startsAt: Date | null
        expiresAt: Date | null
        isActive: boolean
      }
      select: CouponSelect
    }): Promise<CouponRecord>

    update(args: {
      where: {
        id: string
      }
      data: {
        isActive?: boolean
        discountValue?: number
        minOrderValue?: number | null
        maxUses?: number | null
        startsAt?: Date | null
        expiresAt?: Date | null
      }
      select: CouponSelect
    }): Promise<CouponRecord>
  }

  $transaction<T>(
    callback: (transaction: {
      coupon: {
        findUnique(
          args: {
            where: {
              id: string
            }
            select: CouponSelect
          },
        ): Promise<CouponRecord | null>
        update(
          args: {
            where: {
              id: string
            }
            data: {
              isActive?: boolean
              discountValue?: number
              minOrderValue?:
                | number
                | null
              maxUses?:
                | number
                | null
              startsAt?:
                | Date
                | null
              expiresAt?:
                | Date
                | null
            }
            select: CouponSelect
          },
        ): Promise<CouponRecord>
      }
    }) => Promise<T>,
  ): Promise<T>
}

function getAdminCouponDbClient(
  client?: AdminCouponDbClient,
): AdminCouponDbClient {
  return (
    client ??
    (prisma as unknown as AdminCouponDbClient)
  )
}

function normalizeAdminCouponId(
  value: unknown,
): string {
  if (
    typeof value !== 'string'
  ) {
    throw new CouponAdminNotFoundError()
  }

  const normalized =
    value.trim()

  if (!normalized) {
    throw new CouponAdminNotFoundError()
  }

  return normalized
}

// ---------------------------------------------------------------------------
// Listagem admin
// ---------------------------------------------------------------------------

export const ADMIN_COUPON_SEARCH_MAX_LENGTH =
  40

export const DEFAULT_ADMIN_COUPON_PAGE_SIZE =
  50

export const MAX_ADMIN_COUPON_PAGE_SIZE = 1000

/**
 * Teto de linhas lidas para KPIs + listagem: o `where` do Prisma não
 * compara dois campos da mesma tabela (`usedCount` ↔ `maxUses`), por
 * isso o estado é derivado em JS sobre as linhas carregadas — tal como
 * na vista de inventário do Épico 6.
 */
export const MAX_ADMIN_COUPON_ROWS = 1000

const adminCouponListMessages = {
  search:
    'A pesquisa deve ser texto',
  status:
    'Estado de cupão inválido',
  page:
    'A página deve ser um número inteiro',
  pageMin:
    'A página deve ser pelo menos 1',
  pageSize:
    'O tamanho da página deve ser um número inteiro',
  pageSizeRange: `O tamanho da página deve estar entre 1 e ${MAX_ADMIN_COUPON_PAGE_SIZE}`,
} as const

function isEmptyQueryValue(
  value: unknown,
) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' &&
      value.trim() === '')
  )
}

/**
 * Query da listagem admin de cupões: pesquisa parcial pelo código
 * (sem sensibilidade a maiúsculas), filtro de estado derivado,
 * paginação de 1 página em diante e `pageSize` limitado.
 */
export const adminCouponListQuerySchema =
  z.object({
    search: z.preprocess(
      (value) =>
        isEmptyQueryValue(value)
          ? undefined
          : value,
      z
        .string({
          message:
            adminCouponListMessages.search,
        })
        .trim()
        .min(1, {
          message:
            adminCouponListMessages.search,
        })
        .max(
          ADMIN_COUPON_SEARCH_MAX_LENGTH,
          {
            message: `A pesquisa não pode exceder ${ADMIN_COUPON_SEARCH_MAX_LENGTH} caracteres`,
          },
        )
        .optional(),
    ),
    status: z.preprocess(
      (value) =>
        isEmptyQueryValue(value)
          ? undefined
          : value,
      z.enum(ADMIN_COUPON_STATUSES, {
        message:
          adminCouponListMessages.status,
      }).optional(),
    ),
    page: z.preprocess(
      (value) =>
        isEmptyQueryValue(value)
          ? undefined
          : value,
      z.coerce
        .number({
          message:
            adminCouponListMessages.page,
        })
        .int({
          message:
            adminCouponListMessages.page,
        })
        .min(1, {
          message:
            adminCouponListMessages.pageMin,
        })
        .default(1),
    ),
    pageSize: z.preprocess(
      (value) =>
        isEmptyQueryValue(value)
          ? undefined
          : value,
      z.coerce
        .number({
          message:
            adminCouponListMessages.pageSize,
        })
        .int({
          message:
            adminCouponListMessages.pageSize,
        })
        .min(1, {
          message:
            adminCouponListMessages.pageSizeRange,
        })
        .max(
          MAX_ADMIN_COUPON_PAGE_SIZE,
          {
            message:
              adminCouponListMessages.pageSizeRange,
          },
        )
        .default(
          DEFAULT_ADMIN_COUPON_PAGE_SIZE,
        ),
    ),
  })

/**
 * Listagem admin de cupões: KPIs globais (total, ativos, utilizações
 * totais) derivados do MESMO conjunto de linhas que alimenta a tabela,
 * pesquisa parcial por código e filtro por estado derivado em JS, com
 * paginação — a última página real é o teto (pedidos além do fim
 * devolvem a última página em vez de uma página vazia).
 */
export async function listAdminCoupons(
  input:
    | {
        search?: unknown
        status?: unknown
        page?: unknown
        pageSize?: unknown
      }
    | undefined,
  client?: AdminCouponDbClient,
): Promise<AdminCouponsPage> {
  const query =
    adminCouponListQuerySchema.parse(
      {
        search: input?.search,
        status: input?.status,
        page: input?.page,
        pageSize:
          input?.pageSize,
      },
    )

  const adminClient =
    getAdminCouponDbClient(client)

  const records =
    await adminClient.coupon.findMany(
      {
        orderBy: [
          {
            createdAt:
              'desc',
          },
          { id: 'desc' },
        ],
        take: MAX_ADMIN_COUPON_ROWS,
        select: couponSelect,
      },
    )

  const now = new Date()

  const rows = records.map(
    (record) =>
      toAdminCouponRow(
        record,
        now,
      ),
  )

  // KPIs GLOBAIS: calculados sobre todos os cupões, independentemente
  // dos filtros — os cartões de topo nunca mudam com a pesquisa.
  const kpis: AdminCouponKpis = {
    totalCoupons: rows.length,
    activeCoupons: rows.filter(
      (row) =>
        row.status === 'ACTIVE',
    ).length,
    totalUses: rows.reduce(
      (sum, row) =>
        sum + row.usedCount,
      0,
    ),
  }

  const search = query.search
    ?.toLocaleLowerCase('pt-PT')

  const filtered = rows.filter(
    (row) => {
      const matchesSearch =
        !search ||
        row.code
          .toLocaleLowerCase('pt-PT')
          .includes(search)

      const matchesStatus =
        query.status ===
          undefined ||
        row.status ===
          query.status

      return (
        matchesSearch &&
        matchesStatus
      )
    },
  )

  // A última página real é o teto: sem páginas vazias além do fim.
  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length /
        query.pageSize,
    ),
  )

  const page = Math.min(
    query.page,
    totalPages,
  )

  const coupons =
    filtered.slice(
      (page - 1) * query.pageSize,
      page * query.pageSize,
    )

  return {
    coupons,
    total: filtered.length,
    page,
    pageSize: query.pageSize,
    totalPages,
    kpis,
  }
}

// ---------------------------------------------------------------------------
// Criação admin
// ---------------------------------------------------------------------------

const COUPON_DISCOUNT_VALUE_MESSAGE =
  'O valor do desconto deve ser um número'

const COUPON_DISCOUNT_VALUE_POSITIVE_MESSAGE =
  'O valor do desconto tem de ser superior a zero'

const COUPON_MAX_USES_MESSAGE =
  'O limite de utilizações deve ser um número inteiro'

const COUPON_DATE_MESSAGE =
  'Data inválida'

/**
 * Valor monetário admin (euros): aceita números e texto numérico
 * (inputs de formulário), recusa negativos e valores acima do teto do
 * Decimal(10,2) dos montantes persistidos.
 */
const couponAdminMoneySchema = z.coerce
  .number({
    message:
      COUPON_DISCOUNT_VALUE_MESSAGE,
  })
  .min(0, {
    message:
      'O valor não pode ser negativo',
  })
  .max(COUPON_MAX_CART_TOTAL, {
    message: `O valor excede o máximo suportado (${COUPON_MAX_CART_TOTAL} €)`,
  })

const couponAdminMaxUsesSchema = z.coerce
  .number({
    message:
      COUPON_MAX_USES_MESSAGE,
  })
  .int({
    message:
      COUPON_MAX_USES_MESSAGE,
  })
  .min(1, {
    message:
      'O limite de utilizações tem de ser pelo menos 1',
  })
  .max(COUPON_MAX_CART_TOTAL, {
    message: `O limite de utilizações não pode exceder ${COUPON_MAX_CART_TOTAL}`,
  })

const couponAdminDateSchema = z.coerce
  .date({
    message:
      COUPON_DATE_MESSAGE,
  })

/**
 * Na criação, campos ausentes/vazios/nulos significam "sem limite" ou
 * "sem janela temporal". O `preprocess` evita que `null`/'' cheguem ao
 * `z.coerce` (null → 0 e '' → 0 nos coerces numéricos).
 */
const optionalCreateMoneySchema = z.preprocess(
  (value) =>
    isEmptyQueryValue(value)
      ? undefined
      : value,
  couponAdminMoneySchema.optional(),
)

const optionalCreateMaxUsesSchema =
  z.preprocess(
    (value) =>
      isEmptyQueryValue(value)
        ? undefined
        : value,
    couponAdminMaxUsesSchema.optional(),
  )

const optionalCreateDateSchema = z.preprocess(
  (value) =>
    isEmptyQueryValue(value)
      ? undefined
      : value,
  couponAdminDateSchema.optional(),
)

/**
 * Payload de criação de cupão (Zod): código normalizado (trim +
 * maiúsculas), tipo + valor do desconto, limites opcionais e janela
 * temporal. As validações cruzadas (percentagem ≤ 100 e
 * `expiresAt` depois de `startsAt`) falham em `ZodError` → 400.
 */
export const couponCreateSchema = z
  .object({
    code: couponCodeSchema,
    discountType: z.enum(
      ['PERCENTAGE', 'FIXED_AMOUNT'],
      {
        message:
          'Tipo de desconto inválido',
      },
    ),
    discountValue: z.coerce
      .number({
        message:
          COUPON_DISCOUNT_VALUE_MESSAGE,
      })
      .positive({
        message:
          COUPON_DISCOUNT_VALUE_POSITIVE_MESSAGE,
      })
      .max(COUPON_MAX_CART_TOTAL, {
        message: `O valor do desconto excede o máximo suportado (${COUPON_MAX_CART_TOTAL} €)`,
      }),
    minOrderValue:
      optionalCreateMoneySchema,
    maxUses:
      optionalCreateMaxUsesSchema,
    startsAt:
      optionalCreateDateSchema,
    expiresAt:
      optionalCreateDateSchema,
    isActive: z
      .boolean({
        message:
          'O estado ativo deve ser verdadeiro ou falso',
      })
      .default(true),
  })
  .superRefine((value, ctx) => {
    if (
      value.discountType ===
        'PERCENTAGE' &&
      value.discountValue > 100
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountValue'],
        message:
          'A percentagem de desconto não pode exceder 100%',
      })
    }

    if (
      value.startsAt &&
      value.expiresAt &&
      value.startsAt.getTime() >=
        value.expiresAt.getTime()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message:
          'A data de fim tem de ser posterior à data de início',
      })
    }
  })

export type CouponCreateInput = z.infer<
  typeof couponCreateSchema
>

/**
 * Cria um cupão no backoffice. O código chega normalizado (trim +
 * maiúsculas) pelo schema; colisão de código único (P2002 do Prisma)
 * é convertida em `CouponCodeConflictError` → 409 na rota.
 */
export async function createAdminCoupon(
  input: unknown,
  client?: AdminCouponDbClient,
): Promise<AdminCouponRow> {
  const parsed =
    couponCreateSchema.parse(
      input ?? {},
    )

  const adminClient =
    getAdminCouponDbClient(client)

  try {
    const record =
      await adminClient.coupon.create({
        data: {
          code: parsed.code,
          discountType:
            parsed.discountType,
          discountValue:
            parsed.discountValue,
          minOrderValue:
            parsed.minOrderValue ??
            null,
          maxUses:
            parsed.maxUses ?? null,
          startsAt:
            parsed.startsAt ?? null,
          expiresAt:
            parsed.expiresAt ??
            null,
          isActive:
            parsed.isActive,
        },
        select: couponSelect,
      })

    return toAdminCouponRow(
      record,
      new Date(),
    )
  } catch (error) {
    if (
      (
        error as {
          code?: string
        } | null
      )?.code === 'P2002'
    ) {
      throw new CouponCodeConflictError()
    }

    throw error
  }
}

// ---------------------------------------------------------------------------
// Atualização admin (toggle + edição de limites/datas)
// ---------------------------------------------------------------------------

/**
 * Na atualização, ausente = "não mexer". Para os campos anuláveis,
 * `null` (ou string vazia) = "limpar o limite" — padrão do limiar
 * próprio do Épico 6, etapa 3. O `z.null()` é o PRIMEIRO membro da
 * união: nos coerces do Zod v4, `null` vira `0` (número) ou epoch
 * (data), por isso tem de casar ANTES do membro coercivo.
 */
const optionalUpdateMoneySchema = z.preprocess(
  (value) =>
    typeof value === 'string' &&
    value.trim() === ''
      ? null
      : value,
  z
    .union([
      z.null(),
      couponAdminMoneySchema,
    ])
    .optional(),
)

const optionalUpdateMaxUsesSchema =
  z.preprocess(
    (value) =>
      typeof value === 'string' &&
      value.trim() === ''
        ? null
        : value,
    z
      .union([
        z.null(),
        couponAdminMaxUsesSchema,
      ])
      .optional(),
  )

const optionalUpdateDateSchema =
  z.preprocess(
    (value) =>
      typeof value === 'string' &&
      value.trim() === ''
        ? null
        : value,
    z
      .union([
        z.null(),
        couponAdminDateSchema,
      ])
      .optional(),
  )

/**
 * Payload de atualização (Zod): `code` e `discountType` são
 * IMUTÁVEIS — as encomendas guardam o código como snapshot e o tipo
 * determina a semântica do valor guardado. Editável: `isActive`
 * (toggle), `discountValue`, `minOrderValue`, `maxUses`, `startsAt`
 * e `expiresAt`. Corpo sem campos → 400.
 */
export const couponUpdateSchema = z
  .object({
    isActive: z
      .boolean({
        message:
          'O estado ativo deve ser verdadeiro ou falso',
      })
      .optional(),
    discountValue: z.coerce
      .number({
        message:
          COUPON_DISCOUNT_VALUE_MESSAGE,
      })
      .positive({
        message:
          COUPON_DISCOUNT_VALUE_POSITIVE_MESSAGE,
      })
      .max(COUPON_MAX_CART_TOTAL, {
        message: `O valor do desconto excede o máximo suportado (${COUPON_MAX_CART_TOTAL} €)`,
      })
      .optional(),
    minOrderValue:
      optionalUpdateMoneySchema,
    maxUses:
      optionalUpdateMaxUsesSchema,
    startsAt:
      optionalUpdateDateSchema,
    expiresAt:
      optionalUpdateDateSchema,
  })
  .refine(
    (value) =>
      value.isActive !==
        undefined ||
      value.discountValue !==
        undefined ||
      value.minOrderValue !==
        undefined ||
      value.maxUses !==
        undefined ||
      value.startsAt !==
        undefined ||
      value.expiresAt !==
        undefined,
    {
      message:
        'Indica pelo menos um campo a atualizar',
      path: ['_form'],
    },
  )

export type CouponUpdateInput = z.infer<
  typeof couponUpdateSchema
>

/**
 * Atualiza um cupão (toggle de `isActive` e/ou edição de limites e
 * janela temporal). A leitura do estado atual e a escrita correm na
 * MESMA transação: os campos cruzados (percentagem ≤ 100 para cupões
 * PERCENTAGE, `expiresAt` depois de `startsAt`) são validados sobre os
 * valores EFETIVOS (patch mesclado com o atual) — um patch que isolado
 * seria válido não pode deixar o cupão num estado inválido.
 */
export async function updateAdminCoupon(
  idInput: unknown,
  input: unknown,
  client?: AdminCouponDbClient,
): Promise<AdminCouponRow> {
  const id =
    normalizeAdminCouponId(idInput)

  const parsed =
    couponUpdateSchema.parse(
      input ?? {},
    )

  const adminClient =
    getAdminCouponDbClient(client)

  return adminClient.$transaction(
    async (transaction) => {
      const current =
        await transaction.coupon.findUnique(
          {
            where: {
              id,
            },
            select: couponSelect,
          },
        )

      if (!current) {
        throw new CouponAdminNotFoundError()
      }

      const discountValue =
        parsed.discountValue ===
        undefined
          ? current.discountValue
          : parsed.discountValue

      if (
        current.discountType ===
          'PERCENTAGE' &&
        discountValue > 100
      ) {
        throw new CouponAdminValidationError(
          'discountValue',
          'A percentagem de desconto não pode exceder 100%',
        )
      }

      const startsAt =
        parsed.startsAt === undefined
          ? current.startsAt
          : parsed.startsAt

      const expiresAt =
        parsed.expiresAt ===
        undefined
          ? current.expiresAt
          : parsed.expiresAt

      if (
        startsAt !== null &&
        expiresAt !== null &&
        startsAt.getTime() >=
          expiresAt.getTime()
      ) {
        throw new CouponAdminValidationError(
          'expiresAt',
          'A data de fim tem de ser posterior à data de início',
        )
      }

      const data: {
        isActive?: boolean
        discountValue?: number
        minOrderValue?:
          | number
          | null
        maxUses?: number | null
        startsAt?: Date | null
        expiresAt?: Date | null
      } = {}

      if (
        parsed.isActive !==
        undefined
      ) {
        data.isActive =
          parsed.isActive
      }

      if (
        parsed.discountValue !==
        undefined
      ) {
        data.discountValue =
          parsed.discountValue
      }

      if (
        parsed.minOrderValue !==
        undefined
      ) {
        data.minOrderValue =
          parsed.minOrderValue
      }

      if (
        parsed.maxUses !== undefined
      ) {
        data.maxUses =
          parsed.maxUses
      }

      if (
        parsed.startsAt !== undefined
      ) {
        data.startsAt =
          parsed.startsAt
      }

      if (
        parsed.expiresAt !==
        undefined
      ) {
        data.expiresAt =
          parsed.expiresAt
      }

      const updated =
        await transaction.coupon.update(
          {
            where: {
              id,
            },
            data,
            select: couponSelect,
          },
        )

      return toAdminCouponRow(
        updated,
        new Date(),
      )
    },
  )
}

/**
 * Toggle rápido de estado ativo (ações da tabela do backoffice).
 * Delega na atualização com o campo `isActive` obrigatório.
 */
export async function toggleAdminCouponStatus(
  input:
    | {
        id?: unknown
        isActive?: unknown
      }
    | undefined,
  client?: AdminCouponDbClient,
): Promise<AdminCouponRow> {
  if (
    typeof input?.isActive !==
    'boolean'
  ) {
    throw new CouponAdminValidationError(
      'isActive',
      'Indica se o cupão deve ficar ativo ou inativo',
    )
  }

  return updateAdminCoupon(
    input?.id,
    {
      isActive: input.isActive,
    },
    client,
  )
}
