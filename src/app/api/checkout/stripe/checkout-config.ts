import { NextResponse } from 'next/server'

import {
  StripeCheckoutConflictError,
  StripeCheckoutOrderNotFoundError,
  StripeConfigurationError,
  StripeSessionRequestError,
  StripeValidationError,
} from '@/server/stripe'

import { handleCheckoutError } from '../checkout-request'

/**
 * Configuração partilhada pelas rotas da sessão de Checkout do Stripe
 * (criação e retoma): URLs de retorno, base URL e mapeamento dos erros
 * do serviço Stripe em respostas HTTP, para que ambos os fluxos sejam
 * equivalentes para o cliente.
 */

/**
 * URLs de retorno para a sessão Stripe. A marca {CHECKOUT_SESSION_ID} é
 * substituída pelo próprio Stripe na resposta da sessão.
 */
export const STRIPE_CHECKOUT_SUCCESS_PATH =
  '/checkout/sucesso'
export const STRIPE_CHECKOUT_CANCEL_PATH =
  '/checkout/cancelado'
export const STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER =
  '{CHECKOUT_SESSION_ID}'

export const DEFAULT_CHECKOUT_BASE_URL =
  'http://localhost:3000'

export function getCheckoutBaseUrl() {
  const configured =
    process.env.NEXTAUTH_URL?.trim()

  const base =
    configured &&
    configured.length > 0
      ? configured
      : DEFAULT_CHECKOUT_BASE_URL

  return base.replace(/\/+$/, '')
}

/**
 * URL de sucesso da sessão: devolve o utilizador a /checkout/sucesso com
 * o número da encomenda e a sessão que o Stripe confirmou.
 */
export function buildStripeCheckoutSuccessUrl(
  orderNumber: string,
) {
  return `${getCheckoutBaseUrl()}${STRIPE_CHECKOUT_SUCCESS_PATH}?order=${encodeURIComponent(orderNumber)}&session_id=${STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER}`
}

/**
 * URL de cancelamento da sessão: devolve o utilizador a
 * /checkout/cancelado, onde pode tentar o pagamento de novo.
 */
export function buildStripeCheckoutCancelUrl() {
  return `${getCheckoutBaseUrl()}${STRIPE_CHECKOUT_CANCEL_PATH}`
}

/**
 * Mapeamento dos erros do serviço Stripe em respostas HTTP. Erros
 * desconhecidos são registados e convertidos em 500.
 */
export function handleStripeCheckoutError(
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
