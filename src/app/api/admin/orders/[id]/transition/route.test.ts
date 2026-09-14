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
        super(
          'Encomenda não encontrada',
        )
      }
    }

    class OrderLifecycleConflictError extends Error {}

    return {
      OrderLifecycleValidationError,
      OrderLifecycleNotFoundError,
      OrderLifecycleConflictError,
      applyAdminOrderAction:
        vi.fn(),
    }
  },
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  applyAdminOrderAction,
} from '@/server/order-lifecycle'
import { POST } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockApplyAdminOrderAction =
  vi.mocked(
    applyAdminOrderAction,
  )

function context(
  id = 'order-1',
) {
  return {
    params:
      Promise.resolve({
        id,
      }),
  }
}

function postRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/orders/order-1/transition',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body:
        JSON.stringify(body),
    },
  )
}

const confirmedOrder = {
  id: 'order-1',
  status:
    'CONFIRMED' as const,
  paymentStatus:
    'PAID' as const,
  fulfillmentMethod:
    'DELIVERY' as const,
  paymentProvider:
    'PFA_SIMULATED',
  paymentReference:
    'pfa_sim_123',
}

describe(
  'Admin Order Transition API',
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
      'executa apenas a ação administrativa enviada',
      async () => {
        mockApplyAdminOrderAction.mockResolvedValue(
          confirmedOrder,
        )

        const response =
          await POST(
            postRequest({
              action:
                'CONFIRM',
              status:
                'DELIVERED',
              paymentStatus:
                'PAID',
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual(
          confirmedOrder,
        )

        expect(
          mockApplyAdminOrderAction,
        ).toHaveBeenCalledWith(
          'order-1',
          'CONFIRM',
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
            postRequest({
              action:
                'CONFIRM',
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mockApplyAdminOrderAction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 403 sem autorização ADMIN',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new ForbiddenError(),
        )

        const response =
          await POST(
            postRequest({
              action:
                'CONFIRM',
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(403)
      },
    )

    test(
      'devolve 400 para JSON inválido',
      async () => {
        const request =
          new Request(
            'http://localhost/api/admin/orders/order-1/transition',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: '{',
            },
          )

        const response =
          await POST(
            request,
            context(),
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          mockApplyAdminOrderAction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 400 para ação inválida',
      async () => {
        mockApplyAdminOrderAction.mockRejectedValue(
          new OrderLifecycleValidationError(
            'action',
            'Ação inválida',
          ),
        )

        const response =
          await POST(
            postRequest({
              action:
                'DELETE',
            }),
            context(),
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
      'devolve 413 quando o body ultrapassa o limite',
      async () => {
        const response =
          await POST(
            postRequest({
              action:
                'CONFIRM',
              extra:
                'x'.repeat(
                  9 * 1024,
                ),
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(413)

        expect(
          mockApplyAdminOrderAction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 404 para encomenda inexistente',
      async () => {
        mockApplyAdminOrderAction.mockRejectedValue(
          new OrderLifecycleNotFoundError(),
        )

        const response =
          await POST(
            postRequest({
              action:
                'CONFIRM',
            }),
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
      'devolve 409 para transição inválida',
      async () => {
        mockApplyAdminOrderAction.mockRejectedValue(
          new OrderLifecycleConflictError(
            'Transição inválida',
          ),
        )

        const response =
          await POST(
            postRequest({
              action:
                'SHIP',
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
            'Transição inválida',
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

        mockApplyAdminOrderAction.mockRejectedValue(
          new Error(
            'erro interno sensível',
          ),
        )

        const response =
          await POST(
            postRequest({
              action:
                'CONFIRM',
            }),
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
