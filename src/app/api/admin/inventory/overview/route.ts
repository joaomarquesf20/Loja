import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  getInventoryOverview,
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

  if (
    error instanceof
    ZodError
  ) {
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
    'Unexpected admin inventory overview API error:',
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
 * Vista completa do inventário (backoffice): KPIs de topo + listagem das
 * variantes ativas com o estado derivado do limiar
 * (`?threshold=1..99`, padrão 5, validado com Zod no serviço). A correção
 * rápida de stock continua no `PATCH /api/admin/inventory`.
 */
export async function GET(
  request: Request,
) {
  try {
    await requireAdmin()

    const url =
      new URL(request.url)

    const overview =
      await getInventoryOverview(
        {
          threshold:
            url.searchParams.get(
              'threshold',
            ) ??
            undefined,
        },
      )

    return Response.json(
      overview,
      { status: 200 },
    )
  } catch (error) {
    return handleError(
      error,
    )
  }
}
