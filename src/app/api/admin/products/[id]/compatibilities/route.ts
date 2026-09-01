import { ZodError } from 'zod'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/server/products'
import {
  addProductCompatibility,
  listProductCompatibilities,
  removeProductCompatibility,
} from '@/server/product-compatibilities'
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

  if (
    error instanceof ZodError ||
    error instanceof ValidationError
  ) {
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
    'Unexpected product compatibilities API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

function getVehicleConfigurationId(body: unknown) {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('vehicleConfigurationId' in body)
  ) {
    throw new ValidationError(
      'vehicleConfigurationId é obrigatório',
    )
  }

  const vehicleConfigurationId =
    body.vehicleConfigurationId

  if (typeof vehicleConfigurationId !== 'string') {
    throw new ValidationError(
      'vehicleConfigurationId é obrigatório',
    )
  }

  return vehicleConfigurationId
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params
    const compatibilities =
      await listProductCompatibilities(id)

    return Response.json(
      compatibilities,
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params
    const body: unknown = await request.json()
    const vehicleConfigurationId =
      getVehicleConfigurationId(body)

    const compatibility =
      await addProductCompatibility(
        id,
        vehicleConfigurationId,
      )

    return Response.json(
      compatibility,
      { status: 201 },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params
    const body: unknown = await request.json()
    const vehicleConfigurationId =
      getVehicleConfigurationId(body)

    const compatibility =
      await removeProductCompatibility(
        id,
        vehicleConfigurationId,
      )

    return Response.json(
      compatibility,
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}