import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  recordVerifiedPayment,
} from '@/server/order-lifecycle'
import {
  STRIPE_CHECKOUT_COMPLETED_EVENT,
  STRIPE_PAYMENT_PROVIDER,
  StripeConfigurationError,
  StripeValidationError,
  StripeWebhookAuthenticationError,
  mapConfirmedCheckoutSession,
  verifyStripeWebhookEvent,
} from '@/server/stripe'

export const runtime = 'nodejs'

/**
 * Webhook do Stripe: confirma pagamentos de sessões de Checkout
 * (`checkout.session.completed`). O Stripe assina o corpo cru, por isso
 * o texto é verificado tal como foi recebido — sem qualquer desfazimento
 * de encoding pelo Next/Axios.
 */

const STRIPE_WEBHOOK_MAX_BODY_BYTES =
  64 * 1024

const STRIPE_SIGNATURE_HEADER =
  'stripe-signature'

/**
 * Registo de rejeições (L7): permite detetar padrões anómalos de
 * reentrega sem expor dados do pedido — as mensagens são estáticas para
 * não fazer eco de conteúdo controlado pelo emissor.
 */
function logRejectedWebhook(
  status: number,
  reason: string,
) {
  console.warn(
    `Webhook do Stripe rejeitado (${status}): ${reason}`,
  )
}

function handleError(
  error: unknown,
) {
  if (
    error instanceof
    StripeWebhookAuthenticationError
  ) {
    return Response.json(
      {
        error:
          'Webhook não autenticado',
      },
      { status: 400 },
    )
  }

  if (
    error instanceof
      StripeValidationError ||
    error instanceof
      OrderLifecycleValidationError
  ) {
    return Response.json(
      {
        error:
          'Evento de pagamento inválido',
      },
      { status: 400 },
    )
  }

  if (
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
    OrderLifecycleConflictError
  ) {
    return Response.json(
      {
        error: error.message,
      },
      { status: 409 },
    )
  }

  if (
    error instanceof
    StripeConfigurationError
  ) {
    console.error(
      'Stripe webhook configuration error:',
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
    'Unexpected stripe webhook API error:',
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
    const declaredLength =
      request.headers.get(
        'content-length',
      )

    if (
      declaredLength !== null &&
      Number(declaredLength) >
        STRIPE_WEBHOOK_MAX_BODY_BYTES
    ) {
      logRejectedWebhook(
        413,
        'Corpo demasiado grande',
      )

      return Response.json(
        {
          error:
            'Pedido demasiado grande',
        },
        { status: 413 },
      )
    }

    const payload =
      await request.text()

    const payloadBytes =
      new TextEncoder().encode(
        payload,
      )

    if (
      payloadBytes.byteLength >
      STRIPE_WEBHOOK_MAX_BODY_BYTES
    ) {
      logRejectedWebhook(
        413,
        'Corpo demasiado grande',
      )

      return Response.json(
        {
          error:
            'Pedido demasiado grande',
        },
        { status: 413 },
      )
    }

    const event =
      await verifyStripeWebhookEvent({
        payload,
        signature:
          request.headers.get(
            STRIPE_SIGNATURE_HEADER,
          ),
      })

    if (
      event.type !==
      STRIPE_CHECKOUT_COMPLETED_EVENT
    ) {
      // Eventos não relevantes são confirmados para o Stripe não
      // tentar a reentrega.
      return Response.json(
        {
          received: true,
        },
        { status: 200 },
      )
    }

    const session =
      mapConfirmedCheckoutSession(
        event,
      )

    if (!session) {
      // Sessão concluída sem pagamento confirmado (ex.: métodos
      // assíncronos): nada a registar.
      return Response.json(
        {
          received: true,
        },
        { status: 200 },
      )
    }

    const order =
      await recordVerifiedPayment({
        orderId: session.orderId,
        paymentProvider:
          STRIPE_PAYMENT_PROVIDER,
        paymentReference:
          session.sessionId,
        amount: session.amount,
        currency: session.currency,
      })

    return Response.json(
      {
        received: true,
        orderId: order.id,
        paymentStatus:
          order.paymentStatus,
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
