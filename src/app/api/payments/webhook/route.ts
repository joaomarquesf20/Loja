import {
  RequestPayloadTooLargeError,
} from '@/server/http-request'
import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  recordVerifiedPayment,
  recordVerifiedPaymentFailure,
} from '@/server/order-lifecycle'
import {
  PaymentWebhookAuthenticationError,
  PaymentWebhookConfigurationError,
  PaymentWebhookValidationError,
  verifyPaymentWebhookRequest,
} from '@/server/payment-webhook'

export const runtime = 'nodejs'

function handleError(
  error: unknown,
) {
  if (
    error instanceof
    PaymentWebhookAuthenticationError
  ) {
    return Response.json(
      {
        error:
          'Webhook não autenticado',
      },
      { status: 401 },
    )
  }

  if (
    error instanceof
      PaymentWebhookValidationError ||
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
    OrderLifecycleNotFoundError
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

  if (
    error instanceof
    PaymentWebhookConfigurationError
  ) {
    console.error(
      'Payment webhook configuration error:',
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

  console.error(
    'Unexpected payment webhook API error:',
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
    const event =
      await verifyPaymentWebhookRequest(
        request,
      )

    const paymentInput = {
      orderId:
        event.orderId,
      paymentProvider:
        event.paymentProvider,
      paymentReference:
        event.paymentReference,
    }

    const order =
      event.type ===
      'PAYMENT_FAILED'
        ? await recordVerifiedPaymentFailure(
            paymentInput,
          )
        : await recordVerifiedPayment(
            paymentInput,
          )

    return Response.json(
      {
        received: true,
        orderId:
          order.id,
        paymentStatus:
          order.paymentStatus,
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
