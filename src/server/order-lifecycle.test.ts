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
  OrderLifecycleConflictError,
  OrderLifecycleNotFoundError,
  OrderLifecycleValidationError,
  applyAdminOrderAction,
  markOrderReadyForPickup,
  recordVerifiedPayment,
  recordVerifiedPaymentFailure,
  type OrderLifecycleClient,
  type OrderLifecycleState,
} from './order-lifecycle'
import {
  createUniqueConstraintViolation,
} from '../../test/prisma-error-fixtures'

function createOrder(
  overrides: Partial<OrderLifecycleState> = {},
): OrderLifecycleState {
  return {
    id: 'order-1',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    fulfillmentMethod: 'PICKUP',
    paymentProvider: null,
    paymentReference: null,
    ...overrides,
  }
}

function createPayableOrder(
  overrides: Partial<OrderLifecycleState> = {},
): OrderLifecycleState & { total: string } {
  return {
    ...createOrder(overrides),
    total: '128.50',
  }
}

function createClient() {
  const findUnique = vi.fn()
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
      findUnique,
      findFirst,
    },
    $transaction:
      transaction,
  } as unknown as OrderLifecycleClient

  return {
    client,
    findUnique,
    findFirst,
    updateMany,
    createEvent,
    transaction,
  }
}

