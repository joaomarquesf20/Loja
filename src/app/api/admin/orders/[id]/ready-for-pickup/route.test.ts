import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  '@/server/admin-auth',
  () => {
    class UnauthorizedError extends Error {}
    class ForbiddenError extends Error {}

    return {
      UnauthorizedError,
      ForbiddenError,
      requireAdmin: vi.fn(),
    }
  },
)

vi.mock(
  '@/server/order-lifecycle',
  () => {
    class OrderLifecycleValidationError extends Error {
      constructor(
        public readonly field: string,
        message: string,
      ) {
        super(message)
      }
    }

    class OrderLifecycleNotFoundError extends Error {
      constructor() {
        super('Encomenda não encontrada')
      }
    }

    class OrderLifecycleConflictError extends Error {}

    return {
      OrderLifecycleValidationError,
      OrderLifecycleNotFoundError,
      OrderLifecycleConflictError,
      markOrderReadyForPickup:
        vi.fn(),
    }
  },
)

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  markOrderReadyForPickup,
} from '@/server/order-lifecycle'
import { POST } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockMarkOrderReadyForPickup =
  vi.mocked(
    markOrderReadyForPickup,
  )

function context(
  id = 'order-1',
) {
  return {
    params: Promise.resolve({
      id,
    }),
  }
}

function postRequest(
  body?: unknown,
) {
  return new Request(
    'http://localhost/api/admin/orders/order-1/ready-for-pickup',
    {
      method: 'POST',
      ...(body === undefined
        ? {}
        : {
            body:
              JSON.stringify(body),
            headers: {
              'Content-Type':
                'application/json',
            },
          }),
    },
  )
}

const readyOrder = {
  id: 'order-1',
  status:
    'READY_FOR_PICKUP' as const,
  paymentStatus:
    'PAID' as const,
  fulfillmentMethod:
    'PICKUP' as const,
  paymentProvider:
    'test-provider',
  paymentReference:
    'pay-123',
}

describe(
  'Admin Order Ready For Pickup API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRequireAdmin.mockResolvedValue({
        user: {
          id: 'admin-test',
          role: 'ADMIN',
        },
      } as Awaited<
        ReturnType<
          typeof requireAdmin
        >
      >)
    })

    test(
      'marca uma encomenda paga de levantamento como pronta',
      async () => {
        mockMarkOrderReadyForPickup.mockResolvedValue(
          readyOrder,
        )

        const response =
          await POST(
            postRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual(
          readyOrder,
        )

        expect(
          mockMarkOrderReadyForPickup,
        ).toHaveBeenCalledWith(
          'order-1',
        )
      },
    )

    test(
      'ignora paymentStatus enviado pelo browser e delega a regra ao serviço',
      async () => {
        mockMarkOrderReadyForPickup.mockRejectedValue(
          new OrderLifecycleConflictError(
            'O pagamento tem de estar confirmado antes do levantamento',
          ),
        )

        const response =
          await POST(
            postRequest({
              paymentStatus:
                'PAID',
              status:
                'READY_FOR_PICKUP',
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(409)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'O pagamento tem de estar confirmado antes do levantamento',
        })

        expect(
          mockMarkOrderReadyForPickup,
        ).toHaveBeenCalledWith(
          'order-1',
        )
      },
    )

    test(
      'devolve 401 sem autenticação',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const response =
          await POST(
            postRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Não autenticado',
        })

        expect(
          mockMarkOrderReadyForPickup,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 403 sem autorização ADMIN',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new AdminForbiddenError(),
        )

        const response =
          await POST(
            postRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(403)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Sem autorização',
        })

        expect(
          mockMarkOrderReadyForPickup,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 400 para identificador inválido',
      async () => {
        mockMarkOrderReadyForPickup.mockRejectedValue(
          new OrderLifecycleValidationError(
            'orderId',
            'Encomenda inválida',
          ),
        )

        const response =
          await POST(
            postRequest(),
            context('   '),
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Dados inválidos',
        })
      },
    )

    test(
      'devolve 404 quando a encomenda não existe',
      async () => {
        mockMarkOrderReadyForPickup.mockRejectedValue(
          new OrderLifecycleNotFoundError(),
        )

        const response =
          await POST(
            postRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(404)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Encomenda não encontrada',
        })
      },
    )

    test(
      'devolve 409 quando o estado não permite levantamento pronto',
      async () => {
        mockMarkOrderReadyForPickup.mockRejectedValue(
          new OrderLifecycleConflictError(
            'O estado atual da encomenda não permite marcar o levantamento como pronto',
          ),
        )

        const response =
          await POST(
            postRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(409)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'O estado atual da encomenda não permite marcar o levantamento como pronto',
        })
      },
    )

    test(
      'devolve 500 seguro para erro inesperado',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => undefined,
          )

        mockMarkOrderReadyForPickup.mockRejectedValue(
          new Error(
            'erro interno sensível',
          ),
        )

        const response =
          await POST(
            postRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(500)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Erro interno do servidor',
        })

        expect(
          consoleError,
        ).toHaveBeenCalled()

        consoleError.mockRestore()
      },
    )
  },
)
