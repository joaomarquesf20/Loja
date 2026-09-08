import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/server/auth'
import {
  addCartItem,
  CartInsufficientStockError,
  CartProductUnavailableError,
  CartValidationError,
  listCartItems,
} from '@/server/cart'

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

export async function GET() {
  try {
    const userId =
      await getAuthenticatedUserId()

    if (!userId) {
      return errorResponse(
        'Não autenticado',
        401,
      )
    }

    const items =
      await listCartItems(userId)

    return NextResponse.json({
      items,
    })
  } catch (error) {
    console.error(
      'Unexpected cart API error:',
      error,
    )

    return errorResponse(
      'Erro interno do servidor',
      500,
    )
  }
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

    const productId = body.productId
    const quantity = body.quantity

    if (typeof productId !== 'string') {
      return errorResponse(
        'Produto inválido',
        400,
      )
    }

    if (
      quantity !== undefined &&
      typeof quantity !== 'number'
    ) {
      return errorResponse(
        'Quantidade inválida',
        400,
      )
    }

    const item = await addCartItem(
      userId,
      productId,
      quantity === undefined
        ? 1
        : quantity,
    )

    return NextResponse.json({
      item,
    })
  } catch (error) {
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
}