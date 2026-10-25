import {
  RequestPayloadTooLargeError,
} from '@/server/http-request'
import {
  sendOrderConfirmationEmail,
} from '@/server/email'
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

/**
 * Registo de rejeições (L7 do `payment-provider-webhook-requirements.md`):
 * permite detetar padrões anómalos de reentrega (R31) sem expor dados do
 * pedido — as mensagens são estáticas para não fazer eco de conteúdo
 * controlado pelo emissor.
 */
function logRejectedWebhook(
  status: number,
  reason: string,
) {
  console.warn(
    `Webhook de pagamento rejeitado (${status}): ${reason}`,
  )
}

function handleError(
  error: unknown,
) {
  if (
    error instanceof
    PaymentWebhookAuthenticationError
  ) {
    logRejectedWebhook(
      401,
      'Assinatura ausente, malformada, inválida ou timestamp expirado',
    )

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
    logRejectedWebhook(
      400,
      'Evento de pagamento com dados inválidos',
    )

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
    logRejectedWebhook(
      413,
      'Payload acima do limite',
    )

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
    logRejectedWebhook(
      404,
      'Encomenda não encontrada',
    )

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
    logRejectedWebhook(
      409,
      'Conflito de estado da encomenda',
    )

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

    const paymentEventSinceMs =
      Date.now()

    const order =
      event.type ===
      'PAYMENT_FAILED'
        ? await recordVerifiedPaymentFailure(
            paymentInput,
          )
        : await recordVerifiedPayment({
            ...paymentInput,
            amount:
              event.amount,
            currency:
              event.currency,
          })

    if (
      event.type ===
      'PAYMENT_PAID'
    ) {
      // Auxiliar ao fulfillment: o serviço de email nunca lança e a deteção
      // de entregas repetidas impede confirmações em duplicado.
      await sendOrderConfirmationEmail(
        {
          orderId: order.id,
          paymentEventSinceMs,
        },
      )
    }

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
