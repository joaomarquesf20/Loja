import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  buildOrderEmailPreview,
} from '@/server/email'

type RouteContext = {
  params: Promise<{ id: string }>
}

function handleError(
  error: unknown,
) {
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
    'Unexpected admin email preview API error:',
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
 * Pré-visualização dos emails transacionais da encomenda (backoffice):
 * devolve o HTML renderizado do template com os dados guardados, sem
 * contactar o fornecedor de envio. O tipo chega por query string
 * (`?type=CONFIRMATION|STATUS_UPDATE`); os guardas de negócio são
 * aplicados pelo serviço de email (ex.: confirmação só para encomendas
 * pagas), através do mesmo desfecho sem exceções.
 */
export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } =
      await params

    const url =
      new URL(request.url)

    const outcome =
      await buildOrderEmailPreview(
        {
          orderId: id,
          type: url.searchParams.get(
            'type',
          ),
        },
      )

    if (
      outcome.status ===
      'ready'
    ) {
      return Response.json(
        {
          preview: {
            status: 'ready',
            type: outcome.type,
            subject:
              outcome.subject,
            recipient:
              outcome.recipient,
            html: outcome.html,
          },
        },
        { status: 200 },
      )
    }

    if (
      outcome.status ===
      'skipped'
    ) {
      switch (
        outcome.reason
      ) {
        case 'order-not-found':
          return Response.json(
            {
              error:
                'Encomenda não encontrada',
            },
            { status: 404 },
          )

        case 'invalid-order-id':
        case 'unsupported-type':
          return Response.json(
            {
              error:
                'Dados inválidos',
            },
            { status: 400 },
          )

        case 'order-not-paid':
          return Response.json(
            {
              preview: {
                status:
                  'skipped',
                reason:
                  'order-not-paid',
                message:
                  'O email de confirmação só existe para encomendas pagas.',
              },
            },
            { status: 200 },
          )
      }
    }

    console.error(
      'Admin email preview falhou ao preparar o email:',
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
