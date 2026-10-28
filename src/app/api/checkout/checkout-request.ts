import { NextResponse } from 'next/server'

import {
  CheckoutCartChangedError,
  CheckoutEmptyCartError,
  CheckoutInsufficientStockError,
  CheckoutPreviewChangedError,
  CheckoutPricingError,
  CheckoutProductUnavailableError,
  type CheckoutContactInput,
  type CheckoutFulfillmentInput,
  type CheckoutPaymentInput,
  type CheckoutShippingInput,
  CheckoutUserUnavailableError,
  CheckoutValidationError,
} from '@/server/checkout'
import {
  COUPON_CODE_MAX_LENGTH,
  CouponRejectedError,
} from '@/server/coupons'
import {
  InvalidJsonBodyError,
  RequestPayloadTooLargeError,
} from '@/server/http-request'
import { UnauthorizedUserError } from '@/server/user-auth'

/**
 * Parsing e mapeamento de erros partilhados entre as rotas de checkout
 * (pagamento simulado e sessões Stripe), para que a validação do pedido
 * seja idêntica nos dois fluxos.
 */

export const CHECKOUT_JSON_LIMIT_BYTES =
  32 * 1024

export type CheckoutApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_REQUEST'
  | 'INVALID_FULFILLMENT_METHOD'
  | 'INVALID_SHIPPING'
  | 'INVALID_SHIPPING_METHOD'
  | 'INVALID_PAYMENT'
  | 'INVALID_FINGERPRINT'
  | 'INVALID_COUPON_CODE'
  | 'CHECKOUT_PREVIEW_CHANGED'

