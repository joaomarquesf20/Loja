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
    class PaymentInitiationValidationError extends Error {
      constructor(
        public readonly field: string,
        message: string,
      ) {
        super(message)
      }
    }

    class PaymentInitiationNotFoundError extends Error {
      constructor() {
        super(
          'Encomenda não encontrada',
        )
      }
    }

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

function request(
  body: unknown = {
    orderId: 'order-1',
  },
) {
  return new Request(
    'http://localhost/api/payments/initiate',
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

const payment = {
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
  'Payment Initiation API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRequireActiveUserId.mockResolvedValue(
        'user-1',
      )
    })

    test(
      'inicia pagamento para a encomenda do utilizador autenticado',
      async () => {
        mockInitiateSimulatedPayment.mockResolvedValue(
          payment,
        )

        const response =
          await POST(
            request(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          payment,
        })

        expect(
          mockInitiateSimulatedPayment,
        ).toHaveBeenCalledWith(
          'user-1',
          'order-1',
        )
      },
    )

    test(
      'ignora provider referência e estado enviados pelo browser',
      async () => {
        mockInitiateSimulatedPayment.mockResolvedValue(
          payment,
        )

        const response =
          await POST(
            request({
              orderId:
                'order-1',
              paymentStatus:
                'PAID',
              paymentProvider:
                'ATTACKER',
              paymentReference:
                'attacker-ref',
            }),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mockInitiateSimulatedPayment,
        ).toHaveBeenCalledWith(
          'user-1',
          'order-1',
        )
      },
    )

    test(
      'devolve 401 sem utilizador ativo autenticado',
      async () => {
        mockRequireActiveUserId.mockRejectedValue(
          new UnauthorizedUserError(),
        )

        const response =
          await POST(
            request(),
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
              'http://localhost/api/payments/initiate',
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

        expect(
          response.status,
        ).toBe(400)

        expect(
          mockInitiateSimulatedPayment,
        ).not.toHaveBeenCalled()
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
            new Request(
              'http://localhost/api/payments/initiate',
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

        expect(
          response.status,
        ).toBe(413)

        expect(
          mockInitiateSimulatedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 404 sem revelar encomenda de outro utilizador',
      async () => {
        mockInitiateSimulatedPayment.mockRejectedValue(
          new PaymentInitiationNotFoundError(),
        )

        const response =
          await POST(
            request(),
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
      'devolve 409 quando a encomenda não pode iniciar pagamento',
      async () => {
        mockInitiateSimulatedPayment.mockRejectedValue(
          new PaymentInitiationConflictError(
            'A encomenda já não está pendente de pagamento',
          ),
        )

        const response =
          await POST(
            request(),
          )

        expect(
          response.status,
        ).toBe(409)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'A encomenda já não está pendente de pagamento',
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
          await POST(
            request(),
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
