import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  listAdminOrders,
} from '@/server/admin-orders'

function handleError(
  error: unknown,
) {
  if (
    error instanceof
    UnauthorizedError
  ) {
    return Response.json(
      {
        error:
          'Não autenticado',
      },
      { status: 401 },
    )
  }

  if (
    error instanceof
    ForbiddenError
  ) {
    return Response.json(
      {
        error:
          'Sem autorização',
      },
      { status: 403 },
    )
  }

  console.error(
    'Unexpected admin orders API error:',
    error,
  )

  return Response.json(
    {
      error:
        'Erro interno do servidor',
    },
    { status: 500 },
  )
}

export async function GET() {
  try {
    await requireAdmin()

    const orders =
      await listAdminOrders()

    return Response.json(
      {
        orders,
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
