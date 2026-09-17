import {
  createHmac,
} from 'node:crypto'

import {
  describe,
  expect,
  test,
} from 'vitest'

import {
  RequestPayloadTooLargeError,
} from './http-request'
import {
  PaymentWebhookAuthenticationError,
  PaymentWebhookConfigurationError,
  PaymentWebhookValidationError,
  verifyPaymentWebhookRequest,
} from './payment-webhook'

const secret =
  '0123456789abcdef0123456789abcdef'

const nowMs =
  1_800_000_000_000

const timestamp =
  String(
    Math.floor(
      nowMs / 1000,
    ),
  )

function sign(
  rawBody: string,
  signedTimestamp = timestamp,
) {
  return (
    'sha256=' +
    createHmac(
      'sha256',
      secret,
    )
      .update(signedTimestamp)
      .update('.')
      .update(rawBody)
      .digest('hex')
  )
}

function requestFor(
  rawBody: string,
  options: {
    signedTimestamp?: string
    signature?: string
    contentLength?: string
  } = {},
) {
  const signedTimestamp =
    options.signedTimestamp ??
    timestamp

  const headers =
    new Headers({
      'content-type':
        'application/json',
      'x-payment-timestamp':
        signedTimestamp,
      'x-payment-signature':
        options.signature ??
        sign(
          rawBody,
          signedTimestamp,
        ),
    })

  if (
    options.contentLength !==
    undefined
  ) {
    headers.set(
      'content-length',
      options.contentLength,
    )
  }

  return new Request(
    'http://localhost/api/payments/webhook',
    {
      method: 'POST',
      headers,
      body: rawBody,
    },
  )
}

function validBody() {
  return JSON.stringify({
    type: 'PAYMENT_PAID',
    orderId: ' order-1 ',
    paymentProvider:
      ' provider-test ',
    paymentReference:
      ' pay-123 ',
  })
}

describe(
  'verifyPaymentWebhookRequest',
  () => {
    test(
      'valida assinatura e normaliza evento PAYMENT_PAID',
      async () => {
        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
            ),
            {
              secret,
              nowMs,
            },
          ),
        ).resolves.toEqual({
          type: 'PAYMENT_PAID',
          orderId: 'order-1',
          paymentProvider:
            'provider-test',
          paymentReference:
            'pay-123',
        })
      },
    )

    test(
      'rejeita assinatura inválida',
      async () => {
        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                signature:
                  `sha256=${'0'.repeat(64)}`,
              },
            ),
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookAuthenticationError,
        )
      },
    )

    test(
      'rejeita pedido sem assinatura',
      async () => {
        const request =
          requestFor(
            validBody(),
          )

        request.headers.delete(
          'x-payment-signature',
        )

        await expect(
          verifyPaymentWebhookRequest(
            request,
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookAuthenticationError,
        )
      },
    )

    test(
      'rejeita timestamp expirado',
      async () => {
        const staleTimestamp =
          String(
            Math.floor(
              nowMs / 1000,
            ) - 301,
          )

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                signedTimestamp:
                  staleTimestamp,
              },
            ),
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toMatchObject({
          name:
            'PaymentWebhookAuthenticationError',
          message:
            'Timestamp do webhook inválido ou expirado',
        })
      },
    )

    test(
      'rejeita timestamp demasiado no futuro',
      async () => {
        const futureTimestamp =
          String(
            Math.floor(
              nowMs / 1000,
            ) + 301,
          )

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                signedTimestamp:
                  futureTimestamp,
              },
            ),
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookAuthenticationError,
        )
      },
    )

    test(
      'rejeita JSON inválido mesmo quando a assinatura é válida',
      async () => {
        const rawBody =
          '{"type":'

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(rawBody),
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookValidationError,
        )
      },
    )

    test(
      'valida e normaliza evento PAYMENT_FAILED',
      async () => {
        const rawBody =
          JSON.stringify({
            type:
              'PAYMENT_FAILED',
            orderId:
              ' order-1 ',
            paymentProvider:
              ' provider-test ',
            paymentReference:
              ' pay-123 ',
          })

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(rawBody),
            {
              secret,
              nowMs,
            },
          ),
        ).resolves.toEqual({
          type:
            'PAYMENT_FAILED',
          orderId: 'order-1',
          paymentProvider:
            'provider-test',
          paymentReference:
            'pay-123',
        })
      },
    )

    test(
      'rejeita tipo de evento não suportado',
      async () => {
        const rawBody =
          JSON.stringify({
            type:
              'PAYMENT_REFUNDED',
            orderId:
              'order-1',
            paymentProvider:
              'provider-test',
            paymentReference:
              'pay-123',
          })

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(rawBody),
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toMatchObject({
          name:
            'PaymentWebhookValidationError',
          message:
            'Tipo de evento de pagamento não suportado',
        })
      },
    )

    test.each([
      {
        orderId: '   ',
        paymentProvider:
          'provider-test',
        paymentReference:
          'pay-123',
      },
      {
        orderId: 'order-1',
        paymentProvider: '   ',
        paymentReference:
          'pay-123',
      },
      {
        orderId: 'order-1',
        paymentProvider:
          'provider-test',
        paymentReference: '   ',
      },
    ])(
      'rejeita campos obrigatórios vazios %#',
      async (fields) => {
        const rawBody =
          JSON.stringify({
            type:
              'PAYMENT_PAID',
            ...fields,
          })

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(rawBody),
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookValidationError,
        )
      },
    )

    test(
      'rejeita body acima do limite antes de o processar',
      async () => {
        const rawBody =
          validBody()

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              rawBody,
              {
                contentLength:
                  '40000',
              },
            ),
            {
              secret,
              nowMs,
              maxBodyBytes:
                32 * 1024,
            },
          ),
        ).rejects.toBeInstanceOf(
          RequestPayloadTooLargeError,
        )
      },
    )

    test(
      'rejeita segredo ausente ou demasiado curto',
      async () => {
        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
            ),
            {
              secret: 'curto',
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookConfigurationError,
        )
      },
    )
  },
)
