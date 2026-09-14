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
  refundSimulatedPayment,
  type PaymentRefundClient,
} from './payment-refund'

function createOrder(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    id: 'order-1',
    status:
      'PENDING' as const,
    paymentStatus:
      'PAID' as const,
    fulfillmentMethod:
      'DELIVERY' as const,
    paymentProvider:
      'PFA_SIMULATED',
    paymentReference:
      'pfa_sim_123',
    ...overrides,
  }
}

function createClient() {
  const findUnique =
    vi.fn()

  const updateMany =
    vi.fn()

  return {
    client: {
      order: {
        findUnique,
        updateMany,
      },
    } as unknown as
      PaymentRefundClient,
    findUnique,
    updateMany,
  }
}

describe(
  'refundSimulatedPayment',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'marca pagamento simulado confirmado como reembolsado',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder(),
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          refundSimulatedPayment(
            ' order-1 ',
            client,
          ),
        ).resolves.toEqual({
          id: 'order-1',
          status:
            'PENDING',
          paymentStatus:
            'REFUNDED',
          fulfillmentMethod:
            'DELIVERY',
          paymentProvider:
            'PFA_SIMULATED',
          paymentReference:
            'pfa_sim_123',
        })

        expect(
          updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            status:
              'PENDING',
            paymentStatus:
              'PAID',
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_123',
          },
          data: {
            paymentStatus:
              'REFUNDED',
          },
        })
      },
    )

    test(
      'é idempotente quando já está reembolsado',
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
          }),
        )

        await expect(
          refundSimulatedPayment(
            'order-1',
            client,
          ),
        ).resolves.toMatchObject({
          paymentStatus:
            'REFUNDED',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'permite reembolso antes de cancelar uma encomenda em processamento',
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
          }),
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          refundSimulatedPayment(
            'order-1',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'PROCESSING',
          paymentStatus:
            'REFUNDED',
        })
      },
    )

    test(
      'permite reembolso de levantamento pronto antes do cancelamento',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status:
              'READY_FOR_PICKUP',
            fulfillmentMethod:
              'PICKUP',
          }),
        )

        updateMany.mockResolvedValue({
          count: 1,
        })

        await expect(
          refundSimulatedPayment(
            'order-1',
            client,
          ),
        ).resolves.toMatchObject({
          status:
            'READY_FOR_PICKUP',
          paymentStatus:
            'REFUNDED',
          fulfillmentMethod:
            'PICKUP',
        })
      },
    )

    test(
      'rejeita fornecedor que não seja o simulador',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentProvider:
              'REAL_PROVIDER',
          }),
        )

        await expect(
          refundSimulatedPayment(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'Este pagamento não pertence ao fornecedor simulado e não pode ser reembolsado por esta operação',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita referência de pagamento em falta',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentReference:
              null,
          }),
        )

        await expect(
          refundSimulatedPayment(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'A referência do pagamento simulado é inválida',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      'PENDING',
      'AUTHORIZED',
      'FAILED',
    ] as const)(
      'não permite reembolso a partir do pagamento %s',
      async (
        paymentStatus,
      ) => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            paymentStatus,
          }),
        )

        await expect(
          refundSimulatedPayment(
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

    test.each([
      'SHIPPED',
      'DELIVERED',
      'PICKED_UP',
      'CANCELLED',
    ] as const)(
      'não permite reembolso administrativo no estado %s',
      async (status) => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder({
            status,
          }),
        )

        await expect(
          refundSimulatedPayment(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'O estado atual da encomenda não permite reembolso administrativo',
        })

        expect(
          updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'deteta alteração concorrente durante o reembolso',
      async () => {
        const {
          client,
          findUnique,
          updateMany,
        } = createClient()

        findUnique.mockResolvedValue(
          createOrder(),
        )

        updateMany.mockResolvedValue({
          count: 0,
        })

        await expect(
          refundSimulatedPayment(
            'order-1',
            client,
          ),
        ).rejects.toMatchObject({
          message:
            'A encomenda foi alterada durante o reembolso',
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
          refundSimulatedPayment(
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
          refundSimulatedPayment(
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
