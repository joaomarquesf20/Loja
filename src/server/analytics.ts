import { prisma } from './db'

/**
 * Analytics do painel admin: métricas de vendas calculadas na base de
 * dados (encomendas pagas, estados, produtos mais vendidos, últimos
 * 30 dias e tendência mensal).
 *
 * Convenções:
 * - "Faturação" considera apenas encomendas com `paymentStatus = PAID`
 *   e `status != CANCELLED` (dinheiro devolvido deixa de ser faturação).
 * - O número de encomendas (AOV) divide a faturação pelo número de
 *   encomendas que contribuíram para ela.
 * - Valores monetários saem como strings decimais (mesmo formato dos
 *   serviços `orders`).
 */

type MoneyValue =
  | string
  | number
  | {
      toString(): string
    }

type PaidOrderWhere = {
  paymentStatus: 'PAID'
  status: { not: 'CANCELLED' }
  createdAt?: { gte: Date }
}

export type StatusCount = {
  status: string
  count: number
}

export type PaymentStatusCount =
  {
    paymentStatus: string
    count: number
  }

export type TopProduct =
  {
    productVariantId: string
    productName: string
    productSku: string
    quantity: number
    revenue: string
  }

export type RecentOrder =
  {
    id: string
    orderNumber: string
    status: string
    paymentStatus: string
    total: string
    createdAt: Date
    customerName: string
    customerEmail: string
  }

export type MonthPoint = {
  /** Mês no formato `YYYY-MM` (UTC), ex.: `2026-10`. */
  month: string
  revenue: string
  orders: number
}

export type SalesOverview =
  {
    revenue: string
    paidOrders: number
    totalOrders: number
    averageOrderValue: string
    pendingOrders: number
    ordersByStatus: StatusCount[]
    ordersByPaymentStatus: PaymentStatusCount[]
    topProducts: TopProduct[]
    recentOrders: RecentOrder[]
    last30Days:
      {
        revenue: string
        orders: number
        averageOrderValue: string
      }
    monthlyTrend: MonthPoint[]
  }

type OrderGroupRow =
  {
    status?: string
    paymentStatus?: string
    _count: { _all: number }
  }

type TrendRow = {
  total: MoneyValue
  createdAt: Date
}

type RecentOrderRow = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  total: MoneyValue
  createdAt: Date
  shippingName: string
  shippingEmail: string
}

type TopProductRow =
  {
    productVariantId: string
    productNameAtPurchase: string
    productSkuAtPurchase: string
    _sum:
      {
        quantity: number | null
        subtotalAtPurchase:
          | MoneyValue
          | null
      }
  }

/**
 * Cliente Prisma mínimo: os doubles em teste implementam esta
 * interface em vez de o prisma global ser fixado.
 */
export interface AnalyticsClient {
  order: {
    aggregate(args: {
      where: PaidOrderWhere
      _sum: { total: true }
      _count: { _all: true }
    }): Promise<{
      _sum: {
        total: MoneyValue | null
      }
      _count: number
    }>
    groupBy(
      args: {
        by: ['status']
        _count: { _all: true }
      },
    ): Promise<
      OrderGroupRow[]
    >
    groupBy(
      args: {
        by: ['paymentStatus']
        _count: { _all: true }
      },
    ): Promise<
      OrderGroupRow[]
    >
    findMany(
      args: {
        where: PaidOrderWhere & {
          createdAt: { gte: Date }
        }
        select: {
          total: true
          createdAt: true
        }
      },
    ): Promise<TrendRow[]>
    findMany(
      args: {
        orderBy: {
          createdAt: 'desc'
        }
        take: number
        select: {
          id: true
          orderNumber: true
          status: true
          paymentStatus: true
          total: true
          createdAt: true
          shippingName: true
          shippingEmail: true
        }
      },
    ): Promise<RecentOrderRow[]>
  }
  /**
   * Top produtos: os campos productVariantId/
   * productNameAtPurchase/productSkuAtPurchase vivem nas linhas de
   * encomenda (OrderItem), não em Order — agrupar por eles em
   * db.order dispara PrismaClientValidationError em runtime
   * ("Invalid db.order.groupBy() invocation") e derruba o /admin.
   */
  orderItem: {
    groupBy(
      args: {
        by: [
          'productVariantId',
          'productNameAtPurchase',
          'productSkuAtPurchase',
        ]
        where: {
          order: {
            paymentStatus: 'PAID'
            status: {
              not: 'CANCELLED'
            }
          }
        }
        _sum: {
          quantity: true
          subtotalAtPurchase: true
        }
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        }
        take: number
      },
    ): Promise<TopProductRow[]>
  }
}

function getClient(
  client?: AnalyticsClient,
): AnalyticsClient {
  return (
    client ??
    (prisma as unknown as AnalyticsClient)
  )
}

function decimalToString(
  value: MoneyValue | null,
) {
  if (value === null) {
    return '0.00'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return value.toString()
}

function toCount(
  value: number | null,
) {
  return value ?? 0
}

const THIRTY_DAYS_MS =
  30 * 24 * 60 * 60 * 1000

const TREND_MONTHS = 6

/** Primeiro instante (UTC) do mês N meses antes de `now` (0 = atual). */
function startOfUtcMonth(
  now: Date,
  monthsBack: number,
) {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() -
        monthsBack,
      1,
    ),
  )
}

