import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/server/auth'
import {
  CheckoutCartChangedError,
  CheckoutEmptyCartError,
  CheckoutInsufficientStockError,
  CheckoutPricingError,
  CheckoutProductUnavailableError,
  type CheckoutShippingInput,
  CheckoutUserUnavailableError,
  CheckoutValidationError,
  createCheckoutOrder,
} from '@/server/checkout'

function errorResponse(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
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

async function getAuthenticatedUserId() {
  const session =
    await getServerSession(authOptions)

  const userId =
    session?.user?.id?.trim()

  return userId || null
}

function parseShippingInput(
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

function handleCheckoutError(
  error: unknown,
) {
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
    'Unexpected checkout API error:',
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
      await getAuthenticatedUserId()

    if (!userId) {
      return errorResponse(
        'Não autenticado',
        401,
      )
    }

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return errorResponse(
        'JSON inválido',
        400,
      )
    }

    if (!isRecord(body)) {
      return errorResponse(
        'Pedido inválido',
        400,
      )
    }

    const shipping =
      parseShippingInput(
        body.shipping,
      )

    if (!shipping) {
      return errorResponse(
        'Dados de entrega inválidos',
        400,
      )
    }

    const order =
      await createCheckoutOrder(
        userId,
        shipping,
      )

    return NextResponse.json(
      {
        order,
      },
      {
        status: 201,
      },
    )
  } catch (error) {
    return handleCheckoutError(
      error,
    )
  }
}
