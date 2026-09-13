import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  markOrderReadyForPickup,
} from '@/server/order-lifecycle'

type RouteContext = {
  params: Promise<{ id: string }>
}

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json(
      { error: 'Não autenticado' },
      { status: 401 },
    )
  }

  if (
    error instanceof
    AdminForbiddenError
  ) {
    return Response.json(
      { error: 'Sem autorização' },
      { status: 403 },
    )
  }

  if (
    error instanceof
    OrderLifecycleValidationError
  ) {
    return Response.json(
      { error: 'Dados inválidos' },
      { status: 400 },
    )
  }

  if (
    error instanceof
    OrderLifecycleNotFoundError
  ) {
    return Response.json(
      { error: error.message },
      { status: 404 },
    )
  }

  if (
    error instanceof
    OrderLifecycleConflictError
  ) {
    return Response.json(
      { error: error.message },
      { status: 409 },
    )
  }

  console.error(
    'Unexpected admin order lifecycle API error:',
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

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params

    const order =
      await markOrderReadyForPickup(
        id,
      )

    return Response.json(
      order,
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
