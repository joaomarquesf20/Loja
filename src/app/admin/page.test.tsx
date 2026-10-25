import { render, screen } from '@testing-library/react'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    getServerSession:
      vi.fn(),
    redirect: vi.fn(
      () => {
        throw new Error(
          'NEXT_REDIRECT',
        )
      },
    ),
    notFound: vi.fn(
      () => {
        throw new Error(
          'NEXT_NOT_FOUND',
        )
      },
    ),
    getSalesOverview:
      vi.fn(),
    listLowStockVariants:
      vi.fn(),
  }),
)

vi.mock(
  'next-auth',
  () => ({
    getServerSession:
      mocks.getServerSession,
  }),
)

vi.mock(
  'next/navigation',
  () => ({
    redirect: mocks.redirect,
    notFound: mocks.notFound,
  }),
)

vi.mock(
  '@/server/auth',
  () => ({
    authOptions: {},
  }),
)

vi.mock(
  '@/server/analytics',
  () => ({
    getSalesOverview:
      mocks.getSalesOverview,
  }),
)

vi.mock(
  '@/server/inventory',
  () => ({
    DEFAULT_LOW_STOCK_THRESHOLD:
      5,
    listLowStockVariants:
      mocks.listLowStockVariants,
  }),
)

import AdminPage from './page'

function adminSession() {
  return {
    user: { role: 'ADMIN' },
  }
}

function overviewStub() {
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
    ],
    ordersByPaymentStatus: [
      {
        paymentStatus:
          'PAID',
        count: 2,
      },
    ],
    topProducts: [],
    recentOrders: [
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
    ],
    last30Days: {
      revenue: '180.00',
      orders: 2,
      averageOrderValue:
        '90.00',
    },
    monthlyTrend: [],
  }
}

describe(
  'AdminPage',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.listLowStockVariants.mockResolvedValue(
        [],
      )
    })

    test(
      'apresenta o resumo de vendas e as áreas de administração',
      async () => {
        mocks.getServerSession.mockResolvedValueOnce(
          adminSession(),
        )
        mocks.getSalesOverview.mockResolvedValueOnce(
          overviewStub(),
        )

        render(
          await AdminPage(),
        )

        expect(
          mocks.getSalesOverview,
        ).toHaveBeenCalledTimes(
          1,
        )

        expect(
          mocks.listLowStockVariants,
        ).toHaveBeenCalledTimes(
          1,
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
            'Produtos ativos',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Alertas de ruptura',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Sem variantes com stock baixo.',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            'link',
            {
              name:
                /PFA-XYZ789/,
            },
          ).getAttribute(
            'href',
          ),
        ).toBe(
          '/admin/orders/order-9',
        )

        expect(
          screen.getByRole(
            'link',
            {
              name:
                /Gerir produtos/,
            },
          ).getAttribute(
            'href',
          ),
        ).toBe(
          '/admin/products',
        )
      },
    )

    test(
      'apresenta o widget de alertas de ruptura com as variantes críticas',
      async () => {
        mocks.getServerSession.mockResolvedValueOnce(
          adminSession(),
        )
        mocks.getSalesOverview.mockResolvedValueOnce(
          overviewStub(),
        )
        mocks.listLowStockVariants.mockResolvedValueOnce(
          [
            {
              variantId:
                'variant-1',
              sku: 'FLT-001',
              stock: 2,
              productId:
                'product-1',
              productName:
                'Filtro de óleo',
              productSlug:
                'filtro-de-oleo',
            },
          ],
        )

        render(
          await AdminPage(),
        )

        expect(
          mocks.listLowStockVariants,
        ).toHaveBeenCalledWith()

        expect(
          screen.getByText(
            'Filtro de óleo',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'FLT-001',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByLabelText(
            'Guardar stock de FLT-001',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'redireciona para o login quando não há sessão',
      async () => {
        mocks.getServerSession.mockResolvedValueOnce(
          null,
        )

        await expect(
          AdminPage(),
        ).rejects.toThrow(
          'NEXT_REDIRECT',
        )

        expect(
          mocks.redirect,
        ).toHaveBeenCalledWith(
          '/login',
        )
      },
    )

    test(
      'devolve notFound para utilizadores sem perfil admin',
      async () => {
        mocks.getServerSession.mockResolvedValueOnce(
          {
            user: { role: 'USER' },
          },
        )

        await expect(
          AdminPage(),
        ).rejects.toThrow(
          'NEXT_NOT_FOUND',
        )

        expect(
          mocks.notFound,
        ).toHaveBeenCalledTimes(
          1,
        )
        expect(
          mocks.redirect,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
