import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/server/auth'
import {
  CartInsufficientStockError,
  CartProductUnavailableError,
  CartValidationError,
} from '@/server/cart'
import {
  CartMergeConflictError,
  CartMergeUserUnavailableError,
  mergeGuestCartIntoUserCart,
} from '@/server/cart-merge'
import {
  GuestCartServerValidationError,
  type GuestCartInputItem,
} from '@/server/guest-cart'

type CartMergeErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'INVALID_MERGE_KEY'
  | 'INVALID_ITEM'
  | 'INVALID_PRODUCT'
  | 'INVALID_QUANTITY'
  | 'GUEST_CART_VALIDATION'
  | 'CART_VALIDATION'
  | 'USER_UNAVAILABLE'
  | 'MERGE_CONFLICT'
  | 'PRODUCT_UNAVAILABLE'
  | 'INSUFFICIENT_STOCK'
  | 'INTERNAL_ERROR'

function errorResponse(
  message: string,
  code: CartMergeErrorCode,
  status: number,
) {
  return NextResponse.json(
    {
      error: message,
      code,
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
    GuestCartServerValidationError
  ) {
    return errorResponse(
      error.message,
      'GUEST_CART_VALIDATION',
      400,
    )
  }

  if (
    error instanceof
    CartValidationError
  ) {
    return errorResponse(
      error.message,
      'CART_VALIDATION',
      400,
    )
  }

  if (
    error instanceof
    CartMergeUserUnavailableError
  ) {
    return errorResponse(
      error.message,
      'USER_UNAVAILABLE',
      403,
    )
  }

  if (
    error instanceof
    CartMergeConflictError
  ) {
    return errorResponse(
      error.message,
      'MERGE_CONFLICT',
      409,
    )
  }

  if (
    error instanceof
    CartProductUnavailableError
  ) {
    return errorResponse(
      error.message,
      'PRODUCT_UNAVAILABLE',
      404,
    )
  }

  if (
    error instanceof
    CartInsufficientStockError
  ) {
    return errorResponse(
      error.message,
      'INSUFFICIENT_STOCK',
      409,
    )
  }

  console.error(
    'Unexpected cart merge API error:',
    error,
  )

  return errorResponse(
    'Erro interno do servidor',
    'INTERNAL_ERROR',
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
        'UNAUTHENTICATED',
        401,
      )
    }

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return errorResponse(
        'JSON inválido',
        'INVALID_JSON',
        400,
      )
    }

    if (!isRecord(body)) {
      return errorResponse(
        'Pedido inválido',
        'INVALID_REQUEST',
        400,
      )
    }

    const mergeKey =
      body.mergeKey

    if (
      typeof mergeKey !== 'string'
    ) {
      return errorResponse(
        'Identificador de merge inválido',
        'INVALID_MERGE_KEY',
        400,
      )
    }

    if (
      !Array.isArray(body.items)
    ) {
      return errorResponse(
        'Pedido inválido',
        'INVALID_REQUEST',
        400,
      )
    }

    const items:
      GuestCartInputItem[] = []

    for (
      const rawItem of body.items
    ) {
      if (!isRecord(rawItem)) {
        return errorResponse(
          'Item inválido',
          'INVALID_ITEM',
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
          'INVALID_PRODUCT',
          400,
        )
      }

      if (
        typeof quantity !==
        'number'
      ) {
        return errorResponse(
          'Quantidade inválida',
          'INVALID_QUANTITY',
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
        mergeKey,
        items,
      )

    return NextResponse.json(
      result,
    )
  } catch (error) {
    return handleMergeError(error)
  }
}
