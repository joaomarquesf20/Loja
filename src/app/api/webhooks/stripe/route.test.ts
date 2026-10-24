import Stripe from 'stripe'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

// Só o serviço de encomendas é substituído (sem base de dados).
// A verificação de assinatura do Stripe é a implementação real.
vi.mock('@/server/db', () => ({
  prisma: {},
}))

vi.mock(
  '@/server/order-lifecycle',
  () => {
    class OrderLifecycleValidationError extends Error {
    }

    class OrderLifecycleNotFoundError extends Error {
    }

    class OrderLifecycleConflictError extends Error {
    }

    return {
      PAYMENT_CURRENCY: 'EUR',
      OrderLifecycleValidationError,
      OrderLifecycleNotFoundError,
      OrderLifecycleConflictError,
      recordVerifiedPayment:
        vi.fn(),
      recordVerifiedPaymentFailure:
        vi.fn(),
    }
  },
)

import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  recordVerifiedPayment,
} from '@/server/order-lifecycle'
import { POST } from './route'

const mockRecordVerifiedPayment =
  vi.mocked(recordVerifiedPayment)

afterEach(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.clearAllMocks()
  // Chaves de teste: apenas para satisfazer a resolução de
  // configuração; a verificação corre offline (HMAC local).
  vi.stubEnv(
    'STRIPE_SECRET_KEY',
    'sk_test_rota_webhook',
  )
  vi.stubEnv(
    'STRIPE_WEBHOOK_SECRET',
    WEBHOOK_SECRET,
  )
})

const WEBHOOK_SECRET =
  'whsec_test_rota_webhook_0123456789'

const stripe =
  new Stripe('sk_test_rota_webhook')

function createSessionObject(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    payment_status: 'paid',
    amount_total: 20590,
    currency: 'eur',
    client_reference_id: 'order-1',
    metadata: {
      orderId: 'order-1',
      orderNumber: 'PFA-ABC123',
      paymentProvider: 'STRIPE',
    },
    ...overrides,
  }
}

/**
 * Constrói um evento assinado com o segredo de teste, tal como o Stripe
 * faria ao reentregar o webhook.
 */
function createSignedRequest(
  event: Record<string, unknown>,
  options: {
    secret?: string
    tamperPayload?: (payload: string) => string
  } = {},
) {
  const payload = JSON.stringify(event)

  const signature =
    stripe.webhooks.generateTestHeaderString(
      {
        payload,
        secret:
          options.secret ?? WEBHOOK_SECRET,
      },
    )

  return new Request(
    'http://localhost/api/webhooks/stripe',
    {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
      },
      // O corpo enviado pode diferir do assinado, simbolizando
      // alteração durante o trânsito.
      body: options.tamperPayload
        ? options.tamperPayload(payload)
        : payload,
    },
  )
}

function createCompletedEvent(
  sessionOverrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    id: 'evt_test_1',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: createSessionObject(
        sessionOverrides,
      ),
    },
  }
}

