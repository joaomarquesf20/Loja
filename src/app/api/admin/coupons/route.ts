import { ZodError } from 'zod'

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  CouponCodeConflictError,
  createAdminCoupon,
  listAdminCoupons,
} from '@/server/coupons'
import {
  readJsonBody,
  RequestPayloadTooLargeError,
} from '@/server/http-request'

const ADMIN_COUPON_JSON_LIMIT_BYTES =
  8 * 1024

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

  if (
    error instanceof
    CouponCodeConflictError
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      { status: 409 },
    )
  }

  if (
    error instanceof
    RequestPayloadTooLargeError
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      { status: 413 },
    )
  }

  console.error(
    'Unexpected admin coupons API error:',
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
 * Listagem admin de cupões (Épico 7 — etapa 2): KPIs de topo +
 * paginação com pesquisa parcial pelo código (`?search=`) e filtro de
 * estado derivado (`?status=ACTIVE|INACTIVE|EXPIRED|LIMIT_REACHED`).
 */
export async function GET(
  request: Request,
) {
  try {
    await requireAdmin()

    const url =
      new URL(request.url)

    const page =
      await listAdminCoupons({
        search:
          url.searchParams.get(
            'search',
          ) ?? undefined,
        status:
          url.searchParams.get(
            'status',
          ) ?? undefined,
        page:
          url.searchParams.get(
            'page',
          ) ?? undefined,
        pageSize:
          url.searchParams.get(
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

/**
 * Criação admin de cupão: código normalizado em maiúsculas, colisão de
 * código devolve 409 e erros de validação (Zod) devolvem 400 com
 * `fieldErrors` por campo.
 */
export async function POST(
  request: Request,
) {
  try {
    await requireAdmin()

    const body =
      await readJsonBody(
        request,
        ADMIN_COUPON_JSON_LIMIT_BYTES,
      )

    const coupon =
      await createAdminCoupon(
        body,
      )

    return Response.json(
      coupon,
      { status: 201 },
    )
  } catch (error) {
    return handleError(
      error,
    )
  }
}
