import { NextResponse } from 'next/server'

import {
  CheckoutCartChangedError,
  CheckoutEmptyCartError,
  CheckoutInsufficientStockError,
  CheckoutPricingError,
  CheckoutProductUnavailableError,
  type CheckoutContactInput,
  type CheckoutFulfillmentInput,
  type CheckoutInput,
  type CheckoutPaymentInput,
  type CheckoutShippingInput,
  CheckoutUserUnavailableError,
  CheckoutValidationError,
  previewCheckout,
} from '@/server/checkout'
import {
  InvalidJsonBodyError,
  readJsonBody,
  RequestPayloadTooLargeError,
} from '@/server/http-request'
import {
  requireActiveUserId,
  UnauthorizedUserError,
} from '@/server/user-auth'

const CHECKOUT_JSON_LIMIT_BYTES =
  32 * 1024

type CheckoutPreviewApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_REQUEST'
  | 'INVALID_FULFILLMENT_METHOD'
  | 'INVALID_SHIPPING'
  | 'INVALID_PAYMENT'

function errorResponse(
  message: string,
  status: number,
  code?: CheckoutPreviewApiErrorCode,
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
        2_147_483_647
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

function handleCheckoutPreviewError(
  error: unknown,
) {
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
    CheckoutValidationError
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

  console.error(
    'Unexpected checkout preview API error:',
    error,
  )

  return errorResponse(
    'Erro interno do servidor',
    500,
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

    if (!isRecord(body)) {
      return errorResponse(
        'Pedido inválido',
        400,
        'INVALID_REQUEST',
      )
    }

    const fulfillmentMethod =
      body.fulfillmentMethod

    if (
      fulfillmentMethod !==
        'DELIVERY' &&
      fulfillmentMethod !==
        'PICKUP'
    ) {
      return errorResponse(
        'Método de entrega inválido',
        400,
        'INVALID_FULFILLMENT_METHOD',
      )
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
        return errorResponse(
          'Dados de entrega inválidos',
          400,
          'INVALID_SHIPPING',
        )
      }

      fulfillment = {
        fulfillmentMethod:
          'DELIVERY',
        shipping,
      }
    } else {
      const shipping =
        parseContactInput(
          body.shipping,
        )

      if (!shipping) {
        return errorResponse(
          'Dados para levantamento inválidos',
          400,
          'INVALID_SHIPPING',
        )
      }

      fulfillment = {
        fulfillmentMethod:
          'PICKUP',
        shipping,
      }
    }

    const payment =
      parsePaymentInput(body)

    if (!payment) {
      return errorResponse(
        'Dados de pagamento inválidos',
        400,
        'INVALID_PAYMENT',
      )
    }

    const checkoutInput = {
      ...fulfillment,
      ...payment,
    } as CheckoutInput

    const preview =
      await previewCheckout(
        userId,
        checkoutInput,
      )

    return NextResponse.json({
      preview,
    })
  } catch (error) {
    return handleCheckoutPreviewError(
      error,
    )
  }
}
