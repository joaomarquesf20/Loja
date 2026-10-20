import { ZodError } from 'zod'

import {
  AdminProductConflictError,
  AdminProductFieldValidationError,
  AdminProductValidationError,
  createAdminProduct,
  listAdminProducts,
  toFieldValidationError,
} from '@/server/admin-products'
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
    error instanceof AdminProductConflictError
  ) {
    return Response.json(
      { error: error.message },
      { status: 409 },
    )
  }

  console.error(
    'Unexpected admin products workspace API error:',
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
    const products =
      await listAdminProducts()

    return Response.json(products, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body: unknown =
      await request.json()
    const product =
      await createAdminProduct(body)

    return Response.json(product, {
      status: 201,
    })
  } catch (error) {
    return handleError(error)
  }
}
