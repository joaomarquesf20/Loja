import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

// Só a verificação de assinatura (autenticação do webhook) e a base de dados
// são substituídas: o manipulador da rota, o serviço do ciclo de vida das
// encomendas e o classificador de restrições de unicidade são as
// implementações reais. A verificação de assinatura propriamente dita é
// coberta por route.signed.test.ts.
const mocks = vi.hoisted(() => ({
  verifyPaymentWebhookRequest: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  createEvent: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock(
  '@/server/payment-webhook',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/server/payment-webhook')
      >()

    return {
      ...actual,
      verifyPaymentWebhookRequest:
        mocks.verifyPaymentWebhookRequest,
    }
  },
)

vi.mock('@/server/db', () => ({
  prisma: {
    order: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
    orderEvent: {
      create: mocks.createEvent,
    },
    $transaction: mocks.transaction,
  },
}))

import {
  createUniqueConstraintViolation,
} from '../../../../../test/prisma-error-fixtures'
import {
  createOrderTransactionStub,
} from '../../../../../test/prisma-transaction-mock'
import {
  POST,
} from './route'

const paidEvent = {
  type:
    'PAYMENT_PAID' as const,
  orderId: 'order-1',
  paymentProvider:
    'PFA_SIMULATED',
  paymentReference:
    'pfa_sim_attempt-1',
  amount: '128.50',
  currency: 'EUR',
}

const failedEvent = {
  type:
    'PAYMENT_FAILED' as const,
  orderId: 'order-1',
  paymentProvider:
    'PFA_SIMULATED',
  paymentReference:
    'pfa_sim_attempt-1',
}

function createOrder(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'order-1',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    fulfillmentMethod: 'PICKUP',
    paymentProvider: null,
    paymentReference: null,
    total: '128.50',
    ...overrides,
  }
}

function createInitiatedOrder(
  overrides: Record<string, unknown> = {},
) {
  return createOrder({
    paymentProvider:
      'PFA_SIMULATED',
    paymentReference:
      'pfa_sim_attempt-1',
    ...overrides,
  })
}

function request() {
  return new Request(
    'http://localhost/api/payments/webhook',
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify({
        paymentStatus: 'PAID',
      }),
    },
  )
}

describe(
  'POST /api/payments/webhook — violações de unicidade reais',
  () => {
    beforeEach(() => {
      vi.resetAllMocks()

      mocks.verifyPaymentWebhookRequest.mockResolvedValue(
        paidEvent,
      )
      mocks.findUnique.mockResolvedValue(
        createOrder(),
      )
      mocks.findFirst.mockResolvedValue(
        null,
      )
      mocks.updateMany.mockResolvedValue({
        count: 1,
      })
      mocks.createEvent.mockResolvedValue({
        id: 'event-1',
      })
      mocks.transaction.mockImplementation(
        createOrderTransactionStub({
          updateMany: mocks.updateMany,
          createEvent: mocks.createEvent,
        }),
      )
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test(
      'confirma o pagamento e responde 200 com o serviço real',
      async () => {
        mocks.findUnique
          .mockResolvedValueOnce(
            createOrder(),
          )
          .mockResolvedValueOnce(
            createInitiatedOrder({
              paymentStatus: 'PAID',
            }),
          )

        const response = await POST(request())

        expect(response.status).toBe(200)

        await expect(
          response.json(),
        ).resolves.toEqual({
          received: true,
          orderId: 'order-1',
          paymentStatus: 'PAID',
        })

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.createEvent,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.transaction,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.findUnique,
        ).toHaveBeenCalledTimes(2)
      },
    )

    test(
      'reentrega do mesmo evento pago é idempotente e não escreve',
      async () => {
        mocks.findUnique.mockResolvedValue(
          createInitiatedOrder({
            paymentStatus: 'PAID',
          }),
        )

        const response = await POST(request())

        expect(response.status).toBe(200)

        await expect(
          response.json(),
        ).resolves.toEqual({
          received: true,
          orderId: 'order-1',
          paymentStatus: 'PAID',
        })

        expect(
          mocks.findFirst,
        ).not.toHaveBeenCalled()
        expect(
          mocks.updateMany,
        ).not.toHaveBeenCalled()
        expect(
          mocks.createEvent,
        ).not.toHaveBeenCalled()
        expect(
          mocks.transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'responde 409 quando a restrição da referência de pagamento é violada',
      async () => {
        mocks.updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            index:
              'Order_paymentProvider_paymentReference_key',
          }),
        )

        const response = await POST(request())

        expect(response.status).toBe(409)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'A referência de pagamento já pertence a outra encomenda',
        })

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.transaction,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.createEvent,
        ).not.toHaveBeenCalled()
        expect(
          mocks.findUnique,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'responde 409 quando a violação é identificada pelos campos da restrição',
      async () => {
        mocks.updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            fields: [
              'paymentReference',
              'paymentProvider',
            ],
          }),
        )

        const response = await POST(request())

        expect(response.status).toBe(409)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'A referência de pagamento já pertence a outra encomenda',
        })

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.createEvent,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      {
        name: 'um índice de outra restrição',
        error:
          createUniqueConstraintViolation({
            index: 'Order_orderNumber_key',
          }),
      },
      {
        name: 'metadados ausentes',
        error: {
          code: 'P2002',
        },
      },
      {
        name: 'um erro que não é violação de unicidade',
        error: {
          code: 'P2025',
          meta: {
            modelName: 'Order',
          },
        },
      },
    ])(
      'responde 500 sem detalhes internos quando o erro é $name',
      async ({ error }) => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(
            () => undefined,
          )

        mocks.updateMany.mockRejectedValue(
          error,
        )

        const response = await POST(request())

        expect(response.status).toBe(500)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Erro interno do servidor',
        })

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.createEvent,
        ).not.toHaveBeenCalled()
        expect(
          consoleError,
        ).toHaveBeenCalled()
      },
    )

    test(
      'responde 409 quando a falha colide com a restrição da referência',
      async () => {
        mocks.verifyPaymentWebhookRequest.mockResolvedValue(
          failedEvent,
        )
        mocks.findUnique.mockResolvedValue(
          createInitiatedOrder(),
        )
        mocks.updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            index:
              'Order_paymentProvider_paymentReference_key',
          }),
        )

        const response = await POST(request())

        expect(response.status).toBe(409)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'A referência de pagamento já pertence a outra encomenda',
        })

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.createEvent,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'responde 500 quando a falha tem um erro não identificável',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(
            () => undefined,
          )

        mocks.verifyPaymentWebhookRequest.mockResolvedValue(
          failedEvent,
        )
        mocks.findUnique.mockResolvedValue(
          createInitiatedOrder(),
        )
        mocks.updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            index: 'Order_orderNumber_key',
          }),
        )

        const response = await POST(request())

        expect(response.status).toBe(500)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Erro interno do servidor',
        })

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.createEvent,
        ).not.toHaveBeenCalled()
        expect(
          consoleError,
        ).toHaveBeenCalled()
      },
    )
  },
)
