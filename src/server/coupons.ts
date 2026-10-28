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
