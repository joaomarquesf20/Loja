import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  EmailSendOutcome,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
} from '@/server/email'
import {
  InvalidJsonBodyError,
  RequestPayloadTooLargeError,
  readJsonBody,
} from '@/server/http-request'

const EMAIL_RESEND_JSON_LIMIT_BYTES =
  8 * 1024

type RouteContext = {
  params: Promise<{ id: string }>
}

const skipMessages: Record<
  Extract<
    EmailSendOutcome,
    { status: 'skipped' }
  >['reason'],
  string
> = {
  'invalid-order-id':
    'Identificador de encomenda inválido.',
  'missing-api-key':
    'Serviço de email em modo de simulação: a entrega real exige a chave do Resend configurada.',
  'missing-recipient':
    'A encomenda não tem email de destinatário registado.',
  'already-confirmed':
    'Esta entrega repetida do webhook já suprimiu a confirmação.',
  'order-not-found':
    'Encomenda não encontrada.',
  'order-not-paid':
    'O email de confirmação só existe para encomendas pagas.',
  'invalid-order-data':
    'Dados da encomenda não permitem montar o email.',
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function getBodyType(
  body: unknown,
) {
  if (!isRecord(body)) {
    return undefined
  }

  return body.type
}

function handleError(
  error: unknown,
) {
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
    InvalidJsonBodyError
  ) {
    return Response.json(
      { error: 'Dados inválidos' },
      { status: 400 },
    )
  }

  if (
    error instanceof
    UnauthorizedError
  ) {
    return Response.json(
      { error: 'Não autenticado' },
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

  console.error(
    'Unexpected admin email resend API error:',
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
 * Reenvio manual de emails transacionais (ação administrativa). O corpo é
 * `{ type: "CONFIRMATION" | "STATUS_UPDATE" }`:
 * - CONFIRMATION chama o serviço SEM `paymentEventSinceMs`, desativando a
 *   deteção de entregas repetidas do webhook — a intenção do administrador
 *   é forçar uma nova entrega.
 * - STATUS_UPDATE mostra o estado atual da encomenda.
 *
 * O serviço nunca lança (contrato `EmailSendOutcome`): a resposta HTTP
 * transporta o desfecho sem jamais alterar o estado da encomenda, pelo que
 * chamadas repetidas são seguras (cada chamada é uma tentativa de envio
 * explícita e independente).
 */
export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const body =
      await readJsonBody(
        request,
        EMAIL_RESEND_JSON_LIMIT_BYTES,
      )

    const { id } =
      await params

    const type =
      getBodyType(body)

    let outcome: EmailSendOutcome

    if (type === 'CONFIRMATION') {
      outcome =
        await sendOrderConfirmationEmail(
          { orderId: id },
        )
    } else if (
      type === 'STATUS_UPDATE'
    ) {
      outcome =
        await sendOrderStatusUpdateEmail(
          { orderId: id },
        )
    } else {
      return Response.json(
        {
          error:
            'Dados inválidos',
        },
        { status: 400 },
      )
    }

    if (
      outcome.status === 'sent'
    ) {
      return Response.json(
        { resend: outcome },
        { status: 200 },
      )
    }

    if (
      outcome.status ===
      'skipped'
    ) {
      if (
        outcome.reason ===
        'order-not-found'
      ) {
        return Response.json(
          {
            error:
              'Encomenda não encontrada',
          },
          { status: 404 },
        )
      }

      return Response.json(
        {
          resend: {
            status: 'skipped',
            reason:
              outcome.reason,
            message:
              skipMessages[
                outcome.reason
              ],
          },
        },
        { status: 200 },
      )
    }

    console.error(
      'Admin email resend falhou:',
      outcome.error,
    )

    return Response.json(
      {
        error:
          'Erro interno do servidor',
      },
      { status: 500 },
    )
  } catch (error) {
    return handleError(
      error,
    )
  }
}
