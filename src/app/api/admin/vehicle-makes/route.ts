import {
  ConflictError,
  ValidationError,
  createVehicleMake,
  listVehicleMakes,
} from '@/server/vehicle-makes'
import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

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

  if (error instanceof ConflictError) {
    return Response.json(
      { error: error.message },
      { status: 409 },
    )
  }

  console.error(
    'Unexpected vehicle-makes API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET() {
  try {
    await requireAdmin()

    const VehicleMakes = await listVehicleMakes()

    return Response.json(VehicleMakes, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return Response.json(
        { error: 'Dados inválidos' },
        { status: 400 },
      )
    }

    const VehicleMake = await createVehicleMake(body)

    return Response.json(VehicleMake, {
      status: 201,
    })
  } catch (error) {
    return handleError(error)
  }
}