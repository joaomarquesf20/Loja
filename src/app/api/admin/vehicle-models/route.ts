import { NextRequest } from 'next/server'

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createVehicleModel,
  listVehicleModels,
} from '@/server/vehicle-models'

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
    'Unexpected vehicle-models API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const brandId =
      request.nextUrl.searchParams.get('brandId') ?? ''

    const vehicleModels =
      await listVehicleModels(brandId)

    return Response.json(vehicleModels, {
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

    const vehicleModel =
      await createVehicleModel(body)

    return Response.json(vehicleModel, {
      status: 201,
    })
  } catch (error) {
    return handleError(error)
  }
}