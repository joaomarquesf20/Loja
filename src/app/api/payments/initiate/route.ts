import {
  InvalidJsonBodyError,
  RequestPayloadTooLargeError,
  readJsonBody,
} from '@/server/http-request'
import {
  PaymentInitiationConflictError,
  PaymentInitiationNotFoundError,
  PaymentInitiationValidationError,
  initiateSimulatedPayment,
} from '@/server/payment-initiation'
import {
  UnauthorizedUserError,
  requireActiveUserId,
} from '@/server/user-auth'

const PAYMENT_INITIATION_JSON_LIMIT_BYTES =
  8 * 1024

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function getOrderId(
  body: unknown,
) {
  if (!isRecord(body)) {
    return undefined
  }

  return body.orderId
}

function handleError(
  error: unknown,
) {
  if (
    error instanceof
    UnauthorizedUserError
  ) {
    return Response.json(
      {
        error:
          'Não autenticado',
      },
      { status: 401 },
    )
  }

  if (
    error instanceof
      InvalidJsonBodyError ||
    error instanceof
      PaymentInitiationValidationError
  ) {
    return Response.json(
      {
        error:
          'Dados inválidos',
      },
      { status: 400 },
    )
  }

  if (
    error instanceof
    RequestPayloadTooLargeError
  ) {
    return Response.json(
      {
        error:
          'Pedido demasiado grande',
      },
      { status: 413 },
    )
  }

  if (
    error instanceof
    PaymentInitiationNotFoundError
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
    PaymentInitiationConflictError
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      { status: 409 },
    )
  }

  console.error(
    'Unexpected payment initiation API error:',
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

export async function POST(
  request: Request,
) {
  try {
    const userId =
      await requireActiveUserId()

    const body =
      await readJsonBody(
        request,
        PAYMENT_INITIATION_JSON_LIMIT_BYTES,
      )

    const payment =
      await initiateSimulatedPayment(
        userId,
        getOrderId(body),
      )

    return Response.json(
      {
        payment,
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
