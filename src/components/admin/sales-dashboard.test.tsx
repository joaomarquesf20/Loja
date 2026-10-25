import { render, screen } from '@testing-library/react'
import {
  describe,
  expect,
  test,
} from 'vitest'

import SalesDashboard from './sales-dashboard'
import type { SalesOverview } from '@/server/analytics'

function createOverview(
  overrides: Partial<SalesOverview> = {},
): SalesOverview {
  return {
    revenue: '330.00',
    paidOrders: 2,
    totalOrders: 7,
    averageOrderValue:
      '165.00',
    pendingOrders: 3,
    activeProducts: 12,
    ordersByStatus: [
      {
        status: 'PENDING',
        count: 3,
      },
      {
        status: 'CONFIRMED',
        count: 2,
      },
      {
        status: 'SHIPPED',
        count: 1,
      },
      {
        status: 'CANCELLED',
        count: 1,
      },
    ],
    ordersByPaymentStatus: [
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
    ],
    topProducts: [
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
    ],
    recentOrders: [
      {
        id: 'order-9',
        orderNumber:
          'PFA-XYZ789',
        status: 'PROCESSING',
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
        status: 'PENDING',
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
    ],
    last30Days: {
      revenue: '180.00',
      orders: 2,
      averageOrderValue:
        '90.00',
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
    ],
    ...overrides,
  }
}

describe(
  'SalesDashboard',
  () => {
    test(
      'apresenta os cartões métricos executivos',
      () => {
        render(
          <SalesDashboard
            overview={createOverview()}
          />,
        )

        expect(
          screen.getByText(
            'Faturação total',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /^330,00/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Encomendas pagas: 2',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Valor médio',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /^165,00/,
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Encomendas',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Pendentes: 3',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Produtos ativos',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /^12$/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Visíveis na loja',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Últimos 30 dias',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /^180,00/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /^90,00/,
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'apresenta a distribuição por estado com as etiquetas partilhadas',
      () => {
        render(
          <SalesDashboard
            overview={createOverview()}
          />,
        )

        const confirmed =
          screen.getByText(
            'Confirmada',
          )

        expect(
          confirmed.closest(
            '[data-variant]',
          ),
        ).toHaveAttribute(
          'data-variant',
          'info',
        )

        expect(
          screen.getByText(
            'Expedida',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Cancelada',
          ),
        ).toBeInTheDocument()

        const paidBadges =
          screen.getAllByText(
            'Pago',
          )

        expect(
          paidBadges,
        ).toHaveLength(2)

        expect(
          paidBadges[0]!.closest(
            '[data-variant]',
          ),
        ).toHaveAttribute(
          'data-variant',
          'success',
        )

        const failed =
          screen.getByText(
            'Falhado',
          )

        expect(
          failed.closest(
            '[data-variant]',
          ),
        ).toHaveAttribute(
          'data-variant',
          'danger',
        )

        expect(
          screen.getAllByText(
            'Pendente',
          ),
        ).toHaveLength(4)
      },
    )

    test(
      'apresenta os produtos mais vendidos por volume e receita',
      () => {
        render(
          <SalesDashboard
            overview={createOverview()}
          />,
        )

        expect(
          screen.getByText(
            'Mais vendidos',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '1. Filtro de óleo',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'SKU: FLT-001',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /^90,00/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            '4 un.',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '2. Pastilhas de travão',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'SKU: PST-002',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /^60,00/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            '2 un.',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'liga as últimas encomendas ao detalhe admin',
      () => {
        render(
          <SalesDashboard
            overview={createOverview()}
          />,
        )

        const recentName =
          screen.getByRole(
            'link',
            {
              name:
                /PFA-XYZ789/,
            },
          )

        expect(
          recentName.getAttribute(
            'href',
          ),
        ).toBe(
          '/admin/orders/order-9',
        )

        expect(
          screen.getByText(
            'Ana Costa · 21/10/2026',
          ),
        ).toBeInTheDocument()

        const olderOrder =
          screen.getByRole(
            'link',
            {
              name:
                /PFA-XYZ000/,
            },
          )

        expect(
          olderOrder.getAttribute(
            'href',
          ),
        ).toBe(
          '/admin/orders/order-8',
        )

        expect(
          screen.getByText(
            'Ver todas →',
          ).getAttribute(
            'href',
          ),
        ).toBe('/admin/orders')
      },
    )

    test(
      'apresenta a tendência mensal dos últimos 6 meses',
      () => {
        render(
          <SalesDashboard
            overview={createOverview()}
          />,
        )

        expect(
          screen.getByText(
            'Tendência mensal (últimos 6 meses)',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            /^200,00/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /^120,00/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getAllByText(
            '0 enc.',
          ),
        ).toHaveLength(3)
      },
    )

    test(
      'mostra mensagens de vazio numa loja sem encomendas',
      () => {
        render(
          <SalesDashboard
            overview={createOverview(
              {
                totalOrders: 0,
                pendingOrders: 0,
                paidOrders: 0,
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
              },
            )}
          />,
        )

        expect(
          screen.getAllByText(
            'Sem encomendas registadas.',
          ),
        ).toHaveLength(2)
        expect(
          screen.getByText(
            'Sem produtos vendidos.',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Sem encomendas recentes.',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /A loja ainda não tem encomendas registadas/,
          ),
        ).toBeInTheDocument()
      },
    )
  },
)
