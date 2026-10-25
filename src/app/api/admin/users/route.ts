import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  listAdminUsers,
} from '@/server/admin-users'

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
    'Unexpected admin users API error:',
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

    const users =
      await listAdminUsers()

    return Response.json(
      {
        users,
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
