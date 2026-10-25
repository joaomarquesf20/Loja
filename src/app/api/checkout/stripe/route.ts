import { NextResponse } from 'next/server'

import {
  type CheckoutInput,
  createCheckoutOrder,
} from '@/server/checkout'
import {
  readJsonBody,
} from '@/server/http-request'
import {
  StripeCheckoutConflictError,
  StripeCheckoutOrderNotFoundError,
  StripeConfigurationError,
  StripeSessionRequestError,
  StripeValidationError,
  initiateStripeCheckoutForOrder,
} from '@/server/stripe'
import {
  requireActiveUserId,
} from '@/server/user-auth'
import {
  CHECKOUT_JSON_LIMIT_BYTES,
  handleCheckoutError,
  parseCheckoutRequestBody,
} from '../checkout-request'

/**
 * Criação de encomenda + sessão de Checkout do Stripe num único pedido.
 * O stock é reservado na criação da encomenda; a sessão converge depois
 * o pagamento via webhook.
 */

/**
 * URLs de retorno para a sessão Stripe. A marca {CHECKOUT_SESSION_ID} é
 * substituída pelo próprio Stripe na resposta da sessão.
 */
const STRIPE_CHECKOUT_SUCCESS_PATH =
  '/checkout/sucesso'
const STRIPE_CHECKOUT_CANCEL_PATH =
  '/checkout/cancelado'
const STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER =
  '{CHECKOUT_SESSION_ID}'

const DEFAULT_CHECKOUT_BASE_URL =
  'http://localhost:3000'

function getCheckoutBaseUrl() {
  const configured =
    process.env.NEXTAUTH_URL?.trim()

  const base =
    configured &&
    configured.length > 0
      ? configured
      : DEFAULT_CHECKOUT_BASE_URL

  return base.replace(/\/+$/, '')
}

function handleStripeCheckoutError(
  error: unknown,
) {
  if (
    error instanceof
    StripeConfigurationError
  ) {
    console.error(
      'Stripe checkout configuration error:',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Pagamento por Stripe indisponível nesta loja',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      {
        status: 500,
      },
    )
  }

  if (
    error instanceof
    StripeSessionRequestError
  ) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'STRIPE_UNAVAILABLE',
      },
      {
        status: 502,
      },
    )
  }

  if (
    error instanceof
    StripeCheckoutOrderNotFoundError
  ) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'ORDER_NOT_FOUND',
      },
      {
        status: 404,
      },
    )
  }

  if (
    error instanceof
    StripeCheckoutConflictError
  ) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'CHECKOUT_CONFLICT',
      },
      {
        status: 409,
      },
    )
  }

  if (
    error instanceof
    StripeValidationError
  ) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'INVALID_REQUEST',
      },
      {
        status: 400,
      },
    )
  }

  return handleCheckoutError(
    error,
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
    } as CheckoutInput

    const order =
      await createCheckoutOrder(
        userId,
        checkoutInput,
        parsed.expectedFingerprint,
      )

    const base = getCheckoutBaseUrl()

    const session =
      await initiateStripeCheckoutForOrder(
        order.id,
        userId,
        {
          successUrl: `${base}${STRIPE_CHECKOUT_SUCCESS_PATH}?order=${encodeURIComponent(order.orderNumber)}&session_id=${STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER}`,
          cancelUrl: `${base}${STRIPE_CHECKOUT_CANCEL_PATH}`,
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
