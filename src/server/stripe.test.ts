import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

// O serviço é testado com clientes injetados; a base de dados nunca é
// tocada diretamente.
vi.mock('./db', () => ({
  prisma: {},
}))

import {
  type StripeCheckoutDbClient,
  type StripeClient,
  STRIPE_PAYMENT_PROVIDER,
  buildStripeCheckoutSessionParams,
  centsToDecimalString,
  createStripeCheckoutSession,
  decimalMoneyToCents,
  initiateStripeCheckoutForOrder,
  loadStripeCheckoutProjection,
  mapConfirmedCheckoutSession,
  resolveStripeSecretKey,
  resolveStripeWebhookSecret,
  verifyStripeWebhookEvent,
  StripeConfigurationError,
  StripeCheckoutConflictError,
  StripeCheckoutOrderNotFoundError,
  StripeSessionRequestError,
  StripeValidationError,
  StripeWebhookAuthenticationError,
} from './stripe'

afterEach(() => {
  vi.unstubAllEnvs()
})

type StripeFakeClientOptions = {
  createResult?: unknown
  createError?: unknown
  constructResult?: unknown
  constructError?: unknown
}

function createStripeFakeClient(
  options: StripeFakeClientOptions = {},
) {
  const sessionsCreate = vi.fn()
  const constructEvent = vi.fn()

  if (
    options.createError
  ) {
    sessionsCreate.mockRejectedValue(
      options.createError,
    )
  } else {
    sessionsCreate.mockResolvedValue(
      options.createResult ?? {
        id: 'cs_test_1',
        url: 'https://stripe.test/pagar',
      },
    )
  }

  if (
    options.constructError
  ) {
    // O constructEvent real é síncrono e lança; a falha tem de ser
    // síncrona também no fake.
    constructEvent.mockImplementation(
      () => {
        throw options.constructError
      },
    )
  } else {
    constructEvent.mockImplementation(
      () => options.constructResult,
    )
  }

  const client: StripeClient = {
    checkout: {
      sessions: {
        create: sessionsCreate as never,
      },
    },
    webhooks: {
      constructEvent:
        constructEvent as never,
    },
  }

  return {
    client,
    sessionsCreate,
    constructEvent,
  }
}

type StripeFakeDbOptions = {
  order: unknown
  updateManyCount?: number
}

function createStripeFakeDb(
  options: StripeFakeDbOptions,
) {
  const findFirst = vi.fn()
  const updateMany = vi.fn()

  findFirst.mockResolvedValue(
    options.order,
  )

  updateMany.mockResolvedValue({
    count: options.updateManyCount ?? 1,
  })

  const client: StripeCheckoutDbClient =
    {
      order: {
        findFirst:
          findFirst as never,
        updateMany:
          updateMany as never,
      },
    }

  return {
    client,
    findFirst,
    updateMany,
  }
}

function createOrderRecord(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    id: 'order-1',
    orderNumber: 'PFA-ABC123',
    userId: 'user-1',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentProvider: null,
    paymentReference: null,
    fulfillmentMethod: 'DELIVERY',
    shippingCost: {
      toString: () => '5.90',
    },
    total: {
      toString: () => '205.90',
    },
    shippingEmail:
      'maria@example.com',
    items: [
      {
        id: 'item-1',
        productNameAtPurchase:
          'Filtro de óleo',
        productSkuAtPurchase:
          'FLT-01',
        priceAtPurchase: {
          toString: () => '100.00',
        },
        quantity: 2,
      },
    ],
    ...overrides,
  }
}

function createCheckoutSessionInput(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    orderId: 'order-1',
    orderNumber: 'PFA-ABC123',
    customerEmail:
      'maria@example.com',
    items: [
      {
        name: 'Filtro de óleo',
        description: 'FLT-01',
        quantity: 2,
        unitAmountCents: 10000,
      },
    ],
    successUrl:
      'http://localhost:3000/checkout/sucesso',
    cancelUrl:
      'http://localhost:3000/checkout',
    ...overrides,
  }
}

describe(
  'constantes do fornecedor',
  () => {
    test(
      'usa o provider Stripe',
      () => {
        expect(
          STRIPE_PAYMENT_PROVIDER,
        ).toBe('STRIPE')
      },
    )
  },
)

