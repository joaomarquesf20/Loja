import { ZodError } from 'zod'

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  AdminUserNotFoundError,
  AdminUserSelfUpdateError,
  AdminUserValidationError,
  getAdminUserById,
  updateAdminUser,
} from '@/server/admin-users'
import {
  InvalidJsonBodyError,
  RequestPayloadTooLargeError,
  readJsonBody,
} from '@/server/http-request'

const ADMIN_USER_JSON_LIMIT_BYTES =
  8 * 1024

type RouteContext = {
  params: Promise<{
    id: string
  }>
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
    ZodError
  ) {
    const normalized: Record<
      string,
      string[]
    > = {}

    for (const issue of error.issues) {
      const key =
        issue.path.length >
        0
          ? issue.path.join(
              '.',
            )
          : '_form'

      normalized[key] ??=
        []

      normalized[key].push(
        issue.message,
      )
    }

    return Response.json(
      {
        error:
          'Alguns campos precisam de correção antes de guardar.',
        fieldErrors:
          normalized,
      },
      { status: 400 },
    )
  }

  if (
    error instanceof
    AdminUserValidationError
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      { status: 400 },
    )
  }

  if (
    error instanceof
      InvalidJsonBodyError
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
    AdminUserNotFoundError
  ) {
    return Response.json(
      {
        error:
          'Utilizador não encontrado',
      },
      { status: 404 },
    )
  }

  if (
    error instanceof
    AdminUserSelfUpdateError
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
    'Unexpected admin user API error:',
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

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } =
      await params

    const user =
      await getAdminUserById(
        id,
      )

    if (!user) {
      return Response.json(
        {
          error:
            'Utilizador não encontrado',
        },
        { status: 404 },
      )
    }

    return Response.json(
      {
        user,
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const session =
      await requireAdmin()

    const body =
      await readJsonBody(
        request,
        ADMIN_USER_JSON_LIMIT_BYTES,
      )

    const { id } =
      await params

    const user =
      await updateAdminUser(
        id,
        body,
        session.user?.id ??
          null,
      )

    return Response.json(
      {
        user,
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
