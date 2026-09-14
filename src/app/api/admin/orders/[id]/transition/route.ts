import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  InvalidJsonBodyError,
  RequestPayloadTooLargeError,
  readJsonBody,
} from '@/server/http-request'
import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  applyAdminOrderAction,
} from '@/server/order-lifecycle'

const ADMIN_ORDER_ACTION_JSON_LIMIT_BYTES =
  8 * 1024

type RouteContext = {
  params: Promise<{
    id: string
  }>
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

function getAction(
  body: unknown,
) {
  if (!isRecord(body)) {
    return undefined
  }

  return body.action
}

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

  if (
    error instanceof
      InvalidJsonBodyError ||
    error instanceof
      OrderLifecycleValidationError
  ) {
    return Response.json(
      {
        error:
          'Dados inválidos',
      },
      { status: 400 },
    )
  }

  if (
    error instanceof
    RequestPayloadTooLargeError
  ) {
    return Response.json(
      {
        error:
          'Pedido demasiado grande',
      },
      { status: 413 },
    )
  }

  if (
    error instanceof
    OrderLifecycleNotFoundError
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      { status: 404 },
    )
  }

  if (
    error instanceof
    OrderLifecycleConflictError
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      { status: 409 },
    )
  }

  console.error(
    'Unexpected admin order transition API error:',
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
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const body =
      await readJsonBody(
        request,
        ADMIN_ORDER_ACTION_JSON_LIMIT_BYTES,
      )

    const { id } =
      await params

    const order =
      await applyAdminOrderAction(
        id,
        getAction(body),
      )

    return Response.json(
      order,
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
