import { NextResponse } from 'next/server'

import {
  OrderValidationError,
  getUserOrder,
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

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

/**
 * Detalhe de uma encomenda do utilizador autenticado, resolvido pelo
 * número de encomenda (ex.: PFA-ABC123). Serve a página de confirmação
 * do Stripe Checkout, que recebe esse número no retorno de sucesso.
 * Encomendas de outras contas devolvem 404, para não revelarem a sua
 * existência.
 */
export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const userId =
      await requireActiveUserId()

    const { id } =
      await context.params

    const order =
      await getUserOrder(
        userId,
        id,
      )

    if (!order) {
      return errorResponse(
        'Encomenda não encontrada',
        404,
      )
    }

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
      OrderValidationError
    ) {
      return errorResponse(
        error.message,
        400,
      )
    }

    console.error(
      'Unexpected order detail API error:',
      error,
    )

    return errorResponse(
      'Erro interno do servidor',
      500,
    )
  }
}