describe(
  'recordVerifiedPayment',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'confirma pagamento verificado e grava fornecedor e referência',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
          createEvent,
        } = createClient()

        const pendingOrder =
          createPayableOrder()

        const paidOrder =
          createOrder({
            paymentStatus:
              'PAID',
            paymentProvider:
              'test-provider',
            paymentReference:
              'pay-123',
          })

        findUnique
          .mockResolvedValueOnce(
            pendingOrder,
          )
          .mockResolvedValueOnce(
            paidOrder,
          )

        findFirst.mockResolvedValue(
          null,
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          recordVerifiedPayment(
            {
              orderId: ' order-1 ',
              paymentProvider:
                ' test-provider ',
              paymentReference:
                ' pay-123 ',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).resolves.toEqual(
          paidOrder,
        )

        expect(
          findFirst,
        ).toHaveBeenCalledWith({
          where: {
            paymentProvider:
              'test-provider',
            paymentReference:
              'pay-123',
            NOT: {
              id: 'order-1',
            },
          },
          select: {
            id: true,
          },
        })

        expect(
          updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            status:
              'PENDING',
            paymentStatus:
              'PENDING',
            paymentProvider:
              null,
            paymentReference:
              null,
          },
          data: {
            paymentStatus:
              'PAID',
            paymentProvider:
              'test-provider',
            paymentReference:
              'pay-123',
          },
        })

        expect(
          createEvent,
        ).toHaveBeenCalledWith({
          data: {
            orderId:
              'order-1',
            type:
              'PAYMENT_CONFIRMED',
            fromPaymentStatus:
              'PENDING',
            toPaymentStatus:
              'PAID',
          },
        })
      },
    )

    test(
      'não confirma pagamento se a encomenda foi cancelada entre a leitura e a escrita',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
          createEvent,
        } = createClient()

        findUnique.mockResolvedValueOnce(
          createPayableOrder(),
        )
        findFirst.mockResolvedValue(
          null,
        )

        // A cancelação comitou após a leitura: o estado já não corresponde,
        // por isso o updateMany não atualiza nenhuma linha.
        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toThrow(
          'A encomenda foi alterada durante a confirmação do pagamento',
        )

        expect(
          updateMany.mock.calls[0][0].where,
        ).toMatchObject({
          id: 'order-1',
          status: 'PENDING',
        })

        expect(
          createEvent,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'é idempotente quando o mesmo pagamento já está confirmado',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        const paidOrder =
          createPayableOrder({
            paymentStatus:
              'PAID',
            paymentProvider:
              'test-provider',
            paymentReference:
              'pay-123',
          })

        findUnique.mockResolvedValue(
          paidOrder,
        )

        // O resultado expõe apenas o estado da encomenda, sem o total.
        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).resolves.toEqual({
          ...paidOrder,
          total: undefined,
        })

        expect(
          findFirst,
        ).not.toHaveBeenCalled()

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita uma referência diferente numa encomenda já paga',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder({
            paymentStatus:
              'PAID',
            paymentProvider:
              'test-provider',
            paymentReference:
              'pay-original',
          }),
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-other',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleConflictError,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita confirmação de pagamento já reembolsado',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder({
            paymentStatus:
              'REFUNDED',
            paymentProvider:
              'test-provider',
            paymentReference:
              'pay-123',
          }),
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleConflictError,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'não volta a marcar como pago um pagamento reembolsado ao receber o mesmo pagamento outra vez',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
          createEvent,
          transaction,
        } = createClient()

        // Reenvio do webhook original: a encomenda já tem o mesmo fornecedor
        // e referência, mas o pagamento foi reembolsado entretanto.
        findUnique.mockResolvedValue(
          createPayableOrder({
            status: 'CONFIRMED',
            paymentStatus:
              'REFUNDED',
            paymentProvider:
              'test-provider',
            paymentReference:
              'pay-123',
          }),
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'Um pagamento reembolsado não pode ser confirmado novamente',
        })

        expect(
          findFirst,
        ).not.toHaveBeenCalled()
        expect(
          transaction,
        ).not.toHaveBeenCalled()
        expect(
          updateMany,
        ).not.toHaveBeenCalled()
        expect(
          createEvent,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita confirmação direta depois de uma tentativa falhar',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_failed',
          }),
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_failed',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'Um pagamento falhado tem de ser tentado novamente antes de poder ser confirmado',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita confirmação que não corresponde ao pagamento já iniciado',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder({
            paymentStatus:
              'PENDING',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_original',
          }),
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_other',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'O pagamento confirmado não corresponde ao pagamento iniciado para a encomenda',
        })

        expect(
          findFirst,
        ).not.toHaveBeenCalled()

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita referência de pagamento já usada noutra encomenda',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        findFirst.mockResolvedValue({
          id: 'order-2',
        })

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'A referência de pagamento já pertence a outra encomenda',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'converte colisão UNIQUE da referência em conflito seguro',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        findFirst.mockResolvedValue(
          null,
        )

        updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            index:
              'Order_paymentProvider_paymentReference_key',
          }),
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'A referência de pagamento já pertence a outra encomenda',
        })
      },
    )

    test(
      'converte colisão UNIQUE da referência identificada pelos campos em conflito seguro',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        findFirst.mockResolvedValue(
          null,
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
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'A referência de pagamento já pertence a outra encomenda',
        })
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
    ])(
      'propaga P2002 $name sem o converter em conflito de referência',
      async ({ error }) => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        findFirst.mockResolvedValue(
          null,
        )

        updateMany.mockRejectedValue(
          error,
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toBe(error)
      },
    )

    test(
      'propaga erros de persistência que não sejam violações de unicidade',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        findFirst.mockResolvedValue(
          null,
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
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toBe(databaseError)
      },
    )

    test.each([
      {
        field: 'orderId',
        input: {
          orderId: '   ',
          paymentProvider:
            'test-provider',
          paymentReference:
            'pay-123',
        },
      },
      {
        field:
          'paymentProvider',
        input: {
          orderId: 'order-1',
          paymentProvider: '   ',
          paymentReference:
            'pay-123',
        },
      },
      {
        field:
          'paymentReference',
        input: {
          orderId: 'order-1',
          paymentProvider:
            'test-provider',
          paymentReference: '   ',
        },
      },
    ])(
      'rejeita $field vazio antes de consultar a base de dados',
      async ({
        field,
        input,
      }) => {
        const {
          client,
          findUnique,
        } = createClient()

        await expect(
          recordVerifiedPayment(
            {
              ...input,
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toEqual(
          expect.objectContaining({
            name:
              'OrderLifecycleValidationError',
            field,
          }),
        )

        expect(
          findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita encomenda inexistente',
      async () => {
        const {
          client,
          findUnique,
        } = createClient()

        findUnique.mockResolvedValue(
          null,
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleNotFoundError,
        )
      },
    )

    test(
      'deteta alteração concorrente durante a confirmação',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        findFirst.mockResolvedValue(
          null,
        )

        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'A encomenda foi alterada durante a confirmação do pagamento',
        })
      },
    )

    test(
      'não grava segundo evento quando a mesma confirmação chega em paralelo',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
          createEvent,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        findFirst.mockResolvedValue(
          null,
        )

        // O pedido concorrente ganhou a corrida e já alterou o estado.
        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
        })

        expect(
          updateMany,
        ).toHaveBeenCalledTimes(1)

        expect(
          createEvent,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      'CANCELLED',
      'SHIPPED',
      'DELIVERED',
      'PICKED_UP',
    ])(
      'rejeita confirmação de pagamento para encomenda %s',
      async (status) => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder({
            status: status as OrderLifecycleState['status'],
          }),
        )

        findFirst.mockResolvedValue(
          null,
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'O estado atual da encomenda não permite confirmar o pagamento',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita pagamento de valor diferente do total da encomenda',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        findFirst.mockResolvedValue(
          null,
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.00',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'O valor pago não corresponde ao total da encomenda',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'aceita total com uma casa decimal quando o valor pago é equivalente',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique
          .mockResolvedValueOnce({
            ...createPayableOrder(),
            total: '128.5',
          })
          .mockResolvedValueOnce(
            createOrder({
              paymentStatus:
                'PAID',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
            }),
          )

        findFirst.mockResolvedValue(
          null,
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).resolves.toMatchObject({
          paymentStatus: 'PAID',
        })
      },
    )

    test.each([
      'USD',
      'eur',
    ])(
      'rejeita moeda %s diferente da moeda da loja',
      async (currency) => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createPayableOrder(),
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency,
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'A moeda do pagamento não corresponde à moeda da loja',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      {
        field: 'amount',
        amount: undefined,
      },
      {
        field: 'amount',
        amount: '',
      },
      {
        field: 'amount',
        amount: '12,50',
      },
      {
        field: 'amount',
        amount: '-1.00',
      },
      {
        field: 'amount',
        amount: '1.999',
      },
      {
        field: 'currency',
        amount: '128.50',
        currency: '   ',
      },
    ])(
      'rejeita $field inválido antes de consultar a base de dados',
      async ({
        field,
        amount,
        currency = 'EUR',
      }) => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: amount as string,
              currency: currency as string,
            },
            client,
          ),
        ).rejects.toEqual(
          expect.objectContaining({
            name:
              'OrderLifecycleValidationError',
            field,
          }),
        )

        expect(
          findUnique,
        ).not.toHaveBeenCalled()

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'falha de forma segura quando a encomenda não tem total válido',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder(),
        )

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
              amount: '128.50',
              currency: 'EUR',
            },
            client,
          ),
        ).rejects.toThrow(
          'Encomenda sem total válido para confirmar pagamento',
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )
  },
)

