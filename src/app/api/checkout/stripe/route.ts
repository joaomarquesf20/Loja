import { NextResponse } from 'next/server'

import {
  type CheckoutInput,
  createCheckoutOrder,
} from '@/server/checkout'
import {
  readJsonBody,
} from '@/server/http-request'
import {
  initiateStripeCheckoutForOrder,
} from '@/server/stripe'
import {
  requireActiveUserId,
} from '@/server/user-auth'
import {
  CHECKOUT_JSON_LIMIT_BYTES,
  parseCheckoutRequestBody,
} from '../checkout-request'
import {
  buildStripeCheckoutCancelUrl,
  buildStripeCheckoutSuccessUrl,
  handleStripeCheckoutError,
} from './checkout-config'

/**
 * Criação de encomenda + sessão de Checkout do Stripe num único pedido.
 * O stock é reservado na criação da encomenda; a sessão converge depois
 * o pagamento via webhook.
 */

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

    const parsed =
      parseCheckoutRequestBody(body)

    if (!parsed.ok) {
      return parsed.response
    }

    const checkoutInput = {
      ...parsed.fulfillment,
      ...parsed.payment,
      couponCode:
        parsed.couponCode,
    } as CheckoutInput

    const order =
      await createCheckoutOrder(
        userId,
        checkoutInput,
        parsed.expectedFingerprint,
      )

    const session =
      await initiateStripeCheckoutForOrder(
        order.id,
        userId,
        {
          successUrl:
            buildStripeCheckoutSuccessUrl(
              order.orderNumber,
            ),
          cancelUrl:
            buildStripeCheckoutCancelUrl(),
        },
      )

    return NextResponse.json(
      {
        order,
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
