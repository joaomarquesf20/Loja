import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/server/auth'
import {
  CartInsufficientStockError,
  CartProductUnavailableError,
  CartValidationError,
} from '@/server/cart'
import {
  CartMergeUserUnavailableError,
  mergeGuestCartIntoUserCart,
} from '@/server/cart-merge'
import {
  GuestCartServerValidationError,
  type GuestCartInputItem,
} from '@/server/guest-cart'

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

function handleMergeError(
  error: unknown,
) {
  if (
    error instanceof
      GuestCartServerValidationError ||
    error instanceof
      CartValidationError
  ) {
    return errorResponse(
      error.message,
      400,
    )
  }

  if (
    error instanceof
    CartMergeUserUnavailableError
  ) {
    return errorResponse(
      error.message,
      403,
    )
  }

  if (
    error instanceof
    CartProductUnavailableError
  ) {
    return errorResponse(
      error.message,
      404,
    )
  }

  if (
    error instanceof
    CartInsufficientStockError
  ) {
    return errorResponse(
      error.message,
      409,
    )
  }

  console.error(
    'Unexpected cart merge API error:',
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

    if (
      !isRecord(body) ||
      !Array.isArray(body.items)
    ) {
      return errorResponse(
        'Pedido inválido',
        400,
      )
    }

    const items: GuestCartInputItem[] =
      []

    for (const rawItem of body.items) {
      if (!isRecord(rawItem)) {
        return errorResponse(
          'Item inválido',
          400,
        )
      }

      const productId =
        rawItem.productId

      const quantity =
        rawItem.quantity

      if (
        typeof productId !==
        'string'
      ) {
        return errorResponse(
          'Produto inválido',
          400,
        )
      }

      if (
        typeof quantity !==
        'number'
      ) {
        return errorResponse(
          'Quantidade inválida',
          400,
        )
      }

      items.push({
        productId,
        quantity,
      })
    }

    const result =
      await mergeGuestCartIntoUserCart(
        userId,
        items,
      )

    return NextResponse.json(
      result,
    )
  } catch (error) {
    return handleMergeError(error)
  }
}