describe(
  'recordVerifiedPaymentFailure',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'marca a tentativa iniciada como falhada e regista histórico',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
          createEvent,
        } = createClient()

        const pendingOrder =
          createOrder({
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          })

        const failedOrder =
          createOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          })

        findUnique
          .mockResolvedValueOnce(
            pendingOrder,
          )
          .mockResolvedValueOnce(
            failedOrder,
          )

        findFirst.mockResolvedValue(
          null,
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          recordVerifiedPaymentFailure(
            {
              orderId: ' order-1 ',
              paymentProvider:
                ' PFA_SIMULATED ',
              paymentReference:
                ' pfa_sim_attempt-1 ',
            },
            client,
          ),
        ).resolves.toEqual(
          failedOrder,
        )

        expect(
          updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            paymentStatus:
              'PENDING',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          },
          data: {
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          },
        })

        expect(
          createEvent,
        ).toHaveBeenCalledWith({
          data: {
            orderId: 'order-1',
            type:
              'PAYMENT_FAILED',
            fromPaymentStatus:
              'PENDING',
            toPaymentStatus:
              'FAILED',
          },
        })
      },
    )

    test(
      'é idempotente quando a mesma tentativa já está falhada',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        const failedOrder =
          createOrder({
            paymentStatus:
              'FAILED',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          })

        findUnique.mockResolvedValue(
          failedOrder,
        )

        await expect(
          recordVerifiedPaymentFailure(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_attempt-1',
            },
            client,
          ),
        ).resolves.toEqual(
          failedOrder,
        )

        expect(
          findFirst,
        ).not.toHaveBeenCalled()
        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita falha que não corresponde à tentativa iniciada',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          }),
        )

        await expect(
          recordVerifiedPaymentFailure(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_other',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'A falha recebida não corresponde ao pagamento iniciado para a encomenda',
        })

        expect(
          findFirst,
        ).not.toHaveBeenCalled()
        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      'PAID',
      'REFUNDED',
    ] as const)(
      'não transforma pagamento %s em falhado',
      async (paymentStatus) => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentStatus,
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          }),
        )

        await expect(
          recordVerifiedPaymentFailure(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_attempt-1',
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleConflictError,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'deteta alteração concorrente durante o registo da falha',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          }),
        )
        findFirst.mockResolvedValue(
          null,
        )
        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          recordVerifiedPaymentFailure(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_attempt-1',
            },
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'A encomenda foi alterada durante o registo da falha do pagamento',
        })
      },
    )

    test(
      'converte colisão UNIQUE da referência em conflito seguro',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          }),
        )

        findFirst.mockResolvedValue(
          null,
        )

        updateMany.mockRejectedValue(
          createUniqueConstraintViolation({
            index:
              'Order_paymentProvider_paymentReference_key',
          }),
        )

        await expect(
          recordVerifiedPaymentFailure(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_attempt-1',
            },
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'A referência de pagamento já pertence a outra encomenda',
        })
      },
    )

    test(
      'propaga P2002 de outra restrição sem o converter em conflito de referência',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_attempt-1',
          }),
        )

        findFirst.mockResolvedValue(
          null,
        )

        const uniqueConstraintError =
          createUniqueConstraintViolation({
            fields: ['orderNumber'],
          })

        updateMany.mockRejectedValue(
          uniqueConstraintError,
        )

        await expect(
          recordVerifiedPaymentFailure(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_attempt-1',
            },
            client,
          ),
        ).rejects.toBe(
          uniqueConstraintError,
        )
      },
    )
  },
)

