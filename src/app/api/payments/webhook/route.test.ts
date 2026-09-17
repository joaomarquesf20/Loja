import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  '@/server/payment-webhook',
  () => {
    class PaymentWebhookAuthenticationError extends Error {}
    class PaymentWebhookValidationError extends Error {}
    class PaymentWebhookConfigurationError extends Error {}

    return {
      PaymentWebhookAuthenticationError,
      PaymentWebhookValidationError,
      PaymentWebhookConfigurationError,
      verifyPaymentWebhookRequest:
        vi.fn(),
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
      recordVerifiedPayment:
        vi.fn(),
      recordVerifiedPaymentFailure:
        vi.fn(),
    }
  },
)

import {
  RequestPayloadTooLargeError,
} from '@/server/http-request'
import {
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  recordVerifiedPayment,
  recordVerifiedPaymentFailure,
} from '@/server/order-lifecycle'
import {
  PaymentWebhookAuthenticationError,
  PaymentWebhookConfigurationError,
  PaymentWebhookValidationError,
  verifyPaymentWebhookRequest,
} from '@/server/payment-webhook'
import { POST } from './route'

const mockVerifyPaymentWebhookRequest =
  vi.mocked(
    verifyPaymentWebhookRequest,
  )

const mockRecordVerifiedPayment =
  vi.mocked(
    recordVerifiedPayment,
  )

const mockRecordVerifiedPaymentFailure =
  vi.mocked(
    recordVerifiedPaymentFailure,
  )

function request() {
  return new Request(
    'http://localhost/api/payments/webhook',
    {
      method: 'POST',
      body: JSON.stringify({
        paymentStatus:
          'PAID',
      }),
      headers: {
        'content-type':
          'application/json',
      },
    },
  )
}

const event = {
  type:
    'PAYMENT_PAID' as const,
  orderId: 'order-1',
  paymentProvider:
    'provider-test',
  paymentReference:
    'pay-123',
}

const paidOrder = {
  id: 'order-1',
  status:
    'PENDING' as const,
  paymentStatus:
    'PAID' as const,
  fulfillmentMethod:
    'PICKUP' as const,
  paymentProvider:
    'provider-test',
  paymentReference:
    'pay-123',
}

const failedEvent = {
  ...event,
  type:
    'PAYMENT_FAILED' as const,
}

const failedOrder = {
  ...paidOrder,
  paymentStatus:
    'FAILED' as const,
}

describe(
  'Payment Webhook API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'confirma pagamento apenas depois de o webhook ser verificado',
      async () => {
        mockVerifyPaymentWebhookRequest.mockResolvedValue(
          event,
        )

        mockRecordVerifiedPayment.mockResolvedValue(
          paidOrder,
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
          received: true,
          orderId:
            'order-1',
          paymentStatus:
            'PAID',
        })

        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledWith({
          orderId:
            'order-1',
          paymentProvider:
            'provider-test',
          paymentReference:
            'pay-123',
        })
      },
    )

    test(
      'regista falha apenas depois de o webhook ser verificado',
      async () => {
        mockVerifyPaymentWebhookRequest.mockResolvedValue(
          failedEvent,
        )

        mockRecordVerifiedPaymentFailure.mockResolvedValue(
          failedOrder,
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
          received: true,
          orderId:
            'order-1',
          paymentStatus:
            'FAILED',
        })

        expect(
          mockRecordVerifiedPaymentFailure,
        ).toHaveBeenCalledWith({
          orderId:
            'order-1',
          paymentProvider:
            'provider-test',
          paymentReference:
            'pay-123',
        })

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'não aceita o browser a declarar pagamento sem assinatura válida',
      async () => {
        mockVerifyPaymentWebhookRequest.mockRejectedValue(
          new PaymentWebhookAuthenticationError(),
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
            'Webhook não autenticado',
        })

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
        expect(
          mockRecordVerifiedPaymentFailure,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 400 para evento assinado mas inválido',
      async () => {
        mockVerifyPaymentWebhookRequest.mockRejectedValue(
          new PaymentWebhookValidationError(),
        )

        const response =
          await POST(
            request(),
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
      'devolve 413 para payload acima do limite',
      async () => {
        mockVerifyPaymentWebhookRequest.mockRejectedValue(
          new RequestPayloadTooLargeError(
            32 * 1024,
          ),
        )

        const response =
          await POST(
            request(),
          )

        expect(
          response.status,
        ).toBe(413)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Pedido demasiado grande',
        })
      },
    )

    test(
      'devolve 404 para encomenda inexistente',
      async () => {
        mockVerifyPaymentWebhookRequest.mockResolvedValue(
          event,
        )

        mockRecordVerifiedPayment.mockRejectedValue(
          new OrderLifecycleNotFoundError(),
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
      'devolve 409 para conflito de pagamento',
      async () => {
        mockVerifyPaymentWebhookRequest.mockResolvedValue(
          event,
        )

        mockRecordVerifiedPayment.mockRejectedValue(
          new OrderLifecycleConflictError(
            'A encomenda já tem outro pagamento confirmado',
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
            'A encomenda já tem outro pagamento confirmado',
        })
      },
    )

    test(
      'não expõe erro de configuração do segredo',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => undefined,
          )

        mockVerifyPaymentWebhookRequest.mockRejectedValue(
          new PaymentWebhookConfigurationError(),
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

        mockVerifyPaymentWebhookRequest.mockRejectedValue(
          new Error(
            'segredo interno',
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
