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
  OrderValidationError,
  listUserOrders,
  type OrderClient,
} from './orders'

function decimal(
  value: string,
) {
  return {
    toString: () => value,
  }
}

function createOrderRecord() {
  return {
    id: 'order-1',
    orderNumber:
      'PFA-ABC123',
    subtotal:
      decimal('100.00'),
    shippingCost:
      decimal('5.50'),
    tax:
      decimal('23.00'),
    total:
      decimal('128.50'),
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    fulfillmentMethod:
      'DELIVERY' as const,
    shippingName:
      'Maria Silva',
    shippingEmail:
      'maria@example.com',
    shippingPhone:
      '910000000',
    shippingAddressLine1:
      'Rua Central 10',
    shippingAddressLine2:
      null,
    shippingCity: 'Porto',
    shippingPostalCode:
      '4000-001',
    shippingCountry:
      'Portugal',
    createdAt:
      new Date(
        '2026-09-01T10:00:00.000Z',
      ),
    items: [
      {
        id: 'item-1',
        productNameAtPurchase:
          'Filtro de óleo',
        productSkuAtPurchase:
          'FLT-001',
        priceAtPurchase:
          decimal('50.00'),
        quantity: 2,
        subtotalAtPurchase:
          decimal('100.00'),
      },
    ],
    events: [],
  }
}

function createClient() {
  const findMany = vi.fn()

  const client = {
    order: {
      findMany,
    },
  } as unknown as OrderClient

  return {
    client,
    findMany,
  }
}

