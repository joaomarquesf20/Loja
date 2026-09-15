import {
  InvalidJsonBodyError,
  RequestPayloadTooLargeError,
  readJsonBody,
} from '@/server/http-request'
import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  recordVerifiedPayment,
} from '@/server/order-lifecycle'
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

const SIMULATED_PAYMENT_JSON_LIMIT_BYTES =
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
      PaymentInitiationValidationError ||
    error instanceof
      OrderLifecycleValidationError
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
      PaymentInitiationNotFoundError ||
    error instanceof
      OrderLifecycleNotFoundError
  ) {
    return Response.json(
      {
        error:
          'Encomenda não encontrada',
      },
      { status: 404 },
    )
  }

  if (
    error instanceof
      PaymentInitiationConflictError ||
    error instanceof
      OrderLifecycleConflictError
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
    'Unexpected simulated payment API error:',
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
        SIMULATED_PAYMENT_JSON_LIMIT_BYTES,
      )

    const initiated =
      await initiateSimulatedPayment(
        userId,
        getOrderId(body),
      )

    const order =
      await recordVerifiedPayment({
        orderId:
          initiated.orderId,
        paymentProvider:
          initiated.paymentProvider,
        paymentReference:
          initiated.paymentReference,
      })

    return Response.json(
      {
        payment: {
          orderId: order.id,
          paymentStatus:
            order.paymentStatus,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
