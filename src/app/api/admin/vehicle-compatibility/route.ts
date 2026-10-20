import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  listVehicleCompatibilityTree,
} from '@/server/vehicle-compatibility-tree'

export async function GET() {
  try {
    await requireAdmin()
    const tree =
      await listVehicleCompatibilityTree()

    return Response.json(tree, {
      status: 200,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json(
        { error: 'Não autenticado' },
        { status: 401 },
      )
    }

    if (
      error instanceof AdminForbiddenError
    ) {
      return Response.json(
        { error: 'Sem autorização' },
        { status: 403 },
      )
    }

    console.error(
      'Unexpected vehicle compatibility tree API error:',
      error,
    )

    return Response.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
