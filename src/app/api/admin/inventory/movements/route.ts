import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  listStockMovements,
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

  console.error(
    'Unexpected admin inventory movements API error:',
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
 * Épico 6 (etapa 2) — histórico de movimentos de stock para a
 * administração (`GET /api/admin/inventory/movements`): filtros
 * `type`, `sku`, `from`, `to` e paginação `page`/`pageSize`, validados
 * com Zod no serviço. Movimentos são registados atomicamente em todas
 * as escritas de stock (checkout/cancelamento/correção rápida/ficha de
 * produto).
 */
export async function GET(
  request: Request,
) {
  try {
    await requireAdmin()

    const url =
      new URL(request.url)

    const searchParams =
      url.searchParams

    const page =
      await listStockMovements({
        type:
          searchParams.get(
            'type',
          ) ?? undefined,
        sku:
          searchParams.get(
            'sku',
          ) ?? undefined,
        from:
          searchParams.get(
            'from',
          ) ?? undefined,
        to:
          searchParams.get(
            'to',
          ) ?? undefined,
        page:
          searchParams.get(
            'page',
          ) ?? undefined,
        pageSize:
          searchParams.get(
            'pageSize',
          ) ?? undefined,
      })

    return Response.json(
      page,
      { status: 200 },
    )
  } catch (error) {
    return handleError(
      error,
    )
  }
}
