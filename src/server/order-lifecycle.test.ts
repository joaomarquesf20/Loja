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
          createOrder()

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
      'é idempotente quando o mesmo pagamento já está confirmado',
      async () => {
        const {
          client,
          findUnique,
          findFirst,
          updateMany,
        } = createClient()

        const paidOrder =
          createOrder({
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

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
            },
            client,
          ),
        ).resolves.toEqual(
          paidOrder,
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
      'rejeita uma referência diferente numa encomenda já paga',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
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
          createOrder({
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
      'rejeita confirmação direta depois de uma tentativa falhar',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
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
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_failed',
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
          createOrder({
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
          createOrder(),
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
          createOrder(),
        )

        findFirst.mockResolvedValue(
          null,
        )

        updateMany.mockRejectedValue({
          code: 'P2002',
        })

        await expect(
          recordVerifiedPayment(
            {
              orderId: 'order-1',
              paymentProvider:
                'test-provider',
              paymentReference:
                'pay-123',
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
            input,
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
          createOrder(),
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
