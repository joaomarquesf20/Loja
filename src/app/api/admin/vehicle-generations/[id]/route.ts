import {
  ConflictError,
  NotFoundError,
  ValidationError,
  deleteVehicleGeneration,
  getVehicleGenerationById,
  updateVehicleGeneration,
} from '@/server/vehicle-generations'
import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

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

  if (error instanceof AdminForbiddenError) {
    return Response.json(
      { error: 'Sem autorização' },
      { status: 403 },
    )
  }

  if (error instanceof ValidationError) {
    return Response.json(
      { error: 'Dados inválidos' },
      { status: 400 },
    )
  }

  if (error instanceof NotFoundError) {
    return Response.json(
      { error: error.message },
      { status: 404 },
    )
  }

  if (error instanceof ConflictError) {
    return Response.json(
      { error: error.message },
      { status: 409 },
    )
  }

  console.error(
    'Unexpected vehicle-generations API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params
    const vehicleGeneration =
      await getVehicleGenerationById(id)

    return Response.json(vehicleGeneration, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return Response.json(
        { error: 'Dados inválidos' },
        { status: 400 },
      )
    }

    const vehicleGeneration =
      await updateVehicleGeneration(id, body)

    return Response.json(vehicleGeneration, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params
    const vehicleGeneration =
      await deleteVehicleGeneration(id)

    return Response.json(vehicleGeneration, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}