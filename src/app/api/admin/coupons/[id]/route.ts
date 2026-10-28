import { ZodError } from 'zod'

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  CouponAdminNotFoundError,
  CouponAdminValidationError,
  updateAdminCoupon,
} from '@/server/coupons'
import {
  readJsonBody,
  RequestPayloadTooLargeError,
} from '@/server/http-request'

const ADMIN_COUPON_JSON_LIMIT_BYTES =
  8 * 1024

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

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
    CouponAdminValidationError
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      { status: 400 },
    )
  }

  if (
    error instanceof
    CouponAdminNotFoundError
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      { status: 404 },
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
    'Unexpected admin coupon detail API error:',
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
 * Atualização admin de um cupão (Épico 7 — etapa 2): toggle de
 * `isActive` e/ou edição de limites e janela temporal. `code` e
 * `discountType` são imutáveis; cupão inexistente devolve 404.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const body =
      await readJsonBody(
        request,
        ADMIN_COUPON_JSON_LIMIT_BYTES,
      )

    const { id } =
      await params

    const coupon =
      await updateAdminCoupon(
        id,
        body,
      )

    return Response.json(
      coupon,
      { status: 200 },
    )
  } catch (error) {
    return handleError(
      error,
    )
  }
}
