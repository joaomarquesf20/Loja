import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  '@/server/user-auth',
  () => {
    class UnauthorizedUserError extends Error {}

    return {
      UnauthorizedUserError,
      requireActiveUserId:
        vi.fn(),
    }
  },
)

vi.mock(
  '@/server/payment-initiation',
  () => {
    class PaymentInitiationValidationError extends Error {}
    class PaymentInitiationNotFoundError extends Error {}
    class PaymentInitiationConflictError extends Error {}

    return {
      PaymentInitiationValidationError,
      PaymentInitiationNotFoundError,
      PaymentInitiationConflictError,
      initiateSimulatedPayment:
        vi.fn(),
    }
  },
)

vi.mock(
  '@/server/order-lifecycle',
  () => {
    class OrderLifecycleValidationError extends Error {}
    class OrderLifecycleNotFoundError extends Error {}
    class OrderLifecycleConflictError extends Error {}

    return {
      OrderLifecycleValidationError,
      OrderLifecycleNotFoundError,
      OrderLifecycleConflictError,
      recordVerifiedPayment:
        vi.fn(),
    }
  },
)

import {
  OrderLifecycleConflictError,
  recordVerifiedPayment,
} from '@/server/order-lifecycle'
import {
  PaymentInitiationConflictError,
  PaymentInitiationNotFoundError,
  PaymentInitiationValidationError,
  initiateSimulatedPayment,
} from '@/server/payment-initiation'
import {
  UnauthorizedUserError,
  requireActiveUserId,
} from '@/server/user-auth'
import { POST } from './route'

const mockRequireActiveUserId =
  vi.mocked(
    requireActiveUserId,
  )
const mockInitiateSimulatedPayment =
  vi.mocked(
    initiateSimulatedPayment,
  )
const mockRecordVerifiedPayment =
  vi.mocked(
    recordVerifiedPayment,
  )

function request(
  body: unknown = {
    orderId: 'order-1',
  },
) {
  return new Request(
    'http://localhost/api/payments/simulate',
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

const initiatedPayment = {
  orderId: 'order-1',
  paymentStatus:
    'PENDING' as const,
  paymentMethod:
    'CARD' as const,
  installmentCount: null,
  paymentProvider:
    'PFA_SIMULATED' as const,
  paymentReference:
    'pfa_sim_test-123',
  amount: '128.50',
}

describe(
  'Simulated Payment API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRequireActiveUserId.mockResolvedValue(
        'user-1',
      )
      mockInitiateSimulatedPayment.mockResolvedValue(
        initiatedPayment,
      )
      mockRecordVerifiedPayment.mockResolvedValue(
        {
          id: 'order-1',
          status: 'PENDING',
          paymentStatus: 'PAID',
          fulfillmentMethod:
            'DELIVERY',
          paymentProvider:
            'PFA_SIMULATED',
          paymentReference:
            'pfa_sim_test-123',
        },
      )
    })

    test(
      'paga a encomenda do utilizador com dados gerados pelo servidor',
      async () => {
        const response =
          await POST(
            request(),
          )

        expect(response.status).toBe(
          200,
        )
        expect(
          await response.json(),
        ).toEqual({
          payment: {
            orderId: 'order-1',
            paymentStatus: 'PAID',
          },
        })

        expect(
          mockInitiateSimulatedPayment,
        ).toHaveBeenCalledWith(
          'user-1',
          'order-1',
        )
        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
          paymentProvider:
            'PFA_SIMULATED',
          paymentReference:
            'pfa_sim_test-123',
        })
      },
    )

    test(
      'ignora estado provider e referência enviados pelo browser',
      async () => {
        await POST(
          request({
            orderId: 'order-1',
            paymentStatus: 'PAID',
            paymentProvider:
              'ATTACKER',
            paymentReference:
              'attacker-ref',
          }),
        )

        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
          paymentProvider:
            'PFA_SIMULATED',
          paymentReference:
            'pfa_sim_test-123',
        })
      },
    )

    test(
      'devolve 401 sem utilizador ativo autenticado',
      async () => {
        mockRequireActiveUserId.mockRejectedValue(
          new UnauthorizedUserError(),
        )

        const response =
          await POST(request())

        expect(response.status).toBe(
          401,
        )
        expect(
          mockInitiateSimulatedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 400 para JSON inválido',
      async () => {
        const response =
          await POST(
            new Request(
              'http://localhost/api/payments/simulate',
              {
                method: 'POST',
                headers: {
                  'content-type':
                    'application/json',
                },
                body: '{',
              },
            ),
          )

        expect(response.status).toBe(
          400,
        )
      },
    )

    test(
      'devolve 400 para orderId inválido',
      async () => {
        mockInitiateSimulatedPayment.mockRejectedValue(
          new PaymentInitiationValidationError(
            'orderId',
            'Encomenda inválida',
          ),
        )

        const response =
          await POST(
            request({
              orderId: '   ',
            }),
          )

        expect(response.status).toBe(
          400,
        )
      },
    )

    test(
      'devolve 413 quando o body ultrapassa o limite',
      async () => {
        const response =
          await POST(
            new Request(
              'http://localhost/api/payments/simulate',
              {
                method: 'POST',
                headers: {
                  'content-type':
                    'application/json',
                  'content-length':
                    '9000',
                },
                body: '{}',
              },
            ),
          )

        expect(response.status).toBe(
          413,
        )
      },
    )

    test(
      'devolve 404 sem revelar encomenda de outro utilizador',
      async () => {
        mockInitiateSimulatedPayment.mockRejectedValue(
          new PaymentInitiationNotFoundError(),
        )

        const response =
          await POST(request())

        expect(response.status).toBe(
          404,
        )
        expect(
          await response.json(),
        ).toEqual({
          error:
            'Encomenda não encontrada',
        })
        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 409 quando a iniciação é recusada',
      async () => {
        mockInitiateSimulatedPayment.mockRejectedValue(
          new PaymentInitiationConflictError(
            'Pagamento indisponível',
          ),
        )

        const response =
          await POST(request())

        expect(response.status).toBe(
          409,
        )
        expect(
          await response.json(),
        ).toEqual({
          error:
            'Pagamento indisponível',
        })
      },
    )

    test(
      'devolve 409 quando a confirmação é recusada',
      async () => {
        mockRecordVerifiedPayment.mockRejectedValue(
          new OrderLifecycleConflictError(
            'Pagamento alterado',
          ),
        )

        const response =
          await POST(request())

        expect(response.status).toBe(
          409,
        )
        expect(
          await response.json(),
        ).toEqual({
          error:
            'Pagamento alterado',
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

        mockInitiateSimulatedPayment.mockRejectedValue(
          new Error(
            'erro interno sensível',
          ),
        )

        const response =
          await POST(request())

        expect(response.status).toBe(
          500,
        )
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
