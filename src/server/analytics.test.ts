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
  AnalyticsClient,
  getSalesOverview,
} from './analytics'

function decimal(
  value: string,
) {
  return {
    toString: () => value,
  }
}

type AnalyticsFixtures =
  {
    revenueAggregate?: {
      _sum: {
        total: unknown
      }
      _count: number
    }
    statusGroups?: Array<{
      status?: string
      _count: { _all: number }
    }>
    paymentStatusGroups?: Array<{
      paymentStatus?: string
      _count: { _all: number }
    }>
    topProducts?: Array<{
      productVariantId: string
      productNameAtPurchase: string
      productSkuAtPurchase: string
      _sum: {
        quantity: number | null
        subtotalAtPurchase: unknown
      }
    }>
    trendRows?: Array<{
      total: unknown
      createdAt: Date
    }>
    recentOrders?: Array<{
      id: string
      orderNumber: string
      status: string
      paymentStatus: string
      total: unknown
      createdAt: Date
      shippingName: string
      shippingEmail: string
    }>
  }

function createAnalyticsClient(
  fixtures: AnalyticsFixtures = {},
) {
  const client = {
    order: {
      aggregate: vi.fn<
        (
          args: unknown,
        ) => Promise<{
          _sum: {
            total: unknown
          }
          _count: number
        }>
      >(
        async () =>
          fixtures.revenueAggregate ?? {
            _sum: { total: null },
            _count: 0,
          },
      ),
      groupBy: vi.fn(
        async (args: {
          by: string[]
        }) => {
          if (
            args.by.length === 3
          ) {
            return (
              fixtures.topProducts ??
              []
            )
          }

          if (
            args.by[
              0
            ] === 'status'
          ) {
            return (
              fixtures.statusGroups ??
              []
            )
          }

          return (
            fixtures.paymentStatusGroups ??
            []
          )
        },
      ),
      findMany: vi.fn(
        async (args: {
          select: Record<
            string,
            unknown
          >
        }) => {
          if (
            'id' in args.select
          ) {
            return (
              fixtures.recentOrders ??
              []
            )
          }

          return (
            fixtures.trendRows ?? []
          )
        },
      ),
    },
  }

  return {
    client:
      client as unknown as AnalyticsClient,
    aggregate:
      client.order
        .aggregate,
    groupBy:
      client.order.groupBy,
    findMany:
      client.order.findMany,
  }
}

