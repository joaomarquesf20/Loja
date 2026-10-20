import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  listImportHistory,
} from '@/server/catalog-import-service'

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json(
      { error: 'Não autenticado' },
      { status: 401 },
    )
  }

  if (error instanceof AdminForbiddenError) {
    return Response.json(
      { error: 'Sem autorização' },
      { status: 403 },
    )
  }

  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível obter o histórico de importações.',
    },
    { status: 500 },
  )
}

export async function GET() {
  try {
    await requireAdmin()

    const history = await listImportHistory()

    return Response.json(history)
  } catch (error) {
    return handleError(error)
  }
}
