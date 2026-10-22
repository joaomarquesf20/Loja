import {
  createHmac,
} from 'node:crypto'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

// Só o serviço de encomendas é substituído (sem base de dados).
// A verificação de assinatura é a implementação real.
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
      recordVerifiedPaymentFailure:
        vi.fn(),
    }
  },
)

import {
  recordVerifiedPayment,
  recordVerifiedPaymentFailure,
} from '@/server/order-lifecycle'
import { POST } from './route'

const mockRecordVerifiedPayment =
  vi.mocked(
    recordVerifiedPayment,
  )

const mockRecordVerifiedPaymentFailure =
  vi.mocked(
    recordVerifiedPaymentFailure,
  )

const secret =
  '0123456789abcdef0123456789abcdef'

// Contrato de assinatura: HMAC-SHA256(secret, `${timestamp}.${corpoBruto}`),
// enviado em x-payment-signature como `sha256=<hex>`.
function sign(
  rawBody: string,
  timestamp: string,
  signingSecret = secret,
) {
  return (
    'sha256=' +
    createHmac(
      'sha256',
      signingSecret,
    )
      .update(timestamp)
      .update('.')
      .update(rawBody)
      .digest('hex')
  )
}

function nowTimestamp(
  offsetSeconds = 0,
) {
  return String(
    Math.floor(
      Date.now() / 1000,
    ) + offsetSeconds,
  )
}

function signedRequest({
  rawBody,
  timestamp = nowTimestamp(),
  signature,
  bodyToSend = rawBody,
}: {
  rawBody: string
  timestamp?: string
  signature?: string
  bodyToSend?: string
}) {
  return new Request(
    'http://localhost/api/payments/webhook',
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/json',
        'x-payment-timestamp':
          timestamp,
        'x-payment-signature':
          signature ??
          sign(
            rawBody,
            timestamp,
          ),
      },
      body: bodyToSend,
    },
  )
}

const paidBody = JSON.stringify({
  type: 'PAYMENT_PAID',
  orderId: 'order-1',
  paymentProvider: 'provider-test',
  paymentReference: 'pay-123',
  amount: '128.50',
  currency: 'EUR',
})

const failedBody = JSON.stringify({
  type: 'PAYMENT_FAILED',
  orderId: 'order-1',
  paymentProvider: 'provider-test',
  paymentReference: 'pay-123',
})

