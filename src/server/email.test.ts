import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

// O cliente Prisma é substituído (padrão dos testes do servidor) — o serviço
// de email recebe sempre os clientes e a configuração como parâmetros.
vi.mock(
  './db',
  () => ({
    prisma: {},
  }),
)

import {
  EmailMoneyValue,
  EmailClient,
  EmailOrderClient,
  EmailOrderRecord,
  EmailSendResponse,
  SendEmailDeliveryOptions,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
} from './email'

function orderClientWith(
  order:
    | EmailOrderRecord
    | null,
): EmailOrderClient {
  return {
    order: {
      findUnique:
        vi.fn(
          async () => order,
        ),
    },
  }
}

function emailClientWith(
  implementation?: () => Promise<EmailSendResponse>,
): EmailClient {
  return {
    emails: {
      send: vi.fn(
        implementation ??
          (() =>
            Promise.resolve({
              data: {
                id: 'resend-email-1',
              },
              error: null,
            })),
      ),
    },
  }
}

const money = (
  value: string,
): EmailMoneyValue => value

function makeOrderRecord(
  overrides: Partial<EmailOrderRecord> = {},
): EmailOrderRecord {
  return {
    id: 'order-1',
    orderNumber:
      'ORD-2026-1',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    fulfillmentMethod:
      'DELIVERY',
    subtotal: money(
      '100.00',
    ),
    shippingCost: money(
      '4.90',
    ),
    tax: money('18.00'),
    total: money('104.90'),
    shippingName:
      'Maria Encomenda',
    shippingEmail:
      'maria@example.com',
    shippingAddressLine1:
      'Rua das Flores, 10',
    shippingAddressLine2:
      '2.º Dto',
    shippingCity: 'Lisboa',
    shippingPostalCode:
      '1000-001',
    shippingCountry:
      'Portugal',
    createdAt: new Date(
      '2026-10-22T10:00:00.000Z',
    ),
    updatedAt: new Date(
      '2026-10-22T10:01:00.000Z',
    ),
    items: [
      {
        productNameAtPurchase:
          'Óleo do motor',
        productSkuAtPurchase:
          'SKU-1',
        quantity: 2,
        priceAtPurchase:
          money('12.50'),
        subtotalAtPurchase:
          money('25.00'),
        variantOptionsAtPurchase:
          [
            {
              code: 'capacity',
              name: 'Capacidade',
              value: '2 L',
            },
          ],
      },
    ],
    events: [],
    ...overrides,
  }
}

function standardOptions(
  overrides: Partial<SendEmailDeliveryOptions> = {},
): SendEmailDeliveryOptions {
  return {
    apiKey: 're-test-api-key',
    from: 'store@example.com',
    ...overrides,
  }
}