export function errorResponse(
  message: string,
  status: number,
  code?: CheckoutApiErrorCode,
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

function parseContactInput(
  value: unknown,
): CheckoutContactInput | null {
  if (!isRecord(value)) {
    return null
  }

  const { name, phone } = value

  if (
    typeof name !== 'string' ||
    typeof phone !== 'string'
  ) {
    return null
  }

  return {
    name,
    phone,
  }
}

function parseDeliveryShippingInput(
  value: unknown,
): CheckoutShippingInput | null {
  if (!isRecord(value)) {
    return null
  }

  const {
    name,
    phone,
    addressLine1,
    addressLine2,
    city,
    postalCode,
    country,
    region,
  } = value

  if (
    typeof name !== 'string' ||
    typeof phone !== 'string' ||
    typeof addressLine1 !== 'string' ||
    typeof city !== 'string' ||
    typeof postalCode !== 'string' ||
    typeof country !== 'string' ||
    typeof region !== 'string'
  ) {
    return null
  }

  if (
    addressLine2 !== undefined &&
    addressLine2 !== null &&
    typeof addressLine2 !== 'string'
  ) {
    return null
  }

  return {
    name,
    phone,
    addressLine1,
    addressLine2,
    city,
    postalCode,
    country,
    region:
      region as CheckoutShippingInput['region'],
  }
}

function parsePaymentInput(
  body: Record<string, unknown>,
): CheckoutPaymentInput | null {
  const paymentMethod =
    body.paymentMethod
  const installmentCount =
    body.installmentCount

  if (paymentMethod === 'CARD') {
    if (
      installmentCount !== undefined &&
      installmentCount !== null
    ) {
      return null
    }

    return {
      paymentMethod: 'CARD',
      installmentCount: null,
    }
  }

  if (
    paymentMethod === 'INSTALLMENTS'
  ) {
    if (
      typeof installmentCount !==
        'number' ||
      !Number.isSafeInteger(
        installmentCount,
      ) ||
      installmentCount < 2 ||
      installmentCount >
        12
    ) {
      return null
    }

    return {
      paymentMethod: 'INSTALLMENTS',
      installmentCount,
    }
  }

  return null
}

export type ParsedCheckoutRequestBody = {
  ok: true
  fulfillment: CheckoutFulfillmentInput
  payment: CheckoutPaymentInput
  /** Épico 7 — código de cupão normalizado (null = sem cupão). */
  couponCode: string | null
  expectedFingerprint: string
} | {
  ok: false
  response: NextResponse
}

function invalidFingerprintResponse() {
  return errorResponse(
    'Referência de preview inválida. Calcula novamente o total.',
    400,
    'INVALID_FINGERPRINT',
  )
}

/**
 * Valida o corpo de um pedido de checkout e devolve a entrada do serviço
 * pronta a usar. Erros de validação regressam como resposta HTTP pronta.
 */
export function parseCheckoutRequestBody(
  body: unknown,
): ParsedCheckoutRequestBody {
  if (!isRecord(body)) {
    return {
      ok: false,
      response: errorResponse(
        'Pedido inválido',
        400,
        'INVALID_REQUEST',
      ),
    }
  }

  const fulfillmentMethod =
    body.fulfillmentMethod

  if (
    fulfillmentMethod !==
      'DELIVERY' &&
    fulfillmentMethod !==
      'PICKUP'
  ) {
    return {
      ok: false,
      response: errorResponse(
        'Método de entrega inválido',
        400,
        'INVALID_FULFILLMENT_METHOD',
      ),
    }
  }

  const shippingMethod =
    body.shippingMethod

  if (
    shippingMethod !==
      undefined &&
    shippingMethod !==
      'STANDARD' &&
    shippingMethod !==
      'EXPRESS'
  ) {
    return {
      ok: false,
      response: errorResponse(
        'Método de envio inválido',
        400,
        'INVALID_SHIPPING_METHOD',
      ),
    }
  }

  let fulfillment:
    CheckoutFulfillmentInput

  if (
    fulfillmentMethod ===
    'DELIVERY'
  ) {
    const shipping =
      parseDeliveryShippingInput(
        body.shipping,
      )

    if (!shipping) {
      return {
        ok: false,
        response: errorResponse(
          'Dados de entrega inválidos',
          400,
          'INVALID_SHIPPING',
        ),
      }
    }

    fulfillment = {
      fulfillmentMethod:
        'DELIVERY',
      shipping,
      shippingMethod,
    }
  } else {
    if (
      shippingMethod !==
      undefined
    ) {
      return {
        ok: false,
        response: errorResponse(
          'O levantamento em loja não tem método de envio',
          400,
          'INVALID_SHIPPING_METHOD',
        ),
      }
    }

    const shipping =
      parseContactInput(
        body.shipping,
      )

    if (!shipping) {
      return {
        ok: false,
        response: errorResponse(
          'Dados para levantamento inválidos',
          400,
          'INVALID_SHIPPING',
        ),
      }
    }

    fulfillment = {
      fulfillmentMethod:
        'PICKUP',
      shipping,
    }
  }

  const payment =
    parsePaymentInput(
      body,
    )

  if (!payment) {
    return {
      ok: false,
      response: errorResponse(
        'Dados de pagamento inválidos',
        400,
        'INVALID_PAYMENT',
      ),
    }
  }

  const expectedFingerprint =
    body.expectedFingerprint

  if (
    typeof expectedFingerprint !==
      'string' ||
    expectedFingerprint.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(
      expectedFingerprint,
    )
  ) {
    return {
      ok: false,
      response:
        invalidFingerprintResponse(),
    }
  }

  // Épico 7 — código de cupão opcional: normalizado como no serviço
  // (trim + maiúsculas; vazio → null) e recusado com resposta própria
  // quando malformado.
  let couponCode: string | null = null

  if (
    body.couponCode !== undefined &&
    body.couponCode !== null
  ) {
    if (
      typeof body.couponCode !==
        'string'
    ) {
      return {
        ok: false,
        response: errorResponse(
          'Código de cupão inválido',
          400,
          'INVALID_COUPON_CODE',
        ),
      }
    }

    couponCode =
      body.couponCode
        .trim()
        .toUpperCase()

    if (couponCode === '') {
      couponCode = null
    }

    if (
      couponCode !== null &&
      couponCode.length >
        COUPON_CODE_MAX_LENGTH
    ) {
      return {
        ok: false,
        response: errorResponse(
          `O código de cupão não pode exceder ${COUPON_CODE_MAX_LENGTH} caracteres`,
          400,
          'INVALID_COUPON_CODE',
        ),
      }
    }
  }

  return {
    ok: true,
    fulfillment,
    payment,
    couponCode,
    expectedFingerprint,
  }
}

/**
 * Mapeamento das falhas de domínio do checkout. Erros desconhecidos são
 * registados e convertidos em 500 por handleCheckoutError.
 */
export function mapCheckoutDomainError(
  error: unknown,
): NextResponse | null {
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

  if (
    error instanceof
    CheckoutPreviewChangedError
  ) {
    return errorResponse(
      error.message,
      409,
      'CHECKOUT_PREVIEW_CHANGED',
    )
  }

  if (
    error instanceof
    CheckoutValidationError
  ) {
    return errorResponse(
      error.message,
      400,
    )
  }

  // Épico 7 — cupão recusado no checkout (expirado, limite atingido,
  // total mínimo não cumprido, ...): 400 com a mensagem de negócio.
  if (
    error instanceof
    CouponRejectedError
  ) {
    return errorResponse(
      error.message,
      400,
    )
  }

  if (
    error instanceof
    CheckoutUserUnavailableError
  ) {
    return errorResponse(
      error.message,
      403,
    )
  }

  if (
    error instanceof
      CheckoutEmptyCartError ||
    error instanceof
      CheckoutProductUnavailableError ||
    error instanceof
      CheckoutInsufficientStockError ||
    error instanceof
      CheckoutCartChangedError ||
    error instanceof
      CheckoutPricingError
  ) {
    return errorResponse(
      error.message,
      409,
    )
  }

  return null
}

export function handleCheckoutError(
  error: unknown,
) {
  const mapped =
    mapCheckoutDomainError(error)

  if (mapped) {
    return mapped
  }

  console.error(
    'Unexpected checkout API error:',
    error,
  )

  return errorResponse(
    'Erro interno do servidor',
    500,
  )
}
