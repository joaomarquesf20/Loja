import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

// Só a autenticação e a base de dados são substituídas: o serviço de
// iniciação, o classificador de restrições de unicidade e o manipulador da
// rota são as implementações reais.
const mocks = vi.hoisted(() => ({
  requireActiveUserId: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  createEvent: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock(
  '@/server/user-auth',
  () => {
    class UnauthorizedUserError extends Error {}

    return {
      UnauthorizedUserError,
      requireActiveUserId:
        mocks.requireActiveUserId,
    }
  },
)

vi.mock('@/server/db', () => ({
  prisma: {
    order: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
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

function decimal(
  value: string,
) {
  return {
    toString: () => value,
  }
}

function createOrder(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'order-1',
    status: 'PENDING',
    total: decimal('128.50'),
    paymentStatus: 'PENDING',
    paymentMethod: 'CARD',
    installmentCount: null,
    paymentProvider: null,
    paymentReference: null,
    ...overrides,
  }
}

function request() {
  return new Request(
    'http://localhost/api/payments/initiate',
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify({
        orderId: 'order-1',
      }),
    },
  )
}

describe(
  'POST /api/payments/initiate — violações de unicidade reais',
  () => {
    beforeEach(() => {
      vi.resetAllMocks()

      mocks.requireActiveUserId.mockResolvedValue(
        'user-1',
      )
      mocks.findFirst.mockResolvedValue(
        createOrder(),
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
      'inicia o pagamento com a base de dados simulada (controlo)',
      async () => {
        const response = await POST(request())

        expect(response.status).toBe(200)

        const body = await response.json()

        expect(
          body.payment.orderId,
        ).toBe('order-1')
        expect(
          body.payment.paymentProvider,
        ).toBe('PFA_SIMULATED')
        expect(
          body.payment.paymentReference,
        ).toMatch(/^pfa_sim_/)
        expect(
          body.payment.amount,
        ).toBe('128.50')
      },
    )

    test(
      'devolve 409 quando a restrição da referência de pagamento é violada',
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
            'A referência de pagamento já está associada a outra encomenda',
        })

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1)
        expect(
          mocks.transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 409 quando a violação é identificada pelos campos da restrição',
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
            'A referência de pagamento já está associada a outra encomenda',
        })

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1)
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
      'devolve 500 sem detalhes internos quando o erro é $name',
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
          consoleError,
        ).toHaveBeenCalled()
      },
    )

    test(
      'devolve 409 na nova tentativa quando a referência colide',
      async () => {
        mocks.findFirst.mockResolvedValue(
          createOrder({
            paymentStatus: 'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          }),
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
            'A referência de pagamento já está associada a outra encomenda',
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
      },
    )

    test(
      'devolve 500 na nova tentativa quando o erro não é identificável',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(
            () => undefined,
          )

        mocks.findFirst.mockResolvedValue(
          createOrder({
            paymentStatus: 'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          }),
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
          mocks.transaction,
        ).toHaveBeenCalledTimes(1)
        expect(
          consoleError,
        ).toHaveBeenCalled()
      },
    )
  },
)