describe(
  'Payment Webhook API (round-trip assinado com verificação real)',
  () => {
    beforeEach(() => {
      vi.stubEnv(
        'PAYMENT_WEBHOOK_SECRET',
        secret,
      )
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test(
      'aceita PAYMENT_PAID assinado corretamente e confirma a encomenda',
      async () => {
        mockRecordVerifiedPayment.mockResolvedValue(
          {
            id: 'order-1',
            paymentStatus: 'PAID',
          } as Awaited<
            ReturnType<
              typeof recordVerifiedPayment
            >
          >,
        )

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
            }),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          received: true,
          orderId: 'order-1',
          paymentStatus: 'PAID',
        })

        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
          paymentProvider: 'provider-test',
          paymentReference: 'pay-123',
          amount: '128.50',
          currency: 'EUR',
        })
      },
    )

    test(
      'aceita PAYMENT_FAILED assinado corretamente e regista a falha',
      async () => {
        mockRecordVerifiedPaymentFailure.mockResolvedValue(
          {
            id: 'order-1',
            paymentStatus: 'FAILED',
          } as Awaited<
            ReturnType<
              typeof recordVerifiedPaymentFailure
            >
          >,
        )

        const response =
          await POST(
            signedRequest({
              rawBody: failedBody,
            }),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mockRecordVerifiedPaymentFailure,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
          paymentProvider: 'provider-test',
          paymentReference: 'pay-123',
        })

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita assinatura inválida (outro segredo) sem tocar na encomenda',
      async () => {
        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
              signature: sign(
                paidBody,
                nowTimestamp(),
                'ffffffffffffffffffffffffffffffff',
              ),
            }),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita timestamp obsoleto (assinado corretamente, fora da janela de 5 minutos)',
      async () => {
        const staleTimestamp =
          nowTimestamp(-10 * 60)

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
              timestamp: staleTimestamp,
            }),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'aceita evento assinado 60 s atrás (dentro da janela de 5 minutos)',
      async () => {
        mockRecordVerifiedPayment.mockResolvedValue(
          {
            id: 'order-1',
            paymentStatus: 'PAID',
          } as Awaited<
            ReturnType<
              typeof recordVerifiedPayment
            >
          >,
        )

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
              timestamp:
                nowTimestamp(-60),
            }),
          )

        expect(
          response.status,
        ).toBe(200)

        await expect(
          response.json(),
        ).resolves.toEqual({
          received: true,
          orderId: 'order-1',
          paymentStatus: 'PAID',
        })

        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'rejeita corpo adulterado após assinatura (valor alterado de 128.50 para 1.00)',
      async () => {
        const tamperedBody =
          paidBody.replace(
            '128.50',
            '1.00',
          )

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
              bodyToSend: tamperedBody,
            }),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      {
        name: 'sem o cabeçalho de assinatura',
        tamper: (
          request: Request,
        ) => {
          request.headers.delete(
            'x-payment-signature',
          )
        },
      },
      {
        name: 'sem o cabeçalho de timestamp',
        tamper: (
          request: Request,
        ) => {
          request.headers.delete(
            'x-payment-timestamp',
          )
        },
      },
      {
        name: 'assinatura sem o prefixo sha256=',
        tamper: (
          request: Request,
        ) => {
          request.headers.set(
            'x-payment-signature',
            sign(
              paidBody,
              nowTimestamp(),
            ).replace(
              'sha256=',
              '',
            ),
          )
        },
      },
      {
        name: 'assinatura com comprimento inválido',
        tamper: (
          request: Request,
        ) => {
          request.headers.set(
            'x-payment-signature',
            `sha256=${'a'.repeat(63)}`,
          )
        },
      },
    ])(
      'rejeita pedido mal autenticado ($name) sem tocar na encomenda',
      async ({ tamper }) => {
        const request =
          signedRequest({
            rawBody: paidBody,
          })

        tamper(request)

        const response =
          await POST(request)

        expect(
          response.status,
        ).toBe(401)

        await expect(
          response.json(),
        ).resolves.toEqual({
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
      'rejeita timestamp demasiado no futuro (assinado corretamente)',
      async () => {
        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
              timestamp:
                nowTimestamp(
                  10 * 60,
                ),
            }),
          )

        expect(
          response.status,
        ).toBe(401)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Webhook não autenticado',
        })

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 400 para JSON inválido assinado corretamente',
      async () => {
        const rawBody =
          '{"type":"PAYMENT_PAID",'

        const response =
          await POST(
            signedRequest({
              rawBody,
            }),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Dados inválidos',
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
      'devolve 400 para tipo de evento não suportado assinado corretamente',
      async () => {
        const rawBody =
          JSON.stringify({
            type: 'PAYMENT_REFUNDED',
            orderId: 'order-1',
            paymentProvider:
              'provider-test',
            paymentReference:
              'pay-123',
          })

        const response =
          await POST(
            signedRequest({
              rawBody,
            }),
          )

        expect(
          response.status,
        ).toBe(400)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Dados inválidos',
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
      'devolve 413 para corpo acima do limite mesmo com assinatura válida',
      async () => {
        const rawBody =
          JSON.stringify({
            type: 'PAYMENT_PAID',
            orderId: 'order-1',
            paymentProvider:
              'provider-test',
            paymentReference:
              'pay-123',
            amount: '128.50',
            currency: 'EUR',
            padding: 'x'.repeat(
              40 * 1024,
            ),
          })

        const response =
          await POST(
            signedRequest({
              rawBody,
            }),
          )

        expect(
          response.status,
        ).toBe(413)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Pedido demasiado grande',
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
      'devolve 500 sem detalhes quando o segredo não está configurado',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => undefined,
          )

        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET',
          '',
        )

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
            }),
          )

        expect(
          response.status,
        ).toBe(500)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Erro interno do servidor',
        })

        expect(
          consoleError,
        ).toHaveBeenCalled()

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()

        consoleError.mockRestore()
      },
    )
  },
)

describe(
  'Payment Webhook API (configuração por ambiente)',
  () => {
    const previousEnvSecret =
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr'

    const paidOrderMock = {
      id: 'order-1',
      paymentStatus: 'PAID',
    } as Awaited<
      ReturnType<
        typeof recordVerifiedPayment
      >
    >

    beforeEach(() => {
      vi.stubEnv(
        'PAYMENT_WEBHOOK_SECRET',
        secret,
      )
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test(
      'aceita entrega assinada com o segredo anterior durante a rotação',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET_PREVIOUS',
          previousEnvSecret,
        )
        mockRecordVerifiedPayment.mockResolvedValue(
          paidOrderMock,
        )

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
              signature:
                sign(
                  paidBody,
                  nowTimestamp(),
                  previousEnvSecret,
                ),
            }),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'aceita timestamp à margem da janela ampliada por ambiente (600 s)',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_MAX_AGE_SECONDS',
          '600',
        )
        mockRecordVerifiedPayment.mockResolvedValue(
          paidOrderMock,
        )

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
              timestamp:
                nowTimestamp(-590),
            }),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mockRecordVerifiedPayment,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'rejeita timestamps fora da janela reduzida por ambiente (120 s)',
      async () => {
        const consoleWarn =
          vi.spyOn(
            console,
            'warn',
          ).mockImplementation(
            () => undefined,
          )

        vi.stubEnv(
          'PAYMENT_WEBHOOK_MAX_AGE_SECONDS',
          '120',
        )

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
              timestamp:
                nowTimestamp(-180),
            }),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()

        expect(
          consoleWarn,
        ).toHaveBeenCalled()

        consoleWarn.mockRestore()
      },
    )

    test(
      'devolve 500 para janela configurada por ambiente inválida',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => undefined,
          )

        vi.stubEnv(
          'PAYMENT_WEBHOOK_MAX_AGE_SECONDS',
          'abc',
        )

        const response =
          await POST(
            signedRequest({
              rawBody: paidBody,
            }),
          )

        expect(
          response.status,
        ).toBe(500)

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Erro interno do servidor',
        })

        expect(
          consoleError,
        ).toHaveBeenCalled()

        expect(
          mockRecordVerifiedPayment,
        ).not.toHaveBeenCalled()

        consoleError.mockRestore()
      },
    )
  },
)