describe(
  'markOrderReadyForPickup',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'marca levantamento pago como pronto',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        const paidPickup =
          createOrder({
            status:
              'PROCESSING',
            paymentStatus:
              'PAID',
          })

        const readyPickup =
          createOrder({
            status:
              'READY_FOR_PICKUP',
            paymentStatus:
              'PAID',
          })

        findUnique
          .mockResolvedValueOnce(
            paidPickup,
          )
          .mockResolvedValueOnce(
            readyPickup,
          )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          markOrderReadyForPickup(
            ' order-1 ',
            client,
          ),
        ).resolves.toEqual(
          readyPickup,
        )

        expect(
          updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            status:
              'PROCESSING',
            fulfillmentMethod:
              'PICKUP',
            paymentStatus:
              'PAID',
          },
          data: {
            status:
              'READY_FOR_PICKUP',
          },
        })
      },
    )

    test(
      'bloqueia READY_FOR_PICKUP enquanto o pagamento está pendente',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentStatus:
              'PENDING',
          }),
        )

        await expect(
          markOrderReadyForPickup(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'O pagamento tem de estar confirmado antes do levantamento',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'bloqueia READY_FOR_PICKUP para entrega ao domicílio',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            fulfillmentMethod:
              'DELIVERY',
            paymentStatus:
              'PAID',
          }),
        )

        await expect(
          markOrderReadyForPickup(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'Apenas encomendas para levantamento podem ficar prontas para levantamento',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'é idempotente quando já está pronta para levantamento',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        const ready =
          createOrder({
            status:
              'READY_FOR_PICKUP',
            paymentStatus:
              'PAID',
          })

        findUnique.mockResolvedValue(
          ready,
        )

        await expect(
          markOrderReadyForPickup(
            'order-1',
            client,
          ),
        ).resolves.toEqual(
          ready,
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
      'não permite READY_FOR_PICKUP a partir de %s',
      async (status) => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status,
            paymentStatus:
              'PAID',
          }),
        )

        await expect(
          markOrderReadyForPickup(
            'order-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleConflictError,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'deteta alteração concorrente ao marcar levantamento pronto',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status:
              'CONFIRMED',
            paymentStatus:
              'PAID',
          }),
        )

        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          markOrderReadyForPickup(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'A encomenda foi alterada durante a atualização do estado',
        })
      },
    )

    test(
      'rejeita identificador vazio antes da base de dados',
      async () => {
        const {
          client,
          findUnique,
        } = createClient()

        await expect(
          markOrderReadyForPickup(
            '   ',
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleValidationError,
        )

        expect(
          findUnique,
        ).not.toHaveBeenCalled()
      },
    )
  },
)


