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

  const client = {
    order: {
      findFirst,
      updateMany,
    },
  } as unknown as PaymentInitiationClient

  return {
    client,
    findFirst,
    updateMany,
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

        updateMany.mockRejectedValue({
          code: 'P2002',
        })

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
      'FAILED',
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
  },
)