describe(
  'resolução de configuração',
  () => {
    test(
      'rejeita chave secreta ausente',
      () => {
        vi.stubEnv(
          'STRIPE_SECRET_KEY',
          '',
        )

        expect(() =>
          resolveStripeSecretKey(),
        ).toThrow(
          StripeConfigurationError,
        )
      },
    )

    test(
      'aceita chave explicitamente fornecida',
      () => {
        expect(
          resolveStripeSecretKey(
            'sk_test_chave',
          ),
        ).toBe('sk_test_chave')
      },
    )

    test(
      'rejeita segredo de webhook ausente',
      () => {
        vi.stubEnv(
          'STRIPE_WEBHOOK_SECRET',
          '',
        )

        expect(() =>
          resolveStripeWebhookSecret(),
        ).toThrow(
          StripeConfigurationError,
        )
      },
    )

    test(
      'aceita segredo de webhook explícito',
      () => {
        expect(
          resolveStripeWebhookSecret(
            'whsec_teste',
          ),
        ).toBe('whsec_teste')
      },
    )
  },
)

describe(
  'conversão de montantes',
  () => {
    test(
      'converte cêntimos em string decimal',
      () => {
        expect(
          centsToDecimalString(
            12990,
          ),
        ).toBe('129.90')
        expect(
          centsToDecimalString(100),
        ).toBe('1.00')
        expect(
          centsToDecimalString(5),
        ).toBe('0.05')
        expect(
          centsToDecimalString(0),
        ).toBe('0.00')
      },
    )

    test(
      'rejeita cêntimos inválidos',
      () => {
        expect(() =>
          centsToDecimalString(-1),
        ).toThrow(
          StripeValidationError,
        )
        expect(() =>
          centsToDecimalString(1.5),
        ).toThrow(
          StripeValidationError,
        )
      },
    )

    test(
      'converte dinheiro decimal em cêntimos',
      () => {
        expect(
          decimalMoneyToCents('129.90'),
        ).toBe(12990)
        expect(
          decimalMoneyToCents('5.9'),
        ).toBe(590)
        expect(
          decimalMoneyToCents('0'),
        ).toBe(0)
      },
    )

    test(
      'rejeita dinheiro decimal inválido',
      () => {
        expect(() =>
          decimalMoneyToCents('abc'),
        ).toThrow(
          StripeValidationError,
        )
        expect(() =>
          decimalMoneyToCents('12.345'),
        ).toThrow(
          StripeValidationError,
        )
      },
    )
  },
)

describe(
  'construção dos parâmetros da sessão',
  () => {
    test(
      'mapeia artigos, metadados e URLs',
      () => {
        const params =
          buildStripeCheckoutSessionParams(
            createCheckoutSessionInput(),
          )

        expect(params.mode).toBe(
          'payment',
        )
        expect(
          params.customer_email,
        ).toBe('maria@example.com')
        expect(
          params.client_reference_id,
        ).toBe('order-1')
        expect(
          params.line_items,
        ).toEqual([
          {
            quantity: 2,
            price_data: {
              currency: 'eur',
              unit_amount: 10000,
              product_data: {
                name: 'Filtro de óleo',
                description:
                  'FLT-01',
              },
            },
          },
        ])
        expect(params.metadata).toEqual(
          {
            orderId: 'order-1',
            orderNumber: 'PFA-ABC123',
            paymentProvider: 'STRIPE',
          },
        )
      },
    )

    test(
      'remove descrições vazias',
      () => {
        const params =
          buildStripeCheckoutSessionParams(
            createCheckoutSessionInput({
              items: [
                {
                  name: 'Óleo',
                  description: '',
                  quantity: 1,
                  unitAmountCents: 100,
                },
              ],
            }),
          )

        expect(
          params.line_items[0]
            .price_data.product_data,
        ).toEqual({ name: 'Óleo' })
      },
    )

    test.each([
      {
        field: 'items',
        overrides: { items: [] },
      },
      {
        field: 'items',
        overrides: {
          items: [
            {
              name: '',
              quantity: 1,
              unitAmountCents: 100,
            },
          ],
        },
      },
      {
        field: 'quantity',
        overrides: {
          items: [
            {
              name: 'Óleo',
              quantity: 0,
              unitAmountCents: 100,
            },
          ],
        },
      },
      {
        field: 'unitAmount',
        overrides: {
          items: [
            {
              name: 'Óleo',
              quantity: 1,
              unitAmountCents: 0,
            },
          ],
        },
      },
      {
        field: 'urls',
        overrides: {
          successUrl: 'ftp://localhost',
        },
      },
      {
        field: 'customerEmail',
        overrides: {
          customerEmail: ' ',
        },
      },
    ])(
      'rejeita entrada inválida do campo $field',
      ({
        field,
        overrides,
      }) => {
        expect(() =>
          buildStripeCheckoutSessionParams(
            createCheckoutSessionInput(
              overrides,
            ),
          ),
        ).toThrow(
          expect.objectContaining({
            name: 'StripeValidationError',
            field,
          }),
        )
      },
    )
  },
)

