import { NextResponse } from 'next/server'

import {
  addCartItem,
  CartInsufficientStockError,
  CartItemNotFoundError,
  CartProductUnavailableError,
  CartValidationError,
  listCartItems,
  removeCartItem,
  updateCartItemQuantity,
} from '@/server/cart'
import {
  InvalidJsonBodyError,
  RequestPayloadTooLargeError,
  readJsonBody,
} from '@/server/http-request'
import {
  requireActiveUserId,
  UnauthorizedUserError,
} from '@/server/user-auth'

const CART_BODY_LIMIT_BYTES =
  64 * 1024

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
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function handleCartError(
  error: unknown,
) {
  if (
    error instanceof
    UnauthorizedUserError
  ) {
    return errorResponse(
      'Não autenticado',
      401,
    )
  }

  if (
    error instanceof
    RequestPayloadTooLargeError
  ) {
    return errorResponse(
      'Pedido demasiado grande',
      413,
    )
  }

  if (
    error instanceof
    InvalidJsonBodyError
  ) {
    return errorResponse(
      'JSON inválido',
      400,
    )
  }

  if (
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
    CartItemNotFoundError
  ) {
    return errorResponse(
      error.message,
      404,
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
    'Unexpected cart API error:',
    error,
  )

  return errorResponse(
    'Erro interno do servidor',
    500,
  )
}

export async function GET() {
  try {
    const userId =
      await requireActiveUserId()

    const items =
      await listCartItems(
        userId,
      )

    return NextResponse.json({
      items,
    })
  } catch (error) {
    return handleCartError(error)
  }
}

export async function POST(
  request: Request,
) {
  try {
    const userId =
      await requireActiveUserId()

    const body =
      await readJsonBody(
        request,
        CART_BODY_LIMIT_BYTES,
      )

    if (!isRecord(body)) {
      return errorResponse(
        'Pedido inválido',
        400,
      )
    }

    const productId =
      body.productId

    const productVariantId =
      body.productVariantId

    const quantity =
      body.quantity

    if (
      typeof productId !==
        'string' &&
      typeof productVariantId !==
        'string'
    ) {
      return errorResponse(
        'Produto ou variante inválido',
        400,
      )
    }

    if (
      productVariantId !== undefined &&
      typeof productVariantId !==
        'string'
    ) {
      return errorResponse(
        'Variante inválida',
        400,
      )
    }

    if (
      quantity !== undefined &&
      typeof quantity !==
        'number'
    ) {
      return errorResponse(
        'Quantidade inválida',
        400,
      )
    }

    const item =
      await addCartItem(
        userId,
        typeof productVariantId ===
        'string'
          ? {
              ...(typeof productId ===
              'string'
                ? { productId }
                : {}),
              productVariantId,
            }
          : (productId as string),
        quantity === undefined
          ? 1
          : quantity,
      )

    return NextResponse.json({
      item,
    })
  } catch (error) {
    return handleCartError(error)
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const userId =
      await requireActiveUserId()

    const body =
      await readJsonBody(
        request,
        CART_BODY_LIMIT_BYTES,
      )

    if (!isRecord(body)) {
      return errorResponse(
        'Pedido inválido',
        400,
      )
    }

    const productId =
      body.productId

    const productVariantId =
      body.productVariantId

    const quantity =
      body.quantity

    if (
      typeof productId !==
        'string' &&
      typeof productVariantId !==
        'string'
    ) {
      return errorResponse(
        'Produto ou variante inválido',
        400,
      )
    }

    if (
      productVariantId !== undefined &&
      typeof productVariantId !==
        'string'
    ) {
      return errorResponse(
        'Variante inválida',
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

    const item =
      await updateCartItemQuantity(
        userId,
        typeof productVariantId ===
        'string'
          ? {
              ...(typeof productId ===
              'string'
                ? { productId }
                : {}),
              productVariantId,
            }
          : (productId as string),
        quantity,
      )

    return NextResponse.json({
      item,
    })
  } catch (error) {
    return handleCartError(error)
  }
}

export async function DELETE(
  request: Request,
) {
  try {
    const userId =
      await requireActiveUserId()

    const body =
      await readJsonBody(
        request,
        CART_BODY_LIMIT_BYTES,
      )

    if (!isRecord(body)) {
      return errorResponse(
        'Pedido inválido',
        400,
      )
    }

    const productId =
      body.productId

    const productVariantId =
      body.productVariantId

    if (
      typeof productId !==
        'string' &&
      typeof productVariantId !==
        'string'
    ) {
      return errorResponse(
        'Produto ou variante inválido',
        400,
      )
    }

    if (
      productVariantId !== undefined &&
      typeof productVariantId !==
        'string'
    ) {
      return errorResponse(
        'Variante inválida',
        400,
      )
    }

    await removeCartItem(
      userId,
      productVariantId
        ? {
            ...(typeof productId ===
            'string'
              ? { productId }
              : {}),
            productVariantId,
          }
        : (productId as string),
    )

    return new Response(null, {
      status: 204,
    })
  } catch (error) {
    return handleCartError(error)
  }
}