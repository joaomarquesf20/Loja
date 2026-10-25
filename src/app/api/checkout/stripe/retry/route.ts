import { NextResponse } from 'next/server'

import { readJsonBody } from '@/server/http-request'
import {
  retryStripeCheckoutForOrder,
} from '@/server/stripe'
import {
  requireActiveUserId,
} from '@/server/user-auth'
import {
  CHECKOUT_JSON_LIMIT_BYTES,
} from '../../checkout-request'
import {
  buildStripeCheckoutCancelUrl,
  buildStripeCheckoutSuccessUrl,
  handleStripeCheckoutError,
} from '../checkout-config'

/**
 * Retoma do pagamento: cria uma NOVA sessão de Checkout do Stripe para
 * uma encomenda pendente do utilizador autenticado — por exemplo, quando
 * a sessão anterior expirou ou o pagamento foi abandonado. O stock
 * permanece reservado desde a criação da encomenda; a resposta contém o
 * URL alojado no Stripe para onde o browser navega de imediato.
 */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function getOrderId(body: unknown) {
  if (!isRecord(body)) {
    return undefined
  }

  return body.orderId
}

export async function POST(
  request: Request,
) {
  try {
    const userId =
      await requireActiveUserId()

    const body = await readJsonBody(
      request,
      CHECKOUT_JSON_LIMIT_BYTES,
    )

    const session =
      await retryStripeCheckoutForOrder(
        getOrderId(body),
        userId,
        {
          buildSuccessUrl:
            buildStripeCheckoutSuccessUrl,
          cancelUrl:
            buildStripeCheckoutCancelUrl(),
        },
      )

    return NextResponse.json(
      {
        orderNumber: session.orderNumber,
        checkoutSession: {
          id: session.sessionId,
          url: session.sessionUrl,
        },
      },
      {
        status: 201,
      },
    )
  } catch (error) {
    return handleStripeCheckoutError(
      error,
    )
  }
}