describe(
  'criação da sessão com cliente injetado',
  () => {
    test(
      'devolve id e url da sessão',
      async () => {
        const {
          client,
          sessionsCreate,
        } =
          createStripeFakeClient({
            createResult: {
              id: 'cs_test_9',
              url: 'https://stripe.test/ok',
            },
          })

        const result =
          await createStripeCheckoutSession(
            createCheckoutSessionInput(),
            client,
          )

        expect(result).toEqual({
          sessionId: 'cs_test_9',
          sessionUrl:
            'https://stripe.test/ok',
        })

        expect(
          sessionsCreate,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'usa cliente por omissão a partir do ambiente',
      async () => {
        vi.stubEnv(
          'STRIPE_SECRET_KEY',
          'sk_test_chave',
        )

        const {
          client,
          sessionsCreate,
        } =
          createStripeFakeClient()

        const result =
          await createStripeCheckoutSession(
            createCheckoutSessionInput(),
            client,
          )

        expect(result.sessionId).toBe(
          'cs_test_1',
        )

        expect(
          sessionsCreate,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'falha sem chave configurada quando não há cliente injetado',
      async () => {
        vi.stubEnv(
          'STRIPE_SECRET_KEY',
          '',
        )

        await expect(
          createStripeCheckoutSession(
            createCheckoutSessionInput(),
          ),
        ).rejects.toThrow(
          StripeConfigurationError,
        )
      },
    )

    test(
      'converte falha do Stripe em erro de domínio',
      async () => {
        const { client } =
          createStripeFakeClient({
            createError: new Error(
              'network down',
            ),
          })

        await expect(
          createStripeCheckoutSession(
            createCheckoutSessionInput(),
            client,
          ),
        ).rejects.toThrow(
          StripeSessionRequestError,
        )
      },
    )

    test(
      'rejeita resposta sem id de sessão',
      async () => {
        const { client } =
          createStripeFakeClient({
            createResult: {
              url: 'https://stripe.test/x',
            },
          })

        await expect(
          createStripeCheckoutSession(
            createCheckoutSessionInput(),
            client,
          ),
        ).rejects.toEqual(
          expect.objectContaining({
            name: 'StripeValidationError',
            field: 'sessionId',
          }),
        )
      },
    )
  },
)

describe(
  'verificação do webhook',
  () => {
    const validEvent = {
      id: 'evt-1',
      type: 'checkout.session.completed',
      data: {
        object: {},
      },
    }

    test(
      'rejeita assinatura ausente',
      async () => {
        const { client } =
          createStripeFakeClient()

        await expect(
          verifyStripeWebhookEvent({
            payload: '{}',
            signature: null,
            secret: 'whsec_x',
            client,
          }),
        ).rejects.toThrow(
          StripeWebhookAuthenticationError,
        )
      },
    )

    test(
      'falha sem segredo configurado',
      async () => {
        vi.stubEnv(
          'STRIPE_WEBHOOK_SECRET',
          '',
        )

        const { client } =
          createStripeFakeClient()

        await expect(
          verifyStripeWebhookEvent({
            payload: '{}',
            signature: 't=1,v1=abc',
            client,
          }),
        ).rejects.toThrow(
          StripeConfigurationError,
        )
      },
    )

    test(
      'usa o segredo resolvido do ambiente',
      async () => {
        vi.stubEnv(
          'STRIPE_WEBHOOK_SECRET',
          'whsec_env',
        )

        const { client, constructEvent } =
          createStripeFakeClient({
            constructResult: validEvent,
          })

        const event =
          await verifyStripeWebhookEvent({
            payload: '{"ok":true}',
            signature: 't=1,v1=abc',
            client,
          })

        expect(
          constructEvent,
        ).toHaveBeenCalledWith(
          '{"ok":true}',
          't=1,v1=abc',
          'whsec_env',
        )

        expect(event.id).toBe('evt-1')
        expect(event.type).toBe(
          'checkout.session.completed',
        )
      },
    )

    test(
      'converte falha de assinatura em erro de autenticação',
      async () => {
        const { client } =
          createStripeFakeClient({
            constructError:
              new Error('bad signature'),
          })

        await expect(
          verifyStripeWebhookEvent({
            payload: '{}',
            signature: 't=1,v1=zzz',
            secret: 'whsec_x',
            client,
          }),
        ).rejects.toThrow(
          StripeWebhookAuthenticationError,
        )
      },
    )

    test(
      'rejeita evento mal formado',
      async () => {
        const { client } =
          createStripeFakeClient({
            constructResult: {
              id: 'evt-1',
              data: {},
            },
          })

        await expect(
          verifyStripeWebhookEvent({
            payload: '{}',
            signature: 't=1,v1=abc',
            secret: 'whsec_x',
            client,
          }),
        ).rejects.toThrow(
          StripeValidationError,
        )
      },
    )
  },
)

describe(
  'mapeamento da sessão confirmada',
  () => {
    test(
      'extrai dados de pagamento',
      () => {
        const confirmed =
          mapConfirmedCheckoutSession({
            id: 'evt-1',
            type: 'checkout.session.completed',
            data: {
              object: {
                id: 'cs_test_1',
                payment_status: 'paid',
                amount_total: 12990,
                currency: 'eur',
                metadata: {
                  orderId: 'order-1',
                },
              },
            },
          })

        expect(
          confirmed,
        ).toEqual({
          sessionId: 'cs_test_1',
          orderId: 'order-1',
          amount: '129.90',
          currency: 'EUR',
        })
      },
    )

    test(
      'ignora sessões sem pagamento confirmado',
      () => {
        const confirmed =
          mapConfirmedCheckoutSession({
            id: 'evt-1',
            type: 'checkout.session.completed',
            data: {
              object: {
                id: 'cs_test_1',
                payment_status: 'unpaid',
                metadata: {
                  orderId: 'order-1',
                },
              },
            },
          })

        expect(confirmed).toBeNull()
      },
    )

    test.each([
      'metadata',
      'amount',
      'currency',
    ])(
      'rejeita campo $field em falta',
      (field) => {
        const object: Record<
          string,
          unknown
        > = {
          id: 'cs_test_1',
          payment_status: 'paid',
          amount_total: 12990,
          currency: 'eur',
          metadata: {
            orderId: 'order-1',
          },
        }

        if (field === 'metadata') {
          delete object.metadata
        }

        if (field === 'amount') {
          delete object.amount_total
        }

        if (field === 'currency') {
          delete object.currency
        }

        expect(() =>
          mapConfirmedCheckoutSession({
            id: 'evt-1',
            type: 'checkout.session.completed',
            data: {
              object,
            },
          }),
        ).toThrow(
          expect.objectContaining({
            name: 'StripeValidationError',
            field,
          }),
        )
      },
    )
  },
)

describe(
  'projeção da encomenda para a sessão',
  () => {
    test(
      'carrega artigos e portes',
      async () => {
        const { client, findFirst } =
          createStripeFakeDb({
            order: createOrderRecord(),
          })

        const projection =
          await loadStripeCheckoutProjection(
            'order-1',
            'user-1',
            client,
          )

        expect(
          findFirst,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            userId: 'user-1',
          },
          select:
            expect.objectContaining(
              {
                id: true,
                orderNumber: true,
              },
            ),
        })

        expect(
          projection.items,
        ).toEqual([
          {
            name: 'Filtro de óleo',
            description: 'FLT-01',
            quantity: 2,
            unitAmountCents: 10000,
          },
          {
            name: 'Portes de envio',
            description: null,
            quantity: 1,
            unitAmountCents: 590,
          },
        ])
      },
    )

    test(
      'levantamento em loja não inclui portes',
      async () => {
        const { client } =
          createStripeFakeDb({
            order: createOrderRecord({
              fulfillmentMethod: 'PICKUP',
              shippingCost: {
                toString: () => '0.00',
              },
              total: {
                toString: () => '200.00',
              },
            }),
          })

        const projection =
          await loadStripeCheckoutProjection(
            'order-1',
            'user-1',
            client,
          )

        expect(
          projection.items,
        ).toHaveLength(1)
      },
    )

    test.each([
      {
        name: 'encomenda inexistente',
        order: null,
        error:
          StripeCheckoutOrderNotFoundError,
      },
      {
        name: 'encomenda cancelada',
        order: createOrderRecord({
          status: 'CANCELLED',
        }),
        error:
          StripeCheckoutConflictError,
      },
      {
        name: 'encomenda já paga',
        order: createOrderRecord({
          paymentStatus: 'PAID',
        }),
        error:
          StripeCheckoutConflictError,
      },
      {
        name: 'pagamento já iniciado',
        order: createOrderRecord({
          paymentProvider: 'PFA_SIMULATED',
          paymentReference: 'pfa_sim_1',
        }),
        error:
          StripeCheckoutConflictError,
      },
      {
        name: 'total desalinhado',
        order: createOrderRecord({
          total: {
            toString: () => '999.99',
          },
        }),
        error:
          StripeCheckoutConflictError,
      },
    ])(
      'rejeita projeção: $name',
      async ({
        order,
        error,
      }) => {
        const { client } =
          createStripeFakeDb({
            order,
          })

        await expect(
          loadStripeCheckoutProjection(
            'order-1',
            'user-1',
            client,
          ),
        ).rejects.toThrow(error)
      },
    )
  },
)

describe(
  'iniciação completa do checkout Stripe',
  () => {
    test(
      'cria sessão e guarda a referência',
      async () => {
        const db = createStripeFakeDb(
          {
            order: createOrderRecord(),
          },
        )
        const stripe =
          createStripeFakeClient()

        const result =
          await initiateStripeCheckoutForOrder(
            'order-1',
            'user-1',
            {
              successUrl:
                'http://localhost:3000/checkout/sucesso',
              cancelUrl:
                'http://localhost:3000/checkout',
            },
            {
              db: db.client,
              stripeClient:
                stripe.client,
            },
          )

        expect(result).toEqual({
          orderId: 'order-1',
          sessionId: 'cs_test_1',
          sessionUrl:
            'https://stripe.test/pagar',
        })

        const created =
          stripe.sessionsCreate.mock
            .calls[0][0]

        expect(
          created.metadata,
        ).toEqual({
          orderId: 'order-1',
          orderNumber: 'PFA-ABC123',
          paymentProvider: 'STRIPE',
        })

        expect(
          created.line_items,
        ).toHaveLength(2)

        expect(
          db.updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            userId: 'user-1',
            status: 'PENDING',
            paymentStatus: 'PENDING',
            paymentProvider: null,
            paymentReference: null,
          },
          data: {
            paymentProvider: 'STRIPE',
            paymentReference:
              'cs_test_1',
          },
        })
      },
    )

    test(
      'rejeita quando a referência não consegue ser guardada',
      async () => {
        const db = createStripeFakeDb(
          {
            order: createOrderRecord(),
            updateManyCount: 0,
          },
        )
        const stripe =
          createStripeFakeClient()

        await expect(
          initiateStripeCheckoutForOrder(
            'order-1',
            'user-1',
            {
              successUrl:
                'http://localhost:3000/checkout/sucesso',
              cancelUrl:
                'http://localhost:3000/checkout',
            },
            {
              db: db.client,
              stripeClient:
                stripe.client,
            },
          ),
        ).rejects.toThrow(
          StripeCheckoutConflictError,
        )
      },
    )

    test(
      'não guarda referência quando o Stripe falha',
      async () => {
        const db = createStripeFakeDb(
          {
            order: createOrderRecord(),
          },
        )
        const stripe =
          createStripeFakeClient({
            createError: new Error(
              'fail',
            ),
          })

        await expect(
          initiateStripeCheckoutForOrder(
            'order-1',
            'user-1',
            {
              successUrl:
                'http://localhost:3000/checkout/sucesso',
              cancelUrl:
                'http://localhost:3000/checkout',
            },
            {
              db: db.client,
              stripeClient:
                stripe.client,
            },
          ),
        ).rejects.toThrow(
          StripeSessionRequestError,
        )

        expect(
          db.updateMany,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
