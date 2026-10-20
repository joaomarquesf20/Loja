import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  './db',
  () => ({
    prisma: {},
  }),
)

import {
  PaymentInitiationConflictError,
  PaymentInitiationNotFoundError,
  PaymentInitiationValidationError,
  SIMULATED_PAYMENT_PROVIDER,
  initiateSimulatedPayment,
  type PaymentInitiationClient,
} from './payment-initiation'
import {
  createUniqueConstraintViolation,
} from '../../test/prisma-error-fixtures'

function decimal(
  value: string,
) {
  return {
    toString: () => value,
  }
}

function createOrder(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'order-1',
    status: 'PENDING' as const,
    total: decimal('128.50'),
    paymentStatus:
      'PENDING' as const,
    paymentMethod:
      'CARD' as const,
    installmentCount: null,
    paymentProvider: null,
    paymentReference: null,
    ...overrides,
  }
}

function createClient() {
  const findFirst = vi.fn()
  const updateMany = vi.fn()
  const createEvent =
    vi.fn().mockResolvedValue({
      id: 'event-1',
    })

  const transaction = vi.fn(
    async (
      callback: (
        transactionClient:
          unknown,
      ) => Promise<unknown>,
    ) =>
      callback({
        order: {
          updateMany,
        },
        orderEvent: {
          create:
            createEvent,
        },
      }),
  )

  const client = {
    order: {
      findFirst,
      updateMany,
    },
    $transaction:
      transaction,
  } as unknown as PaymentInitiationClient

  return {
    client,
    findFirst,
    updateMany,
    createEvent,
    transaction,
  }
}

