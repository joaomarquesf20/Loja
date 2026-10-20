import { ZodError } from 'zod'

import {
  AdminProductConflictError,
  AdminProductFieldValidationError,
  AdminProductNotFoundError,
  AdminProductValidationError,
  deleteAdminProduct,
  getAdminProduct,
  setAdminProductActive,
  toFieldValidationError,
  updateAdminProduct,
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

  if (error instanceof ZodError) {
    const fieldValidation =
      toFieldValidationError(error)

    return Response.json(
      {
        error: fieldValidation.message,
        fieldErrors: fieldValidation.fieldErrors,
      },
      { status: 400 },
    )
  }

  if (
    error instanceof AdminProductValidationError ||
    error instanceof AdminProductFieldValidationError
  ) {
    return Response.json(
      {
        error: error.message,
        ...(error instanceof
        AdminProductFieldValidationError
          ? {
              fieldErrors:
                error.fieldErrors,
            }
          : {}),
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
    'Unexpected admin product workspace API error:',
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
    const product =
      await getAdminProduct(id)

    return Response.json(product, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body: unknown =
      await request.json()
    const product =
      await updateAdminProduct(id, body)

    return Response.json(product, {
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
    const body = (await request.json()) as {
      isActive?: unknown
    }

    if (
      typeof body.isActive !==
      'boolean'
    ) {
      throw new AdminProductValidationError(
        'O estado do produto tem de ser ativo ou inativo',
      )
    }

    const product =
      await setAdminProductActive(
        id,
        body.isActive,
      )

    return Response.json(product, {
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
    const result =
      await deleteAdminProduct(id)

    return Response.json(result, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}
