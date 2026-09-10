import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import {
  OrderValidationError,
  listUserOrders,
} from '@/server/orders'
import { authOptions } from '@/server/auth'

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
