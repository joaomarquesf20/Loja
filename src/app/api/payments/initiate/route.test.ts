import {
  afterEach,
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

import {
  initiateSimulatedPayment,
} from '@/server/payment-initiation'
import {
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

describe('POST /api/payments/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireActiveUserId.mockResolvedValue(
      'user-1',
    )
    mockInitiateSimulatedPayment.mockResolvedValue(
      {
        orderId: 'order-1',
        paymentStatus: 'PENDING',
        paymentMethod: 'CARD',
        installmentCount: null,
        paymentProvider:
          'PFA_SIMULATED',
        paymentReference:
          'pfa_sim_test-123',
        amount: '128.50',
      } as Awaited<
        ReturnType<
          typeof initiateSimulatedPayment
        >
      >,
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test(
    'devolve 404 em produção sem flag explícita, sem tocar na encomenda',
    async () => {
      vi.stubEnv(
        'NODE_ENV',
        'production',
      )
      vi.stubEnv(
        'PFA_ENABLE_SIMULATED_PAYMENTS',
        '',
      )

      const response =
        await POST(request())

      expect(response.status).toBe(
        404,
      )
      expect(
        mockRequireActiveUserId,
      ).not.toHaveBeenCalled()
      expect(
        mockInitiateSimulatedPayment,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'devolve 404 em produção quando a flag não é exatamente true',
    async () => {
      vi.stubEnv(
        'NODE_ENV',
        'production',
      )
      vi.stubEnv(
        'PFA_ENABLE_SIMULATED_PAYMENTS',
        'TRUE',
      )

      const response =
        await POST(request())

      expect(response.status).toBe(
        404,
      )
      expect(
        mockInitiateSimulatedPayment,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'devolve 404 em produção mesmo com flag explícita',
    async () => {
      vi.stubEnv(
        'NODE_ENV',
        'production',
      )
      vi.stubEnv(
        'PFA_ENABLE_SIMULATED_PAYMENTS',
        'true',
      )

      const response =
        await POST(request())

      expect(response.status).toBe(
        404,
      )
      expect(
        mockRequireActiveUserId,
      ).not.toHaveBeenCalled()
      expect(
        mockInitiateSimulatedPayment,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'permite iniciar pagamento fora de produção',
    async () => {
      vi.stubEnv(
        'NODE_ENV',
        'development',
      )

      const response =
        await POST(request())

      expect(response.status).toBe(
        200,
      )
      expect(
        mockInitiateSimulatedPayment,
      ).toHaveBeenCalledTimes(1)
    },
  )
})