describe(
  'applyAdminOrderAction',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'confirma uma encomenda paga pendente',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        const pending =
          createOrder({
            paymentStatus:
              'PAID',
            fulfillmentMethod:
              'DELIVERY',
          })

        const confirmed =
          createOrder({
            status:
              'CONFIRMED',
            paymentStatus:
              'PAID',
            fulfillmentMethod:
              'DELIVERY',
          })

        findUnique
          .mockResolvedValueOnce(
            pending,
          )
          .mockResolvedValueOnce(
            confirmed,
          )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          applyAdminOrderAction(
            ' order-1 ',
            'CONFIRM',
            client,
          ),
        ).resolves.toEqual(
          confirmed,
        )

        expect(
          updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            status:
              'PENDING',
            paymentStatus:
              'PAID',
          },
          data: {
            status:
              'CONFIRMED',
          },
        })
      },
    )

    test(
      'bloqueia qualquer avanço administrativo enquanto o pagamento não está pago',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            fulfillmentMethod:
              'DELIVERY',
            paymentStatus:
              'PENDING',
          }),
        )

        await expect(
          applyAdminOrderAction(
            'order-1',
            'CONFIRM',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'O pagamento tem de estar confirmado antes de avançar a encomenda',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'avança uma encomenda confirmada para processamento',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique
          .mockResolvedValueOnce(
            createOrder({
              status:
                'CONFIRMED',
              paymentStatus:
                'PAID',
            }),
          )
          .mockResolvedValueOnce(
            createOrder({
              status:
                'PROCESSING',
              paymentStatus:
                'PAID',
            }),
          )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          applyAdminOrderAction(
            'order-1',
            'START_PROCESSING',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'PROCESSING',
        })
      },
    )

    test(
      'expede apenas uma encomenda DELIVERY em processamento',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique
          .mockResolvedValueOnce(
            createOrder({
              status:
                'PROCESSING',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'DELIVERY',
            }),
          )
          .mockResolvedValueOnce(
            createOrder({
              status:
                'SHIPPED',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'DELIVERY',
            }),
          )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          applyAdminOrderAction(
            'order-1',
            'SHIP',
            client,
          ),
        ).resolves.toMatchObject({
          status: 'SHIPPED',
        })

        expect(
          updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            status:
              'PROCESSING',
            paymentStatus:
              'PAID',
            fulfillmentMethod:
              'DELIVERY',
          },
          data: {
            status:
              'SHIPPED',
          },
        })
      },
    )

    test(
      'não permite expedir uma encomenda PICKUP',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status:
              'PROCESSING',
            paymentStatus:
              'PAID',
            fulfillmentMethod:
              'PICKUP',
          }),
        )

        await expect(
          applyAdminOrderAction(
            'order-1',
            'SHIP',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'Apenas encomendas para entrega podem ser expedidas',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'marca uma encomenda expedida como entregue',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique
          .mockResolvedValueOnce(
            createOrder({
              status:
                'SHIPPED',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'DELIVERY',
            }),
          )
          .mockResolvedValueOnce(
            createOrder({
              status:
                'DELIVERED',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'DELIVERY',
            }),
          )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          applyAdminOrderAction(
            'order-1',
            'DELIVER',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'DELIVERED',
        })
      },
    )

    test(
      'reutiliza a regra segura para marcar levantamento pronto',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique
          .mockResolvedValueOnce(
            createOrder({
              status:
                'PROCESSING',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'PICKUP',
            }),
          )
          .mockResolvedValueOnce(
            createOrder({
              status:
                'READY_FOR_PICKUP',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'PICKUP',
            }),
          )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          applyAdminOrderAction(
            'order-1',
            'READY_FOR_PICKUP',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'READY_FOR_PICKUP',
        })
      },
    )

    test(
      'marca como levantada apenas uma encomenda PICKUP pronta',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique
          .mockResolvedValueOnce(
            createOrder({
              status:
                'READY_FOR_PICKUP',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'PICKUP',
            }),
          )
          .mockResolvedValueOnce(
            createOrder({
              status:
                'PICKED_UP',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'PICKUP',
            }),
          )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          applyAdminOrderAction(
            'order-1',
            'PICK_UP',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'PICKED_UP',
        })
      },
    )

    test(
      'é idempotente quando a ação já atingiu o estado de destino',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        const delivered =
          createOrder({
            status:
              'DELIVERED',
            paymentStatus:
              'PAID',
            fulfillmentMethod:
              'DELIVERY',
          })

        findUnique.mockResolvedValue(
          delivered,
        )

        await expect(
          applyAdminOrderAction(
            'order-1',
            'DELIVER',
            client,
          ),
        ).resolves.toEqual(
          delivered,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita ação inválida antes de consultar a base de dados',
      async () => {
        const {
          client,
          findUnique,
        } = createClient()

        await expect(
          applyAdminOrderAction(
            'order-1',
            'DELETE',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleValidationError',
          field: 'action',
        })

        expect(
          findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita orderId inválido antes de consultar a base de dados',
      async () => {
        const {
          client,
          findUnique,
        } = createClient()

        await expect(
          applyAdminOrderAction(
            '   ',
            'CONFIRM',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleValidationError',
          field: 'orderId',
        })

        expect(
          findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita saltos de estado',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status:
              'PENDING',
            paymentStatus:
              'PAID',
            fulfillmentMethod:
              'DELIVERY',
          }),
        )

        await expect(
          applyAdminOrderAction(
            'order-1',
            'SHIP',
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleConflictError,
        )

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'deteta alteração concorrente durante uma transição administrativa',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status:
              'CONFIRMED',
            paymentStatus:
              'PAID',
          }),
        )

        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          applyAdminOrderAction(
            'order-1',
            'START_PROCESSING',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'A encomenda foi alterada durante a atualização do estado',
        })
      },
    )
  },
)
