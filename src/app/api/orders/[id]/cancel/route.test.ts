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
            .cancelUserOrderAndRestoreStock,
        ).toHaveBeenCalledWith(
          'order-1',
          'user-1',
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
            .cancelUserOrderAndRestoreStock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 404 para encomenda inexistente ou de outro utilizador',
      async () => {
        mocks
          .cancelUserOrderAndRestoreStock
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
      'devolve 400 para identificador inválido',
      async () => {
        mocks
          .cancelUserOrderAndRestoreStock
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
          .cancelUserOrderAndRestoreStock
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
