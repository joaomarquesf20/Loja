import { NextResponse } from 'next/server'

import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
} from '@/server/order-lifecycle'
import {
  cancelUserOrderAndRestoreStock,
} from '@/server/order-cancellation'
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

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const userId =
      await requireActiveUserId()

    const { id } =
      await context.params

    const order =
      await cancelUserOrderAndRestoreStock(
        id,
        userId,
      )

    return NextResponse.json({
      order,
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
      OrderLifecycleValidationError
    ) {
      return errorResponse(
        error.message,
        400,
      )
    }

    if (
      error instanceof
      OrderLifecycleNotFoundError
    ) {
      return errorResponse(
        'Encomenda não encontrada',
        404,
      )
    }

    if (
      error instanceof
      OrderLifecycleConflictError
    ) {
      return errorResponse(
        error.message,
        409,
      )
    }

    console.error(
      'Unexpected order cancellation API error:',
      error,
    )

    return errorResponse(
      'Erro interno do servidor',
      500,
    )
  }
}
