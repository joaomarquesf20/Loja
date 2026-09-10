import {
  CommercialSettingsValidationError,
  getCommercialSettings,
  updateCheckoutRegionRule,
  updateShippingRule,
  updateStoreSettings,
} from '@/server/commercial-settings'
import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json(
      {
        error: 'Não autenticado',
      },
      {
        status: 401,
      },
    )
  }

  if (error instanceof AdminForbiddenError) {
    return Response.json(
      {
        error: 'Sem autorização',
      },
      {
        status: 403,
      },
    )
  }

  if (
    error instanceof
    CommercialSettingsValidationError
  ) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: 400,
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
    'Unexpected commercial settings API error:',
    error,
  )

  return Response.json(
    {
      error: 'Erro interno do servidor',
    },
    {
      status: 500,
    },
  )
}

function parseRequestBody(
  value: unknown,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new CommercialSettingsValidationError(
      'Operação de configuração comercial inválida',
    )
  }

  return value as Record<string, unknown>
}

export async function GET() {
  try {
    await requireAdmin()

    const settings =
      await getCommercialSettings()

    return Response.json(
      settings,
      {
        status: 200,
      },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    await requireAdmin()

    const body = parseRequestBody(
      await request.json(),
    )

    switch (body.target) {
      case 'store': {
        const result =
          await updateStoreSettings(
            body.data,
          )

        return Response.json(
          result,
          {
            status: 200,
          },
        )
      }

      case 'region': {
        const result =
          await updateCheckoutRegionRule(
            body.region,
            body.data,
          )

        return Response.json(
          result,
          {
            status: 200,
          },
        )
      }

      case 'shipping-rule': {
        const result =
          await updateShippingRule(
            body.region,
            body.shippingClass,
            body.data,
          )

        return Response.json(
          result,
          {
            status: 200,
          },
        )
      }

      default:
        throw new CommercialSettingsValidationError(
          'Operação de configuração comercial inválida',
        )
    }
  } catch (error) {
    return handleError(error)
  }
}