describe(
  'getSalesOverview',
  () => {
    test(
      'devolve zeros em base de dados vazia',
      async () => {
        const {
          client,
        } =
          createAnalyticsClient()

        const overview =
          await getSalesOverview(
            {
              client,
              now: new Date(
                '2026-10-22T12:00:00.000Z',
              ),
            },
          )

        expect(
          overview,
        ).toEqual({
          revenue: '0.00',
          paidOrders: 0,
          totalOrders: 0,
          averageOrderValue:
            '0.00',
          pendingOrders: 0,
          ordersByStatus: [],
          ordersByPaymentStatus:
            [],
          topProducts: [],
          recentOrders: [],
          last30Days: {
            revenue: '0.00',
            orders: 0,
            averageOrderValue:
              '0.00',
          },
          monthlyTrend: [
            {
              month: '2026-05',
              revenue: '0.00',
              orders: 0,
            },
            {
              month: '2026-06',
              revenue: '0.00',
              orders: 0,
            },
            {
              month: '2026-07',
              revenue: '0.00',
              orders: 0,
            },
            {
              month: '2026-08',
              revenue: '0.00',
              orders: 0,
            },
            {
              month: '2026-09',
              revenue: '0.00',
              orders: 0,
            },
            {
              month: '2026-10',
              revenue: '0.00',
              orders: 0,
            },
          ],
        })
      },
    )

    test(
      'calcula faturação, AOV e pendentes com estados mistos',
      async () => {
        const {
          client,
        } =
          createAnalyticsClient(
            {
              revenueAggregate:
                {
                  _sum: {
                    total: decimal(
                      '330.00',
                    ),
                  },
                  _count: 2,
                },
              statusGroups: [
                {
                  status:
                    'PENDING',
                  _count: {
                    _all: 3,
                  },
                },
                {
                  status:
                    'CONFIRMED',
                  _count: {
                    _all: 2,
                  },
                },
                {
                  status:
                    'SHIPPED',
                  _count: {
                    _all: 1,
                  },
                },
                {
                  status:
                    'CANCELLED',
                  _count: {
                    _all: 1,
                  },
                },
              ],
              paymentStatusGroups:
                [
                  {
                    paymentStatus:
                      'PAID',
                    _count: {
                      _all: 5,
                    },
                  },
                  {
                    paymentStatus:
                      'PENDING',
                    _count: {
                      _all: 1,
                    },
                  },
                  {
                    paymentStatus:
                      'FAILED',
                    _count: {
                      _all: 1,
                    },
                  },
                ],
              topProducts: [
                {
                  productVariantId:
                    'v-1',
                  productNameAtPurchase:
                    'Filtro de óleo',
                  productSkuAtPurchase:
                    'FLT-001',
                  _sum: {
                    quantity: 4,
                    subtotalAtPurchase:
                      decimal(
                        '90.00',
                      ),
                  },
                },
                {
                  productVariantId:
                    'v-2',
                  productNameAtPurchase:
                    'Pastilhas de travão',
                  productSkuAtPurchase:
                    'PST-002',
                  _sum: {
                    quantity: 2,
                    subtotalAtPurchase:
                      decimal(
                        '60.00',
                      ),
                  },
                },
              ],
            },
          )

        const overview =
          await getSalesOverview(
            {
              client,
              now: new Date(
                '2026-10-22T12:00:00.000Z',
              ),
            },
          )

        expect(
          overview.revenue,
        ).toBe('330.00')
        expect(
          overview.paidOrders,
        ).toBe(2)
        expect(
          overview.averageOrderValue,
        ).toBe('165.00')
        expect(
          overview.totalOrders,
        ).toBe(7)
        expect(
          overview.pendingOrders,
        ).toBe(3)

        expect(
          overview.ordersByStatus,
        ).toEqual([
          {
            status: 'PENDING',
            count: 3,
          },
          {
            status:
              'CONFIRMED',
            count: 2,
          },
          {
            status: 'SHIPPED',
            count: 1,
          },
          {
            status:
              'CANCELLED',
            count: 1,
          },
        ])

        expect(
          overview.ordersByPaymentStatus,
        ).toEqual([
          {
            paymentStatus:
              'PAID',
            count: 5,
          },
          {
            paymentStatus:
              'PENDING',
            count: 1,
          },
          {
            paymentStatus:
              'FAILED',
            count: 1,
          },
        ])

        expect(
          overview.topProducts,
        ).toEqual([
          {
            productVariantId:
              'v-1',
            productName:
              'Filtro de óleo',
            productSku:
              'FLT-001',
            quantity: 4,
            revenue: '90.00',
          },
          {
            productVariantId:
              'v-2',
            productName:
              'Pastilhas de travão',
            productSku:
              'PST-002',
            quantity: 2,
            revenue: '60.00',
          },
        ])
      },
    )

    test(
      'consulta apenas encomendas pagas e não canceladas',
      async () => {
        const {
          client,
          aggregate,
          groupBy,
          findMany,
        } =
          createAnalyticsClient()

        await getSalesOverview(
          {
            client,
            now: new Date(
              '2026-10-22T12:00:00.000Z',
            ),
          },
        )

        expect(
          aggregate,
        ).toHaveBeenCalledTimes(
          1,
        )
        expect(
          aggregate.mock
            .calls[0][0],
        ).toEqual({
          where: {
            paymentStatus:
              'PAID',
            status: {
              not: 'CANCELLED',
            },
          },
          _sum: { total: true },
          _count:
            { _all: true },
        })

        const topProductGroupByCall =
          groupBy.mock.calls
            .map(
              (call) =>
                call[0],
            )
            .find(
              (args) =>
                args.by
                  .length === 3,
            )

        expect(
          topProductGroupByCall,
        ).toEqual({
          by: [
            'productVariantId',
            'productNameAtPurchase',
            'productSkuAtPurchase',
          ],
          where: {
            order: {
              paymentStatus:
                'PAID',
              status: {
                not: 'CANCELLED',
              },
            },
          },
          _sum: {
            quantity: true,
            subtotalAtPurchase:
              true,
          },
          orderBy: {
            _sum: {
              quantity: 'desc',
            },
          },
          take: 5,
        })

        const recentFindManyCall =
          findMany.mock.calls
            .map(
              (call) =>
                call[0],
            )
            .find(
              (args) =>
                'id' in
                args.select,
            )

        expect(
          recentFindManyCall,
        ).toEqual({
          orderBy: {
            createdAt: 'desc',
          },
          take: 8,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            total: true,
            createdAt: true,
            shippingName: true,
            shippingEmail: true,
          },
        })
      },
    )

    test(
      'filtra os últimos 30 dias e agrupa a tendência por mês',
      async () => {
        const {
          client,
          findMany,
        } =
          createAnalyticsClient(
            {
              trendRows: [
                {
                  total: decimal(
                    '120.00',
                  ),
                  createdAt:
                    new Date(
                      '2026-10-10T10:00:00.000Z',
                    ),
                },
                {
                  total: decimal(
                    '60.00',
                  ),
                  createdAt:
                    new Date(
                      '2026-09-25T12:00:01.000Z',
                    ),
                },
                {
                  total: decimal(
                    '50.00',
                  ),
                  createdAt:
                    new Date(
                      '2026-09-01T10:00:00.000Z',
                    ),
                },
                {
                  total: decimal(
                    '200.00',
                  ),
                  createdAt:
                    new Date(
                      '2026-08-15T09:00:00.000Z',
                    ),
                },
              ],
            },
          )

        const overview =
          await getSalesOverview(
            {
              client,
              now: new Date(
                '2026-10-22T12:00:00.000Z',
              ),
            },
          )

        const trendCall =
          findMany.mock.calls
            .map(
              (call) =>
                call[0],
            )
            .find(
              (args) =>
                !('id' in
                  args.select),
            )

        expect(
          trendCall,
        ).toMatchObject({
          where: {
            paymentStatus:
              'PAID',
            status: {
              not: 'CANCELLED',
            },
            createdAt: {
              gte: new Date(
                '2026-05-01T00:00:00.000Z',
              ),
            },
          },
          select: {
            total: true,
            createdAt: true,
          },
        })

        expect(
          overview.last30Days,
        ).toEqual({
          revenue: '180.00',
          orders: 2,
          averageOrderValue:
            '90.00',
        })

        expect(
          overview.monthlyTrend,
        ).toEqual([
          {
            month: '2026-05',
            revenue: '0.00',
            orders: 0,
          },
          {
            month: '2026-06',
            revenue: '0.00',
            orders: 0,
          },
          {
            month: '2026-07',
            revenue: '0.00',
            orders: 0,
          },
          {
            month: '2026-08',
            revenue: '200.00',
            orders: 1,
          },
          {
            month: '2026-09',
            revenue: '110.00',
            orders: 2,
          },
          {
            month: '2026-10',
            revenue: '120.00',
            orders: 1,
          },
        ])
      },
    )
    test(
      'mapeia as últimas encomendas com cliente e valor',
      async () => {
        const {
          client,
        } =
          createAnalyticsClient(
            {
              recentOrders: [
                {
                  id: 'order-9',
                  orderNumber:
                    'PFA-XYZ789',
                  status:
                    'PROCESSING',
                  paymentStatus:
                    'PAID',
                  total: decimal(
                    '59.90',
                  ),
                  createdAt:
                    new Date(
                      '2026-10-21T08:30:00.000Z',
                    ),
                  shippingName:
                    'Ana Costa',
                  shippingEmail:
                    'ana@example.com',
                },
                {
                  id: 'order-8',
                  orderNumber:
                    'PFA-XYZ000',
                  status:
                    'PENDING',
                  paymentStatus:
                    'PENDING',
                  total: decimal(
                    '14.50',
                  ),
                  createdAt:
                    new Date(
                      '2026-10-20T18:00:00.000Z',
                    ),
                  shippingName:
                    'Bruno Dias',
                  shippingEmail:
                    'bruno@example.com',
                },
              ],
            },
          )

        const overview =
          await getSalesOverview(
            {
              client,
              now: new Date(
                '2026-10-22T12:00:00.000Z',
              ),
            },
          )

        expect(
          overview.recentOrders,
        ).toEqual([
          {
            id: 'order-9',
            orderNumber:
              'PFA-XYZ789',
            status:
              'PROCESSING',
            paymentStatus:
              'PAID',
            total: '59.90',
            createdAt:
              new Date(
                '2026-10-21T08:30:00.000Z',
              ),
            customerName:
              'Ana Costa',
            customerEmail:
              'ana@example.com',
          },
          {
            id: 'order-8',
            orderNumber:
              'PFA-XYZ000',
            status:
              'PENDING',
            paymentStatus:
              'PENDING',
            total: '14.50',
            createdAt:
              new Date(
                '2026-10-20T18:00:00.000Z',
              ),
            customerName:
              'Bruno Dias',
            customerEmail:
              'bruno@example.com',
          },
        ])
      },
    )
  },
)
