import { NextResponse } from 'next/server'

import { ZodError } from 'zod'

import {
  readCartSubtotalCents,
  validateCouponCode,
} from '@/server/coupons'
import {
  InvalidJsonBodyError,
  readJsonBody,
  RequestPayloadTooLargeError,
} from '@/server/http-request'
import {
  requireActiveUserId,
  UnauthorizedUserError,
} from '@/server/user-auth'

/**
 * Épico 7 — validação de cupões antes do pagamento.
 *
 * Autenticada como o resto do checkout (`requireActiveUserId`). O
 * subtotal de produtos é calculado NO SERVIDOR a partir do carrinho do
 * utilizador — o cliente não o fornece — e a resposta devolve o
 * desconto e o total atualizado, ou `valid: false` com o motivo
 * (200: é um resultado de negócio, não um erro HTTP).
 */

const COUPON_JSON_LIMIT_BYTES = 4 * 1024

type CouponValidateApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_REQUEST'

function errorResponse(
  message: string,
  status: number,
  code?: CouponValidateApiErrorCode,
) {
  return NextResponse.json(
    code
      ? {
          error: message,
          code,
        }
      : {
          error: message,
        },
    {
      status,
    },
  )
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

export async function POST(
  request: Request,
) {
  try {
    const userId =
      await requireActiveUserId()

    const body = await readJsonBody(
      request,
      COUPON_JSON_LIMIT_BYTES,
    )

    const code = isRecord(body)
      ? body.code
      : undefined

    const cart =
      await readCartSubtotalCents(
        userId,
      )

    if (cart.itemCount === 0) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'EMPTY_CART',
          message:
            'O carrinho está vazio. Adiciona produtos antes de aplicar um cupão.',
        },
        {
          status: 200,
        },
      )
    }

    const result =
      await validateCouponCode({
        code,
        cartTotal:
          cart.subtotalCents / 100,
      })

    return NextResponse.json(
      result,
      {
        status: 200,
      },
    )
  } catch (error) {
    if (
      error instanceof
      UnauthorizedUserError
    ) {
      return errorResponse(
        'Não autenticado',
        401,
        'UNAUTHENTICATED',
      )
    }

    if (
      error instanceof
      RequestPayloadTooLargeError
    ) {
      return errorResponse(
        'Pedido demasiado grande',
        413,
        'PAYLOAD_TOO_LARGE',
      )
    }

    if (
      error instanceof
      InvalidJsonBodyError
    ) {
      return errorResponse(
        'JSON inválido',
        400,
        'INVALID_JSON',
      )
    }

    // ZodError → 400: quando existir, a mensagem do campo `code` é
    // mais útil que um 'Dados inválidos' genérico.
    if (
      error instanceof
      ZodError
    ) {
      const codeIssue =
        error.issues.find(
          (issue) =>
            issue.path[0] ===
            'code',
        )

      return NextResponse.json(
        {
          error:
            codeIssue?.message ??
            'Dados inválidos',
        },
        {
          status: 400,
        },
      )
    }

    console.error(
      'Unexpected coupon validation API error:',
      error,
    )

    return errorResponse(
      'Erro interno do servidor',
      500,
    )
  }
}
