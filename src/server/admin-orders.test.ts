import {
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
  getAdminOrderById,
  listAdminOrders,
  type AdminOrderClient,
} from './admin-orders'

function createClient() {
  const findMany = vi.fn()
  const findUnique = vi.fn()

  return {
    client: {
      order: {
        findMany,
        findUnique,
      },
    } as unknown as
      AdminOrderClient,
    findMany,
    findUnique,
  }
}

function createOrderRecord() {
  const createdAt =
    new Date(
      '2026-09-14T00:00:00.000Z',
    )

  return {
    id: 'order-1',
    orderNumber:
      'PFA-ABC123',
    subtotal: {
      toString: () =>
        '100.00',
    },
    shippingCost:
      '5.00',
    tax: 23,
    total: {
      toString: () =>
        '128.00',
    },
    status:
      'PROCESSING',
    paymentStatus:
      'PAID',
    paymentMethod:
      'INSTALLMENTS',
    installmentCount: 3,
    paymentProvider:
      'PFA_SIMULATED',
    paymentReference:
      'pfa_sim_123',
    fulfillmentMethod:
      'DELIVERY',
    shippingName:
      'Cliente Teste',
    shippingEmail:
      'cliente@example.com',
    shippingPhone:
      '912345678',
    shippingAddressLine1:
      'Rua de Teste 1',
    shippingAddressLine2:
      null,
    shippingCity:
      'Porto',
    shippingPostalCode:
      '4000-001',
    shippingCountry:
      'Portugal',
    createdAt,
    items: [
      {
        id: 'item-1',
        productNameAtPurchase:
          'Produto Teste',
        productSkuAtPurchase:
          'SKU-1',
        priceAtPurchase:
          '100.00',
        quantity: 1,
        subtotalAtPurchase: {
          toString: () =>
            '100.00',
        },
      },
    ],
  }
}

describe(
  'listAdminOrders',
  () => {
    test(
      'lista todas as encomendas por data descendente e converte valores monetários',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        const order =
          createOrderRecord()

        findMany.mockResolvedValue([
          order,
        ])

        await expect(
          listAdminOrders(
            client,
          ),
        ).resolves.toEqual([
          {
            id: 'order-1',
            orderNumber:
              'PFA-ABC123',
            subtotal:
              '100.00',
            shippingCost:
              '5.00',
            tax: '23',
            total:
              '128.00',
            status:
              'PROCESSING',
            paymentStatus:
              'PAID',
            paymentMethod:
              'INSTALLMENTS',
            installmentCount: 3,
            paymentProvider:
              'PFA_SIMULATED',
            paymentReference:
              'pfa_sim_123',
            fulfillmentMethod:
              'DELIVERY',
            shippingName:
              'Cliente Teste',
            shippingEmail:
              'cliente@example.com',
            shippingPhone:
              '912345678',
            shippingAddressLine1:
              'Rua de Teste 1',
            shippingAddressLine2:
              null,
            shippingCity:
              'Porto',
            shippingPostalCode:
              '4000-001',
            shippingCountry:
              'Portugal',
            createdAt:
              order.createdAt,
            items: [
              {
                id: 'item-1',
                productNameAtPurchase:
                  'Produto Teste',
                productSkuAtPurchase:
                  'SKU-1',
                priceAtPurchase:
                  '100.00',
                quantity: 1,
                subtotalAtPurchase:
                  '100.00',
              },
            ],
          },
        ])

        expect(
          findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              createdAt:
                'desc',
            },
            select:
              expect.objectContaining({
                id: true,
                orderNumber: true,
                paymentStatus:
                  true,
                paymentMethod:
                  true,
                paymentReference:
                  true,
                fulfillmentMethod:
                  true,
                items:
                  expect.any(
                    Object,
                  ),
              }),
          }),
        )
      },
    )

    test(
      'devolve lista vazia quando não existem encomendas',
      async () => {
        const {
          client,
          findMany,
        } = createClient()

        findMany.mockResolvedValue(
          [],
        )

        await expect(
          listAdminOrders(
            client,
          ),
        ).resolves.toEqual([])
      },
    )
  },
)

describe(
  'getAdminOrderById',
  () => {
    test(
      'devolve ficha detalhada com destino, artigos e dados comerciais históricos',
      async () => {
        const {
          client,
          findUnique,
        } = createClient()

        const order =
          createOrderRecord()

        const updatedAt =
          new Date(
            '2026-09-14T01:00:00.000Z',
          )

        findUnique.mockResolvedValue({
          ...order,
          updatedAt,
          shippingRegion:
            'PORTUGAL_MAINLAND',
          shippingClassApplied:
            'STANDARD',
          taxRatePercent: {
            toString: () =>
              '23.00',
          },
          pricesIncludeTax:
            true,
          nonVolumousSubtotal:
            '100.00',
          nonVolumousShippingCost:
            '5.00',
          bulkyShippingCost:
            null,
          freeShippingThreshold:
            '150.00',
          freeShippingApplied:
            false,
          items: [
            {
              ...order.items[0],
              productId:
                'product-1',
              shippingClassAtPurchase:
                'STANDARD',
              shippingCostAtPurchase:
                '5.00',
            },
          ],
        })

        await expect(
          getAdminOrderById(
            ' order-1 ',
            client,
          ),
        ).resolves.toEqual(
          expect.objectContaining({
            id: 'order-1',
            orderNumber:
              'PFA-ABC123',
            shippingRegion:
              'PORTUGAL_MAINLAND',
            shippingClassApplied:
              'STANDARD',
            taxRatePercent:
              '23.00',
            pricesIncludeTax:
              true,
            freeShippingThreshold:
              '150.00',
            freeShippingApplied:
              false,
            updatedAt,
            items: [
              expect.objectContaining({
                id: 'item-1',
                productId:
                  'product-1',
                productNameAtPurchase:
                  'Produto Teste',
                productSkuAtPurchase:
                  'SKU-1',
                priceAtPurchase:
                  '100.00',
                quantity: 1,
                subtotalAtPurchase:
                  '100.00',
                shippingClassAtPurchase:
                  'STANDARD',
                shippingCostAtPurchase:
                  '5.00',
              }),
            ],
          }),
        )

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
          },
          select:
            expect.objectContaining({
              shippingRegion:
                true,
              shippingClassApplied:
                true,
              taxRatePercent:
                true,
              updatedAt: true,
              items:
                expect.objectContaining({
                  select:
                    expect.objectContaining({
                      productId:
                        true,
                      priceAtPurchase:
                        true,
                      shippingClassAtPurchase:
                        true,
                      shippingCostAtPurchase:
                        true,
                    }),
                }),
            }),
        })
      },
    )

    test(
      'devolve null para identificador vazio sem consultar a base de dados',
      async () => {
        const {
          client,
          findUnique,
        } = createClient()

        await expect(
          getAdminOrderById(
            '   ',
            client,
          ),
        ).resolves.toBeNull()

        expect(
          findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve null quando a encomenda não existe',
      async () => {
        const {
          client,
          findUnique,
        } = createClient()

        findUnique.mockResolvedValue(
          null,
        )

        await expect(
          getAdminOrderById(
            'order-404',
            client,
          ),
        ).resolves.toBeNull()
      },
    )
  },
)
