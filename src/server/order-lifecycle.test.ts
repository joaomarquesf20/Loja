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
  markOrderReadyForPickup,
  recordVerifiedPayment,
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

  const client = {
    order: {
      findUnique,
      findFirst,
      updateMany,
    },
  } as unknown as OrderLifecycleClient

  return {
    client,
    findUnique,
    findFirst,
    updateMany,
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
