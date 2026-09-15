import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => {
    class OrderLifecycleConflictError
      extends Error {
      constructor(
        message: string,
      ) {
        super(message)
        this.name =
          'OrderLifecycleConflictError'
      }
    }

    class OrderLifecycleNotFoundError
      extends Error {
      constructor() {
        super(
          'Encomenda não encontrada',
        )
        this.name =
          'OrderLifecycleNotFoundError'
      }
    }

    class OrderLifecycleValidationError
      extends Error {
      constructor(
        message: string,
      ) {
        super(message)
        this.name =
          'OrderLifecycleValidationError'
      }
    }

    class UnauthorizedUserError
      extends Error {
      constructor() {
        super('Não autenticado')
        this.name =
          'UnauthorizedUserError'
      }
    }

    return {
      cancelUserOrderAndRestoreStock:
        vi.fn(),
      refundUserSimulatedPaymentForCancellation:
        vi.fn(),
      requireActiveUserId:
        vi.fn(),
      OrderLifecycleConflictError,
      OrderLifecycleNotFoundError,
      OrderLifecycleValidationError,
      UnauthorizedUserError,
    }
  },
)

vi.mock(
  '@/server/order-cancellation',
  () => ({
    cancelUserOrderAndRestoreStock:
      mocks
        .cancelUserOrderAndRestoreStock,
  }),
)


vi.mock(
  '@/server/payment-refund',
  () => ({
    refundUserSimulatedPaymentForCancellation:
      mocks
        .refundUserSimulatedPaymentForCancellation,
  }),
)

vi.mock(
  '@/server/order-lifecycle',
  () => ({
    OrderLifecycleConflictError:
      mocks.OrderLifecycleConflictError,
    OrderLifecycleNotFoundError:
      mocks.OrderLifecycleNotFoundError,
    OrderLifecycleValidationError:
      mocks.OrderLifecycleValidationError,
  }),
)

vi.mock(
  '@/server/user-auth',
  () => ({
    requireActiveUserId:
      mocks.requireActiveUserId,
    UnauthorizedUserError:
      mocks.UnauthorizedUserError,
  }),
)

import { POST } from './route'

function request() {
  return new Request(
    'http://localhost/api/orders/order-1/cancel',
    {
      method: 'POST',
    },
  )
}

function context(
  id = 'order-1',
) {
  return {
    params: Promise.resolve({
      id,
    }),
  }
}

describe(
  'POST /api/orders/[id]/cancel',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.requireActiveUserId
        .mockResolvedValue(
          'user-1',
        )

      mocks
        .refundUserSimulatedPaymentForCancellation
        .mockResolvedValue({
          id: 'order-1',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          fulfillmentMethod:
            'DELIVERY',
          paymentProvider: null,
          paymentReference: null,
        })

      mocks
        .cancelUserOrderAndRestoreStock
        .mockResolvedValue({
          id: 'order-1',
          status: 'CANCELLED',
          paymentStatus: 'PENDING',
          fulfillmentMethod:
            'DELIVERY',
          paymentProvider: null,
          paymentReference: null,
        })
    })

    test(
      'cancela apenas no contexto do utilizador autenticado',
      async () => {
        const response =
          await POST(
            request(),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mocks
            .refundUserSimulatedPaymentForCancellation,
        ).toHaveBeenCalledWith(
          'order-1',
          'user-1',
        )

        expect(
          mocks
            .cancelUserOrderAndRestoreStock,
        ).toHaveBeenCalledWith(
          'order-1',
          'user-1',
        )

        expect(
          mocks
            .refundUserSimulatedPaymentForCancellation
            .mock.invocationCallOrder[0],
        ).toBeLessThan(
          mocks
            .cancelUserOrderAndRestoreStock
            .mock.invocationCallOrder[0],
        )

        await expect(
          response.json(),
        ).resolves.toMatchObject({
          order: {
            id: 'order-1',
            status:
              'CANCELLED',
          },
        })
      },
    )

    test(
      'devolve 401 sem utilizador ativo',
      async () => {
        mocks.requireActiveUserId
          .mockRejectedValue(
            new mocks
              .UnauthorizedUserError(),
          )

        const response =
          await POST(
            request(),
            context(),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mocks
            .refundUserSimulatedPaymentForCancellation,
        ).not.toHaveBeenCalled()

        expect(
          mocks
            .cancelUserOrderAndRestoreStock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 404 para encomenda inexistente ou de outro utilizador',
      async () => {
        mocks
          .refundUserSimulatedPaymentForCancellation
          .mockRejectedValue(
            new mocks
              .OrderLifecycleNotFoundError(),
          )

        const response =
          await POST(
            request(),
            context(),
          )

        expect(
          response.status,
        ).toBe(404)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Encomenda não encontrada',
        })

        expect(
          mocks
            .cancelUserOrderAndRestoreStock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 409 quando o estado atual não permite cancelamento',
      async () => {
        mocks
          .cancelUserOrderAndRestoreStock
          .mockRejectedValue(
            new mocks
              .OrderLifecycleConflictError(
                'O pagamento tem de ser reembolsado antes de cancelar a encomenda',
              ),
          )

        const response =
          await POST(
            request(),
            context(),
          )

        expect(
          response.status,
        ).toBe(409)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'O pagamento tem de ser reembolsado antes de cancelar a encomenda',
        })
      },
    )

    test(
      'não cancela quando o reembolso necessário falha',
      async () => {
        mocks
          .refundUserSimulatedPaymentForCancellation
          .mockRejectedValue(
            new mocks
              .OrderLifecycleConflictError(
                'Este pagamento não pode ser reembolsado',
              ),
          )

        const response =
          await POST(
            request(),
            context(),
          )

        expect(
          response.status,
        ).toBe(409)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Este pagamento não pode ser reembolsado',
        })

        expect(
          mocks
            .cancelUserOrderAndRestoreStock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 400 para identificador inválido',
      async () => {
        mocks
          .refundUserSimulatedPaymentForCancellation
          .mockRejectedValue(
            new mocks
              .OrderLifecycleValidationError(
                'Encomenda inválida',
              ),
          )

        const response =
          await POST(
            request(),
            context('   '),
          )

        expect(
          response.status,
        ).toBe(400)
      },
    )

    test(
      'devolve 500 genérico em erro inesperado',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => {},
          )

        mocks
          .refundUserSimulatedPaymentForCancellation
          .mockRejectedValue(
            new Error('erro'),
          )

        const response =
          await POST(
            request(),
            context(),
          )

        expect(
          response.status,
        ).toBe(500)

        expect(
          consoleError,
        ).toHaveBeenCalledWith(
          'Unexpected order cancellation API error:',
          expect.any(Error),
        )

        consoleError.mockRestore()
      },
    )
  },
)
