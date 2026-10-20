import { ZodError } from 'zod'

import {
  AdminProductConflictError,
  AdminProductFieldValidationError,
  AdminProductNotFoundError,
  AdminProductValidationError,
  bulkAdminProductAction,
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
    error instanceof AdminProductNotFoundError ||
    error instanceof AdminProductConflictError
  ) {
    return Response.json(
      { error: error.message },
      { status: error instanceof AdminProductNotFoundError ? 404 : 409 },
    )
  }

  console.error(
    'Unexpected bulk admin products API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new AdminProductValidationError(
        'O corpo da operação em massa tem de ser JSON válido',
      )
    }

    const result =
      await bulkAdminProductAction(body)

    return Response.json(result, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}
