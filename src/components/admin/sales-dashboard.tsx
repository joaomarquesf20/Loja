import Link from 'next/link'

import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/storefront/order-status-badge'
import type { MonthPoint, SalesOverview } from '@/server/analytics'

type MetricCardProps = {
  label: string
  value: string
  hint: string
}

function formatMoney(
  value: string,
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
    },
  ).format(Number(value))
}

function formatDate(
  value: Date,
) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      dateStyle: 'medium',
      timeZone: 'Europe/Lisbon',
    },
  ).format(value)
}

function formatMonthLabel(
  month: string,
) {
  const [year, monthIndex] =
    month.split('-')

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      month: 'short',
      year: 'numeric',
    },
  ).format(
    new Date(
      Number(year),
      Number(monthIndex) - 1,
      1,
    ),
  )
}

function MetricCard({
  label,
  value,
  hint,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#687078]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-sm text-[#687078]">
        {hint}
      </p>
    </div>
  )
}

function TrendCard(
  {
    months,
  }: {
    months: MonthPoint[]
  },
) {
  const maxRevenue = Math.max(
    ...months.map((point) =>
      Number(point.revenue),
    ),
  )

  return (
    <div className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#17181c]">
        Tendência mensal
        (últimos 6 meses)
      </h3>

      <ul className="mt-4 space-y-3">
        {months.map(
          (point) => (
            <li
              key={point.month}
              className="flex items-center gap-3"
            >
              <span className="w-20 shrink-0 text-xs text-[#687078]">
                {formatMonthLabel(
                  point.month,
                )}
              </span>
              <span
                aria-hidden
                className="flex h-2 flex-1 overflow-hidden rounded-full bg-neutral-100"
              >
                <span
                  className="rounded-full bg-[#ef5b2a]"
                  style={{
                    width: `${
                      maxRevenue > 0
                        ? Math.max(
                            2,
                            Math.round(
                              (Number(
                                point.revenue,
                              ) /
                                maxRevenue) *
                                100,
                            ),
                          )
                        : 2
                    }%`,
                  }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-xs font-bold tabular-nums">
                {formatMoney(
                  point.revenue,
                )}
              </span>
              <span className="w-24 shrink-0 text-right text-xs text-[#687078] tabular-nums">
                {point.orders}{' '}
                {point.orders === 1
                  ? 'enc.'
                  : 'enc.'}
              </span>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

export default function SalesDashboard(
  {
    overview,
  }: {
    overview: SalesOverview
  },
) {
  const hasOrders =
    overview.totalOrders > 0

  return (
    <section
      aria-label="Resumo de vendas"
      className="space-y-5"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Faturação total"
          value={formatMoney(
            overview.revenue,
          )}
          hint={`Encomendas pagas: ${overview.paidOrders}`}
        />

        <MetricCard
          label="Valor médio"
          value={formatMoney(
            overview.averageOrderValue,
          )}
          hint="Por encomenda paga"
        />

        <MetricCard
          label="Encomendas"
          value={String(
            overview.totalOrders,
          )}
          hint={`Pendentes: ${overview.pendingOrders}`}
        />

        <MetricCard
          label="Produtos ativos"
          value={String(
            overview.activeProducts,
          )}
          hint="Visíveis na loja"
        />

        <MetricCard
          label="Últimos 30 dias"
          value={formatMoney(
            overview.last30Days.revenue,
          )}
          hint={`${overview.last30Days.orders} encomendas · média ${formatMoney(
            overview.last30Days.averageOrderValue,
          )}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#17181c]">
            Estado da encomenda
          </h3>

          {overview.ordersByStatus.length ===
          0 ? (
            <p className="mt-4 text-sm text-[#687078]">
              Sem encomendas
              registadas.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {overview.ordersByStatus.map(
                (row) => (
                  <li
                    key={row.status}
                    className="flex items-center justify-between gap-3"
                  >
                    <OrderStatusBadge
                      status={
                        row.status
                      }
                    />
                    <span className="text-sm font-bold tabular-nums">
                      {row.count}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#17181c]">
            Estado do pagamento
          </h3>

          {overview.ordersByPaymentStatus.length ===
          0 ? (
            <p className="mt-4 text-sm text-[#687078]">
              Sem encomendas
              registadas.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {overview.ordersByPaymentStatus.map(
                (row) => (
                  <li
                    key={
                      row.paymentStatus
                    }
                    className="flex items-center justify-between gap-3"
                  >
                    <PaymentStatusBadge
                      status={
                        row.paymentStatus
                      }
                    />
                    <span className="text-sm font-bold tabular-nums">
                      {row.count}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#17181c]">
            Mais vendidos
          </h3>

          {overview.topProducts.length ===
          0 ? (
            <p className="mt-4 text-sm text-[#687078]">
              Sem produtos
              vendidos.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {overview.topProducts.map(
                (
                  product,
                  index,
                ) => (
                  <li
                    key={
                      product.productVariantId
                    }
                    className="flex items-start justify-between gap-3 rounded-lg bg-neutral-50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        {index + 1}.{' '}
                        {
                          product.productName
                        }
                      </p>
                      <p className="mt-1 truncate text-xs text-[#687078]">
                        SKU:{' '}
                        {
                          product.productSku
                        }
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-[#e15a1f]">
                        {formatMoney(
                          product.revenue,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[#687078]">
                        {
                          product.quantity
                        }{' '}
                        un.
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
        </div>

        <div className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#17181c]">
              Últimas encomendas
            </h3>

            <Link
              href="/admin/orders"
              className="text-xs font-bold text-[#ef5b2a] hover:underline"
            >
              Ver todas →
            </Link>
          </div>

          {overview.recentOrders.length ===
          0 ? (
            <p className="mt-4 text-sm text-[#687078]">
              Sem encomendas
              recentes.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {overview.recentOrders.map(
                (order) => (
                  <li key={order.id}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg p-3 transition hover:bg-neutral-50 border border-transparent hover:border-black/10"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {
                            order.orderNumber
                          }
                        </p>
                        <p className="mt-1 truncate text-xs text-[#687078]">
                          {
                            order.customerName
                          }{' '}
                          ·{' '}
                          {formatDate(
                            order.createdAt,
                          )}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <OrderStatusBadge
                            status={
                              order.status
                            }
                          />
                          <PaymentStatusBadge
                            status={
                              order.paymentStatus
                            }
                          />
                        </div>
                      </div>

                      <span className="shrink-0 text-sm font-black tabular-nums">
                        {formatMoney(
                          order.total,
                        )}
                      </span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </div>

      {hasOrders ? null : (
        <p className="rounded-xl border border-dashed bg-white p-5 text-sm text-[#687078]">
          A loja ainda não tem
          encomendas registadas —
          as métricas acima
          atualizam-se à medida
          que os clientes compram.
        </p>
      )}

      <TrendCard
        months={overview.monthlyTrend}
      />
    </section>
  )
}
