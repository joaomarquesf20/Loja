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

function getVehicleSpecId(body: unknown) {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('vehicleSpecId' in body)
  ) {
    throw new ValidationError(
      'vehicleSpecId é obrigatório',
    )
  }

  const vehicleSpecId = body.vehicleSpecId

  if (typeof vehicleSpecId !== 'string') {
    throw new ValidationError(
      'vehicleSpecId é obrigatório',
    )
  }

  return vehicleSpecId
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
    const vehicleSpecId =
      getVehicleSpecId(body)
    const notes =
      typeof body === 'object' &&
      body !== null &&
      'notes' in body
        ? (body as { notes: unknown }).notes
        : undefined

    const compatibility =
      await addProductCompatibility({
        productId: id,
        vehicleSpecId,
        notes,
      })

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
    const vehicleSpecId =
      getVehicleSpecId(body)

    const compatibility =
      await removeProductCompatibility(
        id,
        vehicleSpecId,
      )

    return Response.json(
      compatibility,
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}