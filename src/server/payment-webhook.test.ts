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

import {
  RequestPayloadTooLargeError,
} from './http-request'
import {
  PAYMENT_WEBHOOK_MAX_AGE_SECONDS,
  PAYMENT_WEBHOOK_MAX_BODY_BYTES,
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
  signingSecret = secret,
) {
  return (
    'sha256=' +
    createHmac(
      'sha256',
      signingSecret,
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
    amount: ' 128.50 ',
    currency: 'EUR',
  })
}

describe(
  'verifyPaymentWebhookRequest',
  () => {
    beforeEach(() => {
      // Garante o comportamento de omissão nos testes que não exercitam a
      // configuração por ambiente: janela por omissão (±300 s) e rotação
      // desativada, mesmo que o processo herde estas variáveis definidas.
      vi.stubEnv(
        'PAYMENT_WEBHOOK_MAX_AGE_SECONDS',
        '',
      )
      vi.stubEnv(
        'PAYMENT_WEBHOOK_SECRET_PREVIOUS',
        '',
      )
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

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
          amount: '128.50',
          currency: 'EUR',
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
      'rejeita corpo adulterado mesmo com assinatura de outro corpo',
      async () => {
        const tamperedBody =
          validBody().replace(
            '128.50',
            '1.00',
          )

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              tamperedBody,
              {
                signature:
                  sign(validBody()),
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
              maxAgeSeconds:
                PAYMENT_WEBHOOK_MAX_AGE_SECONDS,
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
              maxAgeSeconds:
                PAYMENT_WEBHOOK_MAX_AGE_SECONDS,
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
            amount: '128.50',
            currency: 'EUR',
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

    test.each([
      { amount: undefined, currency: 'EUR' },
      { amount: '', currency: 'EUR' },
      { amount: '12.345', currency: 'EUR' },
      { amount: '-5.00', currency: 'EUR' },
      { amount: 129.9, currency: 'EUR' },
      { amount: '128.50', currency: undefined },
      { amount: '128.50', currency: 'eur' },
      { amount: '128.50', currency: 'EURO' },
    ])(
      'rejeita PAYMENT_PAID sem valor ou moeda válidos %#',
      async (fields) => {
        const rawBody =
          JSON.stringify({
            type: 'PAYMENT_PAID',
            orderId: 'order-1',
            paymentProvider:
              'provider-test',
            paymentReference:
              'pay-123',
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

    test.each([
      {
        name: 'exatamente 300 s no passado',
        offsetSeconds: -300,
        outsideWindow: false,
      },
      {
        name: 'exatamente 300 s no futuro',
        offsetSeconds: 300,
        outsideWindow: false,
      },
      {
        name: '301 s no passado',
        offsetSeconds: -301,
        outsideWindow: true,
      },
      {
        name: '301 s no futuro',
        offsetSeconds: 301,
        outsideWindow: true,
      },
    ])(
      'aplica o limite da janela temporal ($name)',
      async ({
        offsetSeconds,
        outsideWindow,
      }) => {
        const signedTimestamp =
          String(
            Math.floor(
              nowMs / 1000,
            ) + offsetSeconds,
          )

        const verification =
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                signedTimestamp,
              },
            ),
            {
              secret,
              nowMs,
              maxAgeSeconds:
                PAYMENT_WEBHOOK_MAX_AGE_SECONDS,
            },
          )

        if (outsideWindow) {
          await expect(
            verification,
          ).rejects.toMatchObject({
            name:
              'PaymentWebhookAuthenticationError',
            message:
              'Timestamp do webhook inválido ou expirado',
          })

          return
        }

        await expect(
          verification,
        ).resolves.toEqual({
          type: 'PAYMENT_PAID',
          orderId: 'order-1',
          paymentProvider:
            'provider-test',
          paymentReference:
            'pay-123',
          amount: '128.50',
          currency: 'EUR',
        })
      },
    )

    test.each([
      {
        name: 'exatamente no limite',
        contentLength: String(
          PAYMENT_WEBHOOK_MAX_BODY_BYTES,
        ),
        oversized: false,
      },
      {
        name: 'um byte acima do limite',
        contentLength: String(
          PAYMENT_WEBHOOK_MAX_BODY_BYTES +
            1,
        ),
        oversized: true,
      },
      {
        name: 'muito acima do limite',
        contentLength: '40000',
        oversized: true,
      },
    ])(
      'avalia o content-length declarado ($name)',
      async ({
        contentLength,
        oversized,
      }) => {
        const verification =
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                contentLength,
              },
            ),
            {
              secret,
              nowMs,
            },
          )

        if (oversized) {
          await expect(
            verification,
          ).rejects.toBeInstanceOf(
            RequestPayloadTooLargeError,
          )

          return
        }

        await expect(
          verification,
        ).resolves.toMatchObject({
          type: 'PAYMENT_PAID',
        })
      },
    )

    test(
      'rejeita content-length acima do limite mesmo sem corpo',
      async () => {
        // Pedido autenticado (timestamp e assinatura corretos sobre corpo
        // vazio), mas sem corpo: só o content-length declarado é inválido.
        const request =
          new Request(
            'http://localhost/api/payments/webhook',
            {
              method: 'POST',
              headers: {
                'content-type':
                  'application/json',
                'x-payment-timestamp':
                  timestamp,
                'x-payment-signature':
                  sign('', timestamp),
                'content-length':
                  '40000',
              },
            },
          )

        // Sem corpo, o erro de corpo ausente não chega a ser observado: a
        // verificação do content-length declarado acontece primeiro.
        expect(
          request.body,
        ).toBeNull()

        await expect(
          verifyPaymentWebhookRequest(
            request,
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          RequestPayloadTooLargeError,
        )
      },
    )

    test(
      'rejeita content-length acima do limite sem ler o corpo',
      async () => {
        const sentinel =
          new Error(
            'o corpo não devia ser lido',
          )

        const body =
          new ReadableStream<Uint8Array>({
            pull(
              controller,
            ) {
              controller.error(
                sentinel,
              )
            },
          })

        // `duplex` é exigido pelo fetch do Node para corpos em streaming e
        // não consta do tipo RequestInit do DOM.
        const init: RequestInit & {
          duplex: 'half'
        } = {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
            'x-payment-timestamp':
              timestamp,
            'x-payment-signature':
              sign('', timestamp),
            'content-length':
              '40000',
          },
          body,
          duplex: 'half',
        }

        const request =
          new Request(
            'http://localhost/api/payments/webhook',
            init,
          )

        // Se o corpo fosse lido, o erro observado seria o sentinela do
        // stream e não o erro de payload.
        await expect(
          verifyPaymentWebhookRequest(
            request,
            {
              secret,
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          RequestPayloadTooLargeError,
        )
      },
    )
  },
)

describe(
  'janela temporal configurável por ambiente (R9/M1)',
  () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    function windowRequest(
      offsetSeconds: number,
    ) {
      const signedTimestamp =
        String(
          Math.floor(
            nowMs / 1000,
          ) + offsetSeconds,
        )

      return requestFor(
        validBody(),
        {
          signedTimestamp,
          signature:
            sign(
              validBody(),
              signedTimestamp,
            ),
        },
      )
    }

    test(
      'usa por omissão a janela de ±300 s (valor vazio/ausente)',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_MAX_AGE_SECONDS',
          '',
        )

        await expect(
          verifyPaymentWebhookRequest(
            windowRequest(-300),
            {
              secret,
              nowMs,
            },
          ),
        ).resolves.toMatchObject({
          type: 'PAYMENT_PAID',
        })

        await expect(
          verifyPaymentWebhookRequest(
            windowRequest(-301),
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

    test.each([
      { name: 'aceita', offset: -600 },
      { name: 'aceita', offset: 600 },
      { name: 'rejeita', offset: -601 },
      { name: 'rejeita', offset: 601 },
    ])(
      '$name timestamps de 600 s configurados por ambiente',
      async ({
        name,
        offset,
      }) => {
        // Valor com espaços à volta: normalizado por trim antes de validar.
        vi.stubEnv(
          'PAYMENT_WEBHOOK_MAX_AGE_SECONDS',
          ' 600 ',
        )

        const verification =
          verifyPaymentWebhookRequest(
            windowRequest(offset),
            {
              secret,
              nowMs,
            },
          )

        if (name === 'aceita') {
          await expect(
            verification,
          ).resolves.toMatchObject({
            type: 'PAYMENT_PAID',
          })

          return
        }

        await expect(
          verification,
        ).rejects.toMatchObject({
          name:
            'PaymentWebhookAuthenticationError',
          message:
            'Timestamp do webhook inválido ou expirado',
        })
      },
    )

    test(
      'aceita o limite superior da janela (86400 s)',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_MAX_AGE_SECONDS',
          '86400',
        )

        await expect(
          verifyPaymentWebhookRequest(
            windowRequest(-86400),
            {
              secret,
              nowMs,
            },
          ),
        ).resolves.toMatchObject({
          type: 'PAYMENT_PAID',
        })
      },
    )

    test.each([
      'abc',
      '0',
      '-5',
      '3.5',
      '86401',
    ])(
      'falha em fechado com janela inválida: %s',
      async (invalidValue) => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_MAX_AGE_SECONDS',
          invalidValue,
        )

        await expect(
          verifyPaymentWebhookRequest(
            windowRequest(0),
            {
              secret,
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

describe(
  'rotação de segredo (R11/L2/L3)',
  () => {
    const previousSecret =
      '11111111111111111111111111111112'

    const thirdSecret =
      '33333333333333333333333333333334'

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test(
      'aceita assinatura com o segredo ativo quando há segredo anterior configurado',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET',
          secret,
        )
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET_PREVIOUS',
          previousSecret,
        )

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
            ),
            {
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
          amount: '128.50',
          currency: 'EUR',
        })
      },
    )

    test(
      'aceita assinatura com o segredo anterior durante a rotação',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET',
          secret,
        )
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET_PREVIOUS',
          previousSecret,
        )

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                signature:
                  sign(
                    validBody(),
                    timestamp,
                    previousSecret,
                  ),
              },
            ),
            {
              nowMs,
            },
          ),
        ).resolves.toMatchObject({
          type: 'PAYMENT_PAID',
        })
      },
    )

    test(
      'rejeita assinatura com segredo desconhecido durante a rotação',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET',
          secret,
        )
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET_PREVIOUS',
          previousSecret,
        )

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                signature:
                  sign(
                    validBody(),
                    timestamp,
                    thirdSecret,
                  ),
              },
            ),
            {
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookAuthenticationError,
        )
      },
    )

    test(
      'ignora variável de segredo anterior vazia',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET',
          secret,
        )
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET_PREVIOUS',
          '',
        )

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
            ),
            {
              nowMs,
            },
          ),
        ).resolves.toMatchObject({
          type: 'PAYMENT_PAID',
        })
      },
    )

    test(
      'falha em fechado com segredo anterior demasiado curto',
      async () => {
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET',
          secret,
        )
        vi.stubEnv(
          'PAYMENT_WEBHOOK_SECRET_PREVIOUS',
          'curto',
        )

        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
            ),
            {
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookConfigurationError,
        )
      },
    )

    test(
      'aceita previousSecret por opções mesmo sem ambiente configurado',
      async () => {
        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                signature:
                  sign(
                    validBody(),
                    timestamp,
                    previousSecret,
                  ),
              },
            ),
            {
              secret,
              previousSecret,
              nowMs,
            },
          ),
        ).resolves.toMatchObject({
          type: 'PAYMENT_PAID',
        })
      },
    )

    test(
      'rejeita segredo de terceiro por opções com rotação configurada',
      async () => {
        await expect(
          verifyPaymentWebhookRequest(
            requestFor(
              validBody(),
              {
                signature:
                  sign(
                    validBody(),
                    timestamp,
                    thirdSecret,
                  ),
              },
            ),
            {
              secret,
              previousSecret,
              nowMs,
            },
          ),
        ).rejects.toBeInstanceOf(
          PaymentWebhookAuthenticationError,
        )
      },
    )
  },
)
