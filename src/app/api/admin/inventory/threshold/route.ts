import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  InventoryNotFoundError,
  updateVariantThreshold,
} from '@/server/inventory'

import { ZodError } from 'zod'

function handleError(
  error: unknown,
) {
  if (
    error instanceof
    UnauthorizedError
  ) {
    return Response.json(
      {
        error: 'Não autenticado',
      },
      { status: 401 },
    )
  }

  if (
    error instanceof
    ForbiddenError
  ) {
    return Response.json(
      { error: 'Sem autorização' },
      { status: 403 },
    )
  }

  if (error instanceof ZodError) {
    const normalized: Record<
      string,
      string[]
    > = {}

    for (const issue of error.issues) {
      const key =
        issue.path.length >
        0
          ? issue.path.join(
              '.',
            )
          : '_form'

      normalized[key] ??=
        []

      normalized[key].push(
        issue.message,
      )
    }

    return Response.json(
      {
        error:
          'Dados inválidos',
        fieldErrors:
          normalized,
      },
      { status: 400 },
    )
  }

  if (
    error instanceof
    InventoryNotFoundError
  ) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: 404,
      },
    )
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      {
        error: 'JSON inválido',
      },
      {
        status: 400,
      },
    )
  }

  console.error(
    'Unexpected admin inventory threshold API error:',
    error,
  )

  return Response.json(
    {
      error:
        'Erro interno do servidor',
    },
    { status: 500 },
  )
}

/**
 * Épico 6 — etapa 3: PATCH `/api/admin/inventory/threshold` define ou
 * remove (null) o limiar de stock baixo próprio de uma variante.
 * Protegido com `requireAdmin()`; a validação (Zod) e a escrita
 * transacional vivem no serviço.
 */
export async function PATCH(
  request: Request,
) {
  try {
    await requireAdmin()

    const body: unknown =
      await request.json()

    const result =
      await updateVariantThreshold(
        body as {
          variantId: unknown
          lowStockThreshold: unknown
        },
      )

    return Response.json(
      result,
      {
        status: 200,
      },
    )
  } catch (error) {
    return handleError(error)
  }
}
