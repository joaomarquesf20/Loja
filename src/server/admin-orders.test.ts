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
  listAdminOrders,
  type AdminOrderClient,
} from './admin-orders'

function createClient() {
  const findMany = vi.fn()

  return {
    client: {
      order: {
        findMany,
      },
    } as unknown as AdminOrderClient,
    findMany,
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

        const createdAt =
          new Date(
            '2026-09-14T00:00:00.000Z',
          )

        findMany.mockResolvedValue([
          {
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
          },
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