describe(
  'listUserOrders',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'lista apenas encomendas do utilizador indicado',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        findMany.mockResolvedValue(
          [],
        )

        await expect(
          listUserOrders(
            ' user-1 ',
            client,
          ),
        ).resolves.toEqual([])

        expect(
          findMany,
        ).toHaveBeenCalledTimes(
          1,
        )

        expect(
          findMany,
        ).toHaveBeenCalledWith({
          where: {
            userId: 'user-1',
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            orderNumber: true,
            subtotal: true,
            shippingCost: true,
            tax: true,
            total: true,
            status: true,
            paymentStatus: true,
            fulfillmentMethod:
              true,
            shippingName: true,
            shippingEmail: true,
            shippingPhone: true,
            shippingAddressLine1:
              true,
            shippingAddressLine2:
              true,
            shippingCity: true,
            shippingPostalCode:
              true,
            shippingCountry: true,
            createdAt: true,
            items: {
              orderBy: {
                id: 'asc',
              },
              select: {
                id: true,
                productNameAtPurchase:
                  true,
                productSkuAtPurchase:
                  true,
                priceAtPurchase:
                  true,
                quantity: true,
                subtotalAtPurchase:
                  true,
              },
            },
            events: {
              orderBy: [
                {
                  createdAt:
                    'asc',
                },
                {
                  id: 'asc',
                },
              ],
              select: {
                id: true,
                type: true,
                fromOrderStatus:
                  true,
                toOrderStatus:
                  true,
                fromPaymentStatus:
                  true,
                toPaymentStatus:
                  true,
                createdAt: true,
              },
            },
          },
        })
      },
    )

    test(
      'devolve os snapshots históricos da encomenda de entrega',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        const record =
          createOrderRecord()

        findMany.mockResolvedValue(
          [record],
        )

        const result =
          await listUserOrders(
            'user-1',
            client,
          )

        expect(result).toEqual([
          {
            id: 'order-1',
            orderNumber:
              'PFA-ABC123',
            subtotal: '100.00',
            shippingCost:
              '5.50',
            tax: '23.00',
            total: '128.50',
            status:
              'CONFIRMED',
            paymentStatus:
              'PAID',
            fulfillmentMethod:
              'DELIVERY',
            shippingName:
              'Maria Silva',
            shippingEmail:
              'maria@example.com',
            shippingPhone:
              '910000000',
            shippingAddressLine1:
              'Rua Central 10',
            shippingAddressLine2:
              null,
            shippingCity:
              'Porto',
            shippingPostalCode:
              '4000-001',
            shippingCountry:
              'Portugal',
            createdAt:
              record.createdAt,
            items: [
              {
                id: 'item-1',
                productNameAtPurchase:
                  'Filtro de óleo',
                productSkuAtPurchase:
                  'FLT-001',
                priceAtPurchase:
                  '50.00',
                quantity: 2,
                subtotalAtPurchase:
                  '100.00',
              },
            ],
            events: [],
          },
        ])
      },
    )

    test(
      'devolve o histórico persistido da encomenda por ordem cronológica',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        const eventCreatedAt =
          new Date(
            '2026-09-01T10:05:00.000Z',
          )

        findMany.mockResolvedValue([
          {
            ...createOrderRecord(),
            events: [
              {
                id: 'event-1',
                type:
                  'PAYMENT_CONFIRMED',
                fromOrderStatus:
                  null,
                toOrderStatus:
                  null,
                fromPaymentStatus:
                  'PENDING',
                toPaymentStatus:
                  'PAID',
                createdAt:
                  eventCreatedAt,
              },
            ],
          },
        ])

        const result =
          await listUserOrders(
            'user-1',
            client,
          )

        expect(
          result[0]?.events,
        ).toEqual([
          {
            id: 'event-1',
            type:
              'PAYMENT_CONFIRMED',
            fromOrderStatus:
              null,
            toOrderStatus:
              null,
            fromPaymentStatus:
              'PENDING',
            toPaymentStatus:
              'PAID',
            createdAt:
              eventCreatedAt,
          },
        ])
      },
    )

    test(
      'devolve levantamento em loja sem inventar morada de entrega',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        const record = {
          ...createOrderRecord(),
          fulfillmentMethod:
            'PICKUP' as const,
          shippingCost:
            decimal('0.00'),
          shippingAddressLine1:
            null,
          shippingAddressLine2:
            null,
          shippingCity:
            null,
          shippingPostalCode:
            null,
          shippingCountry:
            null,
        }

        findMany.mockResolvedValue(
          [record],
        )

        const result =
          await listUserOrders(
            'user-1',
            client,
          )

        expect(result[0]).toMatchObject({
          fulfillmentMethod:
            'PICKUP',
          shippingCost:
            '0.00',
          shippingName:
            'Maria Silva',
          shippingEmail:
            'maria@example.com',
          shippingPhone:
            '910000000',
          shippingAddressLine1:
            null,
          shippingAddressLine2:
            null,
          shippingCity:
            null,
          shippingPostalCode:
            null,
          shippingCountry:
            null,
        })
      },
    )

    test(
      'usa snapshots do item sem consultar o produto atual',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        findMany.mockResolvedValue(
          [
            {
              ...createOrderRecord(),
              items: [
                {
                  id: 'item-1',
                  productNameAtPurchase:
                    'Nome histórico',
                  productSkuAtPurchase:
                    'SKU-HISTORICO',
                  priceAtPurchase:
                    '19.99',
                  quantity: 1,
                  subtotalAtPurchase:
                    '19.99',
                },
              ],
            },
          ],
        )

        const result =
          await listUserOrders(
            'user-1',
            client,
          )

        expect(
          result[0]?.items[0],
        ).toEqual({
          id: 'item-1',
          productNameAtPurchase:
            'Nome histórico',
          productSkuAtPurchase:
            'SKU-HISTORICO',
          priceAtPurchase:
            '19.99',
          quantity: 1,
          subtotalAtPurchase:
            '19.99',
        })
      },
    )

    test(
      'preserva complemento da morada quando existe',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        findMany.mockResolvedValue(
          [
            {
              ...createOrderRecord(),
              shippingAddressLine2:
                '2.º esquerdo',
            },
          ],
        )

        const result =
          await listUserOrders(
            'user-1',
            client,
          )

        expect(
          result[0]
            ?.shippingAddressLine2,
        ).toBe(
          '2.º esquerdo',
        )
      },
    )

    test(
      'normaliza valores monetários recebidos como números ou strings',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        findMany.mockResolvedValue(
          [
            {
              ...createOrderRecord(),
              subtotal: 100,
              shippingCost:
                '5.5',
              tax: 23,
              total: '128.5',
            },
          ],
        )

        const result =
          await listUserOrders(
            'user-1',
            client,
          )

        expect(
          result[0],
        ).toMatchObject({
          subtotal: '100',
          shippingCost:
            '5.5',
          tax: '23',
          total: '128.5',
        })
      },
    )

    test(
      'rejeita utilizador vazio antes de consultar a base de dados',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        await expect(
          listUserOrders(
            '   ',
            client,
          ),
        ).rejects.toEqual(
          expect.objectContaining({
            name:
              'OrderValidationError',
            field: 'userId',
            message:
              'Utilizador é obrigatório',
          }),
        )

        expect(
          findMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'usa erro específico para utilizador inválido',
      async () => {
        const {
          client,
        } = createClient()

        await expect(
          listUserOrders(
            null as unknown as string,
            client,
          ),
        ).rejects.toBeInstanceOf(
          OrderValidationError,
        )
      },
    )
  },
)