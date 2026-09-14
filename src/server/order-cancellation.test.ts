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
} from './order-lifecycle'
import {
  cancelOrderAndRestoreStock,
  type OrderCancellationClient,
} from './order-cancellation'

function createOrder(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    id: 'order-1',
    status:
      'PENDING' as const,
    paymentStatus:
      'PENDING' as const,
    fulfillmentMethod:
      'DELIVERY' as const,
    paymentProvider:
      'PFA_SIMULATED',
    paymentReference:
      'pfa_sim_123',
    items: [
      {
        productId:
          'product-1',
        quantity: 2,
      },
    ],
    ...overrides,
  }
}

function createClient() {
  const findUnique =
    vi.fn()

  const orderUpdateMany =
    vi.fn()

  const productUpdateMany =
    vi.fn()

  const createEvent =
    vi.fn().mockResolvedValue({
      id: 'event-1',
    })

  const transaction =
    vi.fn(
      async (
        callback: (
          transactionClient:
            unknown,
        ) => Promise<unknown>,
      ) =>
        callback({
          order: {
            findUnique,
            updateMany:
              orderUpdateMany,
          },
          product: {
            updateMany:
              productUpdateMany,
          },
          orderEvent: {
            create:
              createEvent,
          },
        }),
    )

  return {
    client: {
      $transaction:
        transaction,
    } as unknown as
      OrderCancellationClient,
    transaction,
    findUnique,
    orderUpdateMany,
    productUpdateMany,
    createEvent,
  }
}

describe(
  'cancelOrderAndRestoreStock',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'cancela encomenda pendente e repõe o stock',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
          createEvent,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder(),
        )

        orderUpdateMany.mockResolvedValue({
          count: 1,
        })

        productUpdateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          cancelOrderAndRestoreStock(
            ' order-1 ',
            client,
          ),
        ).resolves.toEqual({
          id: 'order-1',
          status:
            'CANCELLED',
          paymentStatus:
            'PENDING',
          fulfillmentMethod:
            'DELIVERY',
          paymentProvider:
            'PFA_SIMULATED',
          paymentReference:
            'pfa_sim_123',
        })

        expect(
          orderUpdateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            status:
              'PENDING',
            paymentStatus:
              'PENDING',
          },
          data: {
            status:
              'CANCELLED',
          },
        })

        expect(
          productUpdateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'product-1',
          },
          data: {
            stockQuantity: {
              increment: 2,
            },
          },
        })

        expect(
          createEvent,
        ).toHaveBeenCalledWith({
          data: {
            orderId:
              'order-1',
            type:
              'CANCELLED',
            fromOrderStatus:
              'PENDING',
            toOrderStatus:
              'CANCELLED',
          },
        })
      },
    )

    test(
      'agrega quantidades do mesmo produto antes de repor stock',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            items: [
              {
                productId:
                  'product-1',
                quantity: 2,
              },
              {
                productId:
                  'product-1',
                quantity: 3,
              },
            ],
          }),
        )

        orderUpdateMany.mockResolvedValue({
          count: 1,
        })

        productUpdateMany.mockResolvedValue({
          count: 1,
        })

        await cancelOrderAndRestoreStock(
          'order-1',
          client,
        )

        expect(
          productUpdateMany,
        ).toHaveBeenCalledTimes(
          1,
        )

        expect(
          productUpdateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'product-1',
          },
          data: {
            stockQuantity: {
              increment: 5,
            },
          },
        })
      },
    )

    test(
      'permite cancelar pagamento falhado',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentStatus:
              'FAILED',
          }),
        )

        orderUpdateMany.mockResolvedValue({
          count: 1,
        })

        productUpdateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'CANCELLED',
          paymentStatus:
            'FAILED',
        })
      },
    )

    test(
      'permite cancelar levantamento pronto depois de reembolso',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status:
              'READY_FOR_PICKUP',
            paymentStatus:
              'REFUNDED',
            fulfillmentMethod:
              'PICKUP',
          }),
        )

        orderUpdateMany.mockResolvedValue({
          count: 1,
        })

        productUpdateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'CANCELLED',
          paymentStatus:
            'REFUNDED',
          fulfillmentMethod:
            'PICKUP',
        })
      },
    )

    test(
      'é idempotente quando a encomenda já está cancelada',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status:
              'CANCELLED',
          }),
        )

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'CANCELLED',
        })

        expect(
          orderUpdateMany,
        ).not.toHaveBeenCalled()

        expect(
          productUpdateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'bloqueia cancelamento de encomenda paga antes de reembolso',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentStatus:
              'PAID',
          }),
        )

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          name:
            'OrderLifecycleConflictError',
          message:
            'O pagamento tem de ser reembolsado antes de cancelar a encomenda',
        })

        expect(
          orderUpdateMany,
        ).not.toHaveBeenCalled()

        expect(
          productUpdateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'bloqueia pagamento autorizado antes de anulação',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentStatus:
              'AUTHORIZED',
          }),
        )

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'O pagamento autorizado tem de ser anulado antes de cancelar a encomenda',
        })

        expect(
          orderUpdateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      'SHIPPED',
      'DELIVERED',
      'PICKED_UP',
    ] as const)(
      'bloqueia cancelamento no estado %s',
      async (status) => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status,
            paymentStatus:
              'REFUNDED',
          }),
        )

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleConflictError,
        )

        expect(
          orderUpdateMany,
        ).not.toHaveBeenCalled()

        expect(
          productUpdateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'deteta alteração concorrente antes de repor stock',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder(),
        )

        orderUpdateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'A encomenda foi alterada durante o cancelamento',
        })

        expect(
          productUpdateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'falha com segurança quando não consegue repor um produto',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder(),
        )

        orderUpdateMany.mockResolvedValue({
          count: 1,
        })

        productUpdateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'Não foi possível repor todo o stock da encomenda',
        })
      },
    )

    test(
      'rejeita quantidade inválida antes de alterar encomenda ou stock',
      async () => {
        const {
          client,
          findUnique,
          orderUpdateMany,
          productUpdateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            items: [
              {
                productId:
                  'product-1',
                quantity: 0,
              },
            ],
          }),
        )

        await expect(
          cancelOrderAndRestoreStock(
            'order-1',
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleConflictError,
        )

        expect(
          orderUpdateMany,
        ).not.toHaveBeenCalled()

        expect(
          productUpdateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita identificador vazio antes da transação',
      async () => {
        const {
          client,
          transaction,
        } = createClient()

        await expect(
          cancelOrderAndRestoreStock(
            '   ',
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleValidationError,
        )

        expect(
          transaction,
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
          cancelOrderAndRestoreStock(
            'order-404',
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderLifecycleNotFoundError,
        )
      },
    )
  },
)