describe(
  'POST /api/webhooks/stripe',
  () => {
    test(
      'confirma o pagamento de uma sessão concluída',
      async () => {
        mockRecordVerifiedPayment.mockResolvedValueOnce(
          {
            id: 'order-1',
            status: 'PENDING',
            paymentStatus: 'PAID',
            fulfillmentMethod:
              'DELIVERY',
            paymentProvider: 'STRIPE',
            paymentReference:
              'cs_test_123',
          },
        )

        const response =
          await POST(
            createSignedRequest(
              createCompletedEvent(),
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        await expect(
          response.json(),
        ).resolves.toEqual({
          received: true,
          orderId: 'order-1',
          paymentStatus: 'PAID',
        })

        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
          paymentProvider: 'STRIPE',
          paymentReference:
            'cs_test_123',
          amount: '205.90',
          currency: 'EUR',
        })
      },
    )

    test(
      'confirma eventos repetidos de forma idempotente',
      async () => {
        mockRecordVerifiedPayment.mockResolvedValue(
          {
            id: 'order-1',
            status: 'PENDING',
            paymentStatus: 'PAID',
            fulfillmentMethod:
              'DELIVERY',
            paymentProvider: 'STRIPE',
            paymentReference:
              'cs_test_123',
          },
        )

        await POST(
          createSignedRequest(
            createCompletedEvent(),
          ),
        )

        await expect(
          POST(
            createSignedRequest(
              createCompletedEvent(),
            ),
          ),
        ).resolves.toMatchObject({
          status: 200,
        })

        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledTimes(2)
      },
    )

    test(
      'rejeita assinatura inválida',
      async () => {
        const response =
          await POST(
            createSignedRequest(
              createCompletedEvent(),
              {
                tamperPayload:
                  (payload) =>
                    payload.replace(
                      'cs_test_123',
                      'cs_tampered',
                    ),
              },
            ),
          )

        expect(
          response.status,
        ).toBe(400)
        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita assinatura gerada por outro segredo',
      async () => {
        const response =
          await POST(
            createSignedRequest(
              createCompletedEvent(),
              { secret: 'whsec_falso' },
            ),
          )

        expect(
          response.status,
        ).toBe(400)
      },
    )

    test(
      'rejeita pedido sem cabeçalho de assinatura',
      async () => {
        const response =
          await POST(
            new Request(
              'http://localhost/api/webhooks/stripe',
              {
                method: 'POST',
                body: JSON.stringify(
                  createCompletedEvent(),
                ),
              },
            ),
          )

        expect(
          response.status,
        ).toBe(400)
      },
    )

    test(
      'responde a eventos não tratados sem alterar encomendas',
      async () => {
        const response =
          await POST(
            createSignedRequest({
              id: 'evt_test_2',
              object: 'event',
              type: 'checkout.session.expired',
              data: {
                object:
                  createSessionObject(),
              },
            }),
          )

        expect(
          response.status,
        ).toBe(200)

        await expect(
          response.json(),
        ).resolves.toEqual({
          received: true,
        })

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'não marca pagamento para sessão concluída sem pagamento',
      async () => {
        const response =
          await POST(
            createSignedRequest(
              createCompletedEvent({
                payment_status: 'unpaid',
              }),
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        await expect(
          response.json(),
        ).resolves.toEqual({
          received: true,
        })

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      {
        name: 'session sem metadados de encomenda',
        overrides: {
          metadata: {},
        },
      },
      {
        name: 'session sem valor total',
        overrides: {
          amount_total: undefined,
        },
      },
      {
        name: 'session sem moeda',
        overrides: {
          currency: null,
        },
      },
    ])(
      'rejeita sessão inválida: $name',
      async ({
        overrides,
      }) => {
        const response =
          await POST(
            createSignedRequest(
              createCompletedEvent(
                overrides,
              ),
            ),
          )

        expect(
          response.status,
        ).toBe(400)
        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'mapeia encomenda inexistente',
      async () => {
        mockRecordVerifiedPayment.mockRejectedValueOnce(
          new OrderLifecycleNotFoundError(),
        )

        const response =
          await POST(
            createSignedRequest(
              createCompletedEvent(),
            ),
          )

        expect(
          response.status,
        ).toBe(404)
      },
    )

    test(
      'mapeia conflitos de encomenda',
      async () => {
        mockRecordVerifiedPayment.mockRejectedValueOnce(
          new OrderLifecycleConflictError(
            'O pagamento confirmado não corresponde ao pagamento iniciado para a encomenda',
          ),
        )

        const response =
          await POST(
            createSignedRequest(
              createCompletedEvent(),
            ),
          )

        expect(
          response.status,
        ).toBe(409)
        await expect(
          response.json(),
        ).resolves.toMatchObject({
          error:
            'O pagamento confirmado não corresponde ao pagamento iniciado para a encomenda',
        })
      },
    )

    test(
      'mapeia erro de validação do ciclo de vida',
      async () => {
        mockRecordVerifiedPayment.mockRejectedValueOnce(
          new OrderLifecycleValidationError(
            'amount',
            'Valor de pagamento inválido',
          ),
        )

        const response =
          await POST(
            createSignedRequest(
              createCompletedEvent(),
            ),
          )

        expect(
          response.status,
        ).toBe(400)
      },
    )

    test(
      'corpo demasiado grande é rejeitado',
      async () => {
        const bigSession =
          createSessionObject({
            metadata: {
              orderId: 'order-1',
              orderNumber: 'PFA-ABC123',
              padding: 'x'.repeat(
                70 * 1024,
              ),
            },
          })

        const response =
          await POST(
            createSignedRequest({
              id: 'evt_big',
              object: 'event',
              type: 'checkout.session.completed',
              data: {
                object: bigSession,
              },
            }),
          )

        expect(
          response.status,
        ).toBe(413)
      },
    )
  },
)
