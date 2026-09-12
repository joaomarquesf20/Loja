import { NextResponse } from 'next/server'

import {
  OrderValidationError,
  listUserOrders,
} from '@/server/orders'
import {
  requireActiveUserId,
  UnauthorizedUserError,
} from '@/server/user-auth'

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

export async function GET() {
  try {
    const userId =
      await requireActiveUserId()

    const orders =
      await listUserOrders(
        userId,
      )

    return NextResponse.json({
      orders,
    })
  } catch (error) {
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
      OrderValidationError
    ) {
      return errorResponse(
        error.message,
        400,
      )
    }

    console.error(
      'Unexpected orders API error:',
      error,
    )

    return errorResponse(
      'Erro interno do servidor',
      500,
    )
  }
}