describe(
  'initiateSimulatedPayment',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'inicia pagamento simulado apenas na encomenda do utilizador',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder(),
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          initiateSimulatedPayment(
            ' user-1 ',
            ' order-1 ',
            client,
            () =>
              'pfa_sim_test-123',
          ),
        ).resolves.toEqual({
          orderId: 'order-1',
          paymentStatus:
            'PENDING',
          paymentMethod:
            'CARD',
          installmentCount:
            null,
          paymentProvider:
            SIMULATED_PAYMENT_PROVIDER,
          paymentReference:
            'pfa_sim_test-123',
          amount: '128.50',
        })

        expect(
          findFirst,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            userId: 'user-1',
          },
          select: {
            id: true,
            status: true,
            total: true,
            paymentStatus: true,
            paymentMethod: true,
            installmentCount:
              true,
            paymentProvider: true,
            paymentReference: true,
          },
        })

        expect(
          updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            userId: 'user-1',
            status: 'PENDING',
            paymentStatus:
              'PENDING',
            paymentProvider: null,
            paymentReference: null,
          },
          data: {
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_test-123',
          },
        })
      },
    )

    test(
      'preserva prestações definidas no checkout',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentMethod:
              'INSTALLMENTS',
            installmentCount: 3,
            total: '300.00',
          }),
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_installments',
          ),
        ).resolves.toMatchObject({
          paymentMethod:
            'INSTALLMENTS',
          installmentCount: 3,
          amount: '300.00',
        })
      },
    )

    test(
      'é idempotente quando o pagamento simulado já foi iniciado',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_existing',
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
          ),
        ).resolves.toMatchObject({
          paymentProvider:
            'PFA_SIMULATED',
          paymentReference:
            'pfa_sim_existing',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'recupera de duas iniciações concorrentes devolvendo a referência já criada',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst
          .mockResolvedValueOnce(
            createOrder(),
          )
          .mockResolvedValueOnce(
            createOrder({
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_winner',
            }),
          )

        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_loser',
          ),
        ).resolves.toMatchObject({
          paymentReference:
            'pfa_sim_winner',
        })

        expect(
          findFirst,
        ).toHaveBeenCalledTimes(2)
      },
    )

    test(
      'converte colisão UNIQUE da referência em conflito seguro',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder(),
        )

        updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            index:
              'Order_paymentProvider_paymentReference_key',
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_duplicate',
          ),
        ).rejects.toMatchObject({
          name:
            'PaymentInitiationConflictError',
          message:
            'A referência de pagamento já está associada a outra encomenda',
        })

        expect(
          findFirst,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'converte colisão UNIQUE da referência identificada pelos campos em conflito seguro',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder(),
        )

        updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            fields: [
              'paymentReference',
              'paymentProvider',
            ],
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_duplicate',
          ),
        ).rejects.toMatchObject({
          name:
            'PaymentInitiationConflictError',
          message:
            'A referência de pagamento já está associada a outra encomenda',
        })

        expect(
          findFirst,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test.each([
      {
        name: 'sem metadados',
        error: {
          code: 'P2002',
        },
      },
      {
        name: 'com metadados nulos',
        error: {
          code: 'P2002',
          meta: null,
        },
      },
      {
        name: 'sem modelo identificado',
        error: {
          code: 'P2002',
          meta: {},
        },
      },
      {
        name: 'sem detalhe do adaptador',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
          },
        },
      },
      {
        name: 'com detalhe do adaptador incompleto',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            driverAdapterError: {},
          },
        },
      },
      {
        name: 'sem restrição no detalhe do adaptador',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            driverAdapterError: {
              cause: {
                kind:
                  'UniqueConstraintViolation',
              },
            },
          },
        },
      },
      {
        name: 'de outro tipo de violação',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            driverAdapterError: {
              cause: {
                kind:
                  'ForeignKeyConstraintViolation',
                constraint: {
                  index:
                    'Order_paymentProvider_paymentReference_key',
                },
              },
            },
          },
        },
      },
      {
        name: 'de outro modelo',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Product',
            driverAdapterError: {
              cause: {
                kind:
                  'UniqueConstraintViolation',
                constraint: {
                  fields: [
                    'paymentProvider',
                    'paymentReference',
                  ],
                },
              },
            },
          },
        },
      },
      {
        name: 'com campos de outra restrição',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            driverAdapterError: {
              cause: {
                kind:
                  'UniqueConstraintViolation',
                constraint: {
                  fields: ['orderNumber'],
                },
              },
            },
          },
        },
      },
      {
        name: 'com índice de outra restrição',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            driverAdapterError: {
              cause: {
                kind:
                  'UniqueConstraintViolation',
                constraint: {
                  index:
                    'Order_orderNumber_key',
                },
              },
            },
          },
        },
      },
      {
        name: 'com alvo de texto (forma não emitida pelo Prisma instalado)',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            target:
              'Order_paymentProvider_paymentReference_key',
          },
        },
      },
      {
        name: 'com alvo vazio (forma não emitida pelo Prisma instalado)',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            target: [],
          },
        },
      },
      {
        name: 'com alvo incompleto (forma não emitida pelo Prisma instalado)',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            target: ['paymentProvider'],
          },
        },
      },
      {
        name: 'com alvo completo (forma não emitida pelo Prisma instalado)',
        error: {
          code: 'P2002',
          meta: {
            modelName: 'Order',
            target: [
              'paymentProvider',
              'paymentReference',
            ],
          },
        },
      },
      {
        name: 'de persistência que não seja unicidade',
        error: {
          code: 'P2025',
          meta: {
            modelName: 'Order',
          },
        },
      },
    ])(
      'propaga P2002 $name sem o converter em conflito de referência',
      async ({ error }) => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder(),
        )

        updateMany.mockRejectedValue(
          error,
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_duplicate',
          ),
        ).rejects.toBe(error)

        expect(
          findFirst,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'não permite iniciar pagamento numa encomenda de outro utilizador',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          null,
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-other-user',
            client,
          ),
        ).rejects.toBeInstanceOf(
          PaymentInitiationNotFoundError,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      'AUTHORIZED',
      'PAID',
      'REFUNDED',
    ] as const)(
      'rejeita iniciação quando paymentStatus é %s',
      async (paymentStatus) => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentStatus,
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          PaymentInitiationConflictError,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'reinicia pagamento falhado com nova referência e regista histórico',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
          createEvent,
          transaction,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          }),
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_retry',
          ),
        ).resolves.toMatchObject({
          paymentStatus:
            'PENDING',
          paymentProvider:
            'PFA_SIMULATED',
          paymentReference:
            'pfa_sim_retry',
        })

        expect(
          transaction,
        ).toHaveBeenCalledTimes(1)

        expect(
          updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            userId: 'user-1',
            status: 'PENDING',
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          },
          data: {
            paymentStatus:
              'PENDING',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_retry',
          },
        })

        expect(
          createEvent,
        ).toHaveBeenCalledWith({
          data: {
            orderId: 'order-1',
            type:
              'PAYMENT_RETRIED',
            fromPaymentStatus:
              'FAILED',
            toPaymentStatus:
              'PENDING',
          },
        })
      },
    )

    test(
      'recupera de duas novas tentativas concorrentes usando a referência vencedora',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
          createEvent,
        } = createClient()

        findFirst
          .mockResolvedValueOnce(
            createOrder({
              paymentStatus:
                'FAILED',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_failed',
            }),
          )
          .mockResolvedValueOnce(
            createOrder({
              paymentStatus:
                'PENDING',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_winner',
            }),
          )

        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_loser',
          ),
        ).resolves.toMatchObject({
          paymentReference:
            'pfa_sim_winner',
        })

        expect(
          findFirst,
        ).toHaveBeenCalledTimes(2)
        expect(
          createEvent,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'converte colisão UNIQUE da referência na nova tentativa em conflito seguro',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
          createEvent,
          transaction,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          }),
        )

        updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            index:
              'Order_paymentProvider_paymentReference_key',
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_retry',
          ),
        ).rejects.toMatchObject({
          name:
            'PaymentInitiationConflictError',
          message:
            'A referência de pagamento já está associada a outra encomenda',
        })

        expect(
          transaction,
        ).toHaveBeenCalledTimes(1)
        expect(
          createEvent,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'propaga P2002 de outra restrição na nova tentativa sem o converter em conflito de referência',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
          transaction,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          }),
        )

        const uniqueConstraintError =
          createUniqueConstraintViolation({
            fields: ['orderNumber'],
          })

        updateMany.mockRejectedValue(
          uniqueConstraintError,
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_retry',
          ),
        ).rejects.toBe(
          uniqueConstraintError,
        )

        expect(
          transaction,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'propaga erros de persistência que não sejam violações de unicidade na nova tentativa',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          }),
        )

        const databaseError = {
          code: 'P2025',
          meta: {
            modelName: 'Order',
          },
        }

        updateMany.mockRejectedValue(
          databaseError,
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_retry',
          ),
        ).rejects.toBe(databaseError)
      },
    )

    test(
      'não repete pagamento falhado de outro fornecedor',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'REAL_PROVIDER',
            paymentReference:
              'real_failed',
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'O pagamento falhado não pertence a uma tentativa simulada válida',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'obriga a gerar nova referência ao repetir pagamento falhado',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () =>
              'pfa_sim_failed',
          ),
        ).rejects.toMatchObject({
          message:
            'Não foi possível gerar uma nova referência de pagamento',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita encomenda com outro provider já iniciado',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentProvider:
              'OUTRO_PROVIDER',
            paymentReference:
              'pay-123',
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'PaymentInitiationConflictError',
          message:
            'A encomenda já tem outro pagamento iniciado',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita encomenda histórica sem método de pagamento',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            paymentMethod: null,
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'A encomenda não tem método de pagamento definido',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      {
        paymentMethod: 'CARD',
        installmentCount: 2,
      },
      {
        paymentMethod:
          'INSTALLMENTS',
        installmentCount: null,
      },
      {
        paymentMethod:
          'INSTALLMENTS',
        installmentCount: 1,
      },
    ])(
      'rejeita termos de pagamento inconsistentes %#',
      async (terms) => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder(terms),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'Os termos de pagamento da encomenda são inválidos',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      {
        field: 'userId',
        userId: '   ',
        orderId: 'order-1',
      },
      {
        field: 'orderId',
        userId: 'user-1',
        orderId: '   ',
      },
    ])(
      'rejeita $field vazio antes da base de dados',
      async ({
        field,
        userId,
        orderId,
      }) => {
        const {
          client,
          findFirst,
        } = createClient()

        await expect(
          initiateSimulatedPayment(
            userId,
            orderId,
            client,
          ),
        ).rejects.toEqual(
          expect.objectContaining({
            name:
              'PaymentInitiationValidationError',
            field,
          }),
        )

        expect(
          findFirst,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'usa erro específico para identificador inválido',
      async () => {
        const {
          client,
        } = createClient()

        await expect(
          initiateSimulatedPayment(
            'user-1',
            null,
            client,
          ),
        ).rejects.toBeInstanceOf(
          PaymentInitiationValidationError,
        )
      },
    )

    test(
      'rejeita referência gerada inválida',
      async () => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder(),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
            () => '   ',
          ),
        ).rejects.toBeInstanceOf(
          PaymentInitiationConflictError,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      'SHIPPED',
      'DELIVERED',
      'PICKED_UP',
      'CANCELLED',
    ] as const)(
      'rejeita pagamento no estado final %s',
      async (status) => {
        const {
          client,
          findFirst,
          updateMany,
        } = createClient()

        findFirst.mockResolvedValue(
          createOrder({
            status,
          }),
        )

        await expect(
          initiateSimulatedPayment(
            'user-1',
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'PaymentInitiationConflictError',
          message:
            'O estado atual da encomenda não permite iniciar pagamento',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