describe(
  'Serviço de emails transacionais',
  () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    describe(
      'confirmação de encomenda',
      () => {
        test(
          'envia com remetente, destinatário e assunto corretos',
          async () => {
            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'sent',
              id: 'resend-email-1',
            })

            expect(
              emailClient.emails
                .send,
            ).toHaveBeenCalledTimes(
              1,
            )

            expect(
              emailClient.emails
                .send,
            ).toHaveBeenCalledWith(
              {
                from:
                  'store@example.com',
                to: 'maria@example.com',
                subject:
                  'PFAAutoParts: Encomenda ORD-2026-1 confirmada',
                react:
                  expect.anything(),
              },
            )
          },
        )

        test(
          'modo de simulação quando RESEND_API_KEY não está configurada',
          async () => {
            const consoleInfo =
              vi.spyOn(
                console,
                'info',
              ).mockImplementation(
                () => undefined,
              )

            vi.stubEnv(
              'RESEND_API_KEY',
              '',
            )
            vi.stubEnv(
              'EMAIL_FROM',
              '',
            )

            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  client:
                    orderClientWith(
                      makeOrderRecord(),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'skipped',
              reason:
                'missing-api-key',
            })

            expect(
              emailClient.emails
                .send,
            ).not.toHaveBeenCalled()

            expect(
              consoleInfo,
            ).toHaveBeenCalledWith(
              expect.stringContaining(
                'Simulação',
              ),
            )

            consoleInfo.mockRestore()
          },
        )

        test(
          'Erro quando a chave existe mas EMAIL_FROM falta',
          async () => {
            const consoleError =
              vi.spyOn(
                console,
                'error',
              ).mockImplementation(
                () => undefined,
              )

            vi.stubEnv(
              'EMAIL_FROM',
              '',
            )

            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions({
                    from: undefined,
                  }),
                  client:
                    orderClientWith(
                      makeOrderRecord(),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'error',
              error:
                'EMAIL_FROM não configurado',
            })

            expect(
              emailClient.emails
                .send,
            ).not.toHaveBeenCalled()

            expect(
              consoleError,
            ).toHaveBeenCalled()

            consoleError.mockRestore()
          },
        )

        test(
          'Erro do fornecedor produz desfecho de erro sem lançar',
          async () => {
            const consoleError =
              vi.spyOn(
                console,
                'error',
              ).mockImplementation(
                () => undefined,
              )

            const emailClient =
              emailClientWith(
                () =>
                  Promise.resolve({
                    data: null,
                    error: {
                      message:
                        'Cota de envios excedida',
                    },
                  }),
              )

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'error',
              error:
                'Cota de envios excedida',
            })

            consoleError.mockRestore()
          },
        )

        test(
          'Exceção do fornecedor produz desfecho de erro sem lançar',
          async () => {
            const consoleError =
              vi.spyOn(
                console,
                'error',
              ).mockImplementation(
                () => undefined,
              )

            const emailClient =
              emailClientWith(
                () =>
                  Promise.reject(
                    new Error(
                      'rede em baixo',
                    ),
                  ),
              )

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'error',
              error:
                'rede em baixo',
            })

            consoleError.mockRestore()
          },
        )

        test(
          'Resposta sem mensagem de erro nem identificador produz desfecho de erro',
          async () => {
            const consoleError =
              vi.spyOn(
                console,
                'error',
              ).mockImplementation(
                () => undefined,
              )

            const emailClient =
              emailClientWith(
                () =>
                  Promise.resolve({
                    data: null,
                    error: null,
                  }),
              )

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'error',
              error:
                'Resposta do fornecedor de email sem identificador',
            })

            consoleError.mockRestore()
          },
        )

        test(
          'salta quando a encomenda não existe',
          async () => {
            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      null,
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'skipped',
              reason:
                'order-not-found',
            })

            expect(
              emailClient.emails
                .send,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'salta quando o pagamento não está pago',
          async () => {
            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord({
                        paymentStatus:
                          'PENDING',
                      }),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'skipped',
              reason:
                'order-not-paid',
            })

            expect(
              emailClient.emails
                .send,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'salta identificadores de encomenda vazios',
          async () => {
            const orderClient =
              orderClientWith(
                makeOrderRecord(),
              )

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    '   ',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClient,
                  emailClient:
                    emailClientWith(),
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'skipped',
              reason:
                'invalid-order-id',
            })

            expect(
              orderClient.order
                .findUnique,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'Salta entregas repetidas: evento de confirmação anterior ao pedido',
          async () => {
            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                  paymentEventSinceMs:
                    Date.now(),
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(
                        {
                          events: [
                            {
                              type: 'PAYMENT_CONFIRMED',
                              createdAt:
                                new Date(
                                  Date.now() -
                                    60_000,
                                ),
                            },
                          ],
                        },
                      ),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'skipped',
              reason:
                'already-confirmed',
            })

            expect(
              emailClient.emails
                .send,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'Envia quando o evento de confirmação é recente (primeira entrega)',
          async () => {
            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                  paymentEventSinceMs:
                    Date.now(),
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(
                        {
                          events: [
                            {
                              type: 'PAYMENT_CONFIRMED',
                              createdAt:
                                new Date(),
                            },
                          ],
                        },
                      ),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'sent',
              id: 'resend-email-1',
            })
          },
        )

        test(
          'Envia quando não há evento de confirmação conhecido',
          async () => {
            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                  paymentEventSinceMs:
                    Date.now(),
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'sent',
              id: 'resend-email-1',
            })
          },
        )

        test(
          'Desfecho de erro para valores monetários não confiáveis',
          async () => {
            const consoleError =
              vi.spyOn(
                console,
                'error',
              ).mockImplementation(
                () => undefined,
              )

            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(
                        {
                          total: money(
                            '12.345',
                          ),
                        },
                      ),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'error',
              error:
                'Valores monetários da encomenda inválidos',
            })

            expect(
              emailClient.emails
                .send,
            ).not.toHaveBeenCalled()

            consoleError.mockRestore()
          },
        )

        test(
          'Desfecho de erro para artigos inválidos',
          async () => {
            const consoleError =
              vi.spyOn(
                console,
                'error',
              ).mockImplementation(
                () => undefined,
              )

            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderConfirmationEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(
                        {
                          items: [
                            {
                              productNameAtPurchase:
                                'Óleo do motor',
                              productSkuAtPurchase:
                                'SKU-1',
                              quantity: 0,
                              priceAtPurchase:
                                money(
                                  '12.50',
                                ),
                              subtotalAtPurchase:
                                money(
                                  '0.00',
                                ),
                              variantOptionsAtPurchase:
                                [],
                            },
                          ],
                        },
                      ),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'error',
              error:
                'Artigos da encomenda inválidos',
            })

            expect(
              emailClient.emails
                .send,
            ).not.toHaveBeenCalled()

            consoleError.mockRestore()
          },
        )
      },
    )

    describe(
      'atualização de estado de encomenda',
      () => {
        test(
          'envia com remetente, destinatário e assunto corretos',
          async () => {
            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderStatusUpdateEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      makeOrderRecord(
                        {
                          status:
                            'SHIPPED',
                        },
                      ),
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'sent',
              id: 'resend-email-1',
            })

            expect(
              emailClient.emails
                .send,
            ).toHaveBeenCalledWith(
              {
                from:
                  'store@example.com',
                to: 'maria@example.com',
                subject:
                  'PFAAutoParts: Atualização da encomenda ORD-2026-1',
                react:
                  expect.anything(),
              },
            )
          },
        )

        test(
          'salta quando a encomenda não existe',
          async () => {
            const emailClient =
              emailClientWith()

            const outcome =
              await sendOrderStatusUpdateEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client:
                    orderClientWith(
                      null,
                    ),
                  emailClient,
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'skipped',
              reason:
                'order-not-found',
            })

            expect(
              emailClient.emails
                .send,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'Respeita o modo de simulação',
          async () => {
            const consoleInfo =
              vi.spyOn(
                console,
                'info',
              ).mockImplementation(
                () => undefined,
              )

            vi.stubEnv(
              'RESEND_API_KEY',
              '',
            )
            vi.stubEnv(
              'EMAIL_FROM',
              '',
            )

            const outcome =
              await sendOrderStatusUpdateEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  client:
                    orderClientWith(
                      makeOrderRecord(),
                    ),
                  emailClient:
                    emailClientWith(),
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'skipped',
              reason:
                'missing-api-key',
            })

            consoleInfo.mockRestore()
          },
        )

        test(
          'Exceção do cliente de dados produz desfecho de erro sem lançar',
          async () => {
            const consoleError =
              vi.spyOn(
                console,
                'error',
              ).mockImplementation(
                () => undefined,
              )

            const outcome =
              await sendOrderStatusUpdateEmail(
                {
                  orderId:
                    'order-1',
                },
                {
                  ...standardOptions(),
                  client: {
                    order: {
                      findUnique:
                        vi.fn(
                          async () =>
                            Promise.reject(
                              new Error(
                                'base de dados indisponível',
                              ),
                            ),
                        ),
                    },
                  },
                  emailClient:
                    emailClientWith(),
                },
              )

            expect(
              outcome,
            ).toEqual({
              status: 'error',
              error:
                'base de dados indisponível',
            })

            consoleError.mockRestore()
          },
        )
      },
    )
  },
)
