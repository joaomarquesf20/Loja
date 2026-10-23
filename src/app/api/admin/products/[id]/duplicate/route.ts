import { ZodError } from 'zod'

import {
  AdminProductConflictError,
  AdminProductNotFoundError,
  AdminProductValidationError,
  duplicateAdminProduct,
} from '@/server/admin-products'
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
    error instanceof AdminProductValidationError
  ) {
    return Response.json(
      {
        error:
          error instanceof ZodError
            ? 'Dados inválidos'
            : error.message,
      },
      { status: 400 },
    )
  }

  if (
    error instanceof AdminProductNotFoundError
  ) {
    return Response.json(
      { error: error.message },
      { status: 404 },
    )
  }

  if (
    error instanceof AdminProductConflictError
  ) {
    return Response.json(
      { error: error.message },
      { status: 409 },
    )
  }

  console.error(
    'Unexpected duplicate product API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()
    const { id } = await params
    const product =
      await duplicateAdminProduct(id)

    return Response.json(product, {
      status: 201,
    })
  } catch (error) {
    return handleError(error)
  }
}