function monthKey(
  date: Date,
) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, '0')}`
}

function averageOrderValue(
  revenue: number,
  orders: number,
) {
  if (orders <= 0) {
    return '0.00'
  }

  return (revenue / orders).toFixed(
    2,
  )
}

export async function getSalesOverview(
  options?: {
    client?: AnalyticsClient
    /** Data de referência (testes); por defeito, agora. */
    now?: Date
  },
): Promise<SalesOverview> {
  const db = getClient(
    options?.client,
  )

  const now =
    options?.now ?? new Date()

  const cutoff30Days = new Date(
    now.getTime() - THIRTY_DAYS_MS,
  )
  const trendWindowStart =
    startOfUtcMonth(now, TREND_MONTHS - 1)

  const [
    revenueAggregate,
    statusGroups,
    paymentStatusGroups,
    topProductRows,
    trendRows,
    recentOrderRows,
  ] =
    await Promise.all([
      db.order.aggregate({
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
      }),
      db.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      db.order.groupBy({
        by: ['paymentStatus'],
        _count: { _all: true },
      }),
      db.orderItem.groupBy({
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
      }),
      db.order.findMany({
        where: {
          paymentStatus:
            'PAID',
          status: {
            not: 'CANCELLED',
          },
          createdAt: {
            gte: trendWindowStart,
          },
        },
        select: {
          total: true,
          createdAt: true,
        },
      }),
      db.order.findMany({
        orderBy:
          { createdAt: 'desc' },
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
      }),
    ])

  const totalOrders =
    statusGroups.reduce(
      (sum, row) =>
        sum + toCount(row._count._all),
      0,
    )

  const ordersByStatus =
    statusGroups
      .map((row) => ({
        status:
          row.status ?? '',
        count: toCount(
          row._count._all,
        ),
      }))
      .sort(
        (a, b) => b.count - a.count,
      )

  const ordersByPaymentStatus =
    paymentStatusGroups
      .map((row) => ({
        paymentStatus:
          row.paymentStatus ??
          '',
        count: toCount(
          row._count._all,
        ),
      }))
      .sort(
        (a, b) => b.count - a.count,
      )

  const pendingOrders =
    toCount(
      ordersByStatus.find(
        (row) =>
          row.status === 'PENDING',
      )?.count ?? 0,
    )

  const revenue = decimalToString(
    revenueAggregate._sum.total ?? null,
  )

  const paidOrders = toCount(
    revenueAggregate._count,
  )

  const soldInWindow = trendRows.filter(
    (row) =>
      row.createdAt.getTime() >=
      cutoff30Days.getTime(),
  )

  const revenue30 =
    soldInWindow.reduce(
      (sum, row) =>
        sum +
        Number(
          decimalToString(row.total),
        ),
      0,
    )

  const monthPoints = new Map<
    string,
    MonthPoint
  >()

  for (
    let back =
      TREND_MONTHS - 1;
    back >= 0;
    back -= 1
  ) {
    const monthStart =
      startOfUtcMonth(now, back)

    monthPoints.set(
      monthKey(monthStart),
      {
        month: monthKey(monthStart),
        revenue: '0.00',
        orders: 0,
      },
    )
  }

  for (const row of trendRows) {
    const key = monthKey(
      row.createdAt,
    )

    const point =
      monthPoints.get(key)

    if (!point) {
      continue
    }

    point.revenue = (
      Number(point.revenue) +
      Number(decimalToString(row.total))
    ).toFixed(2)

    point.orders += 1
  }

  const topProducts = topProductRows.map(
    (row) => ({
      productVariantId:
        row.productVariantId,
      productName:
        row.productNameAtPurchase,
      productSku:
        row.productSkuAtPurchase,
      quantity: toCount(
        row._sum.quantity ?? null,
      ),
      revenue: decimalToString(
        row._sum.subtotalAtPurchase ??
          null,
      ),
    }),
  )

  return {
    revenue,
    paidOrders,
    totalOrders,
    averageOrderValue:
      averageOrderValue(
        Number(revenue),
        paidOrders,
      ),
    pendingOrders,
    ordersByStatus,
    ordersByPaymentStatus,
    topProducts,
    recentOrders:
      recentOrderRows.map(
        (row) => ({
          id: row.id,
          orderNumber:
            row.orderNumber,
          status: row.status,
          paymentStatus:
            row.paymentStatus,
          total: decimalToString(
            row.total,
          ),
          createdAt:
            row.createdAt,
          customerName:
            row.shippingName,
          customerEmail:
            row.shippingEmail,
        }),
      ),
    last30Days: {
      revenue:
        revenue30.toFixed(2),
      orders:
        soldInWindow.length,
      averageOrderValue:
        averageOrderValue(
          revenue30,
          soldInWindow.length,
        ),
    },
    monthlyTrend: Array.from(
      monthPoints.values(),
    ),
  }
}
