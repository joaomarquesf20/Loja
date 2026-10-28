import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import CouponsClient from './coupons-client'

import type {
  AdminCouponRow,
  AdminCouponsPage,
} from '@/server/coupons'

const fetchMock = vi.fn()

function createJsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'content-type':
          'application/json',
      },
    },
  )
}

function createCouponRow(
  overrides: Partial<
    AdminCouponRow
  > = {},
): AdminCouponRow {
  return {
    id: 'coupon-1',
    code: 'PROMO10',
    discountType:
      'PERCENTAGE',
    discountValue: 10,
    minOrderValue: null,
    maxUses: null,
    usedCount: 3,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    status: 'ACTIVE',
    ...overrides,
  }
}

function createPage(
  overrides: Partial<
    AdminCouponsPage
  > = {},
): AdminCouponsPage {
  return {
    coupons: [
      createCouponRow(),
      createCouponRow({
        id: 'coupon-2',
        code: 'OLD5',
        discountType:
          'FIXED_AMOUNT',
        discountValue: 5,
        isActive: false,
        status: 'INACTIVE',
        usedCount: 2,
      }),
      createCouponRow({
        id: 'coupon-3',
        code: 'EXPIRED10',
        discountValue: 7,
        expiresAt:
          '2026-10-01T00:00:00.000Z',
        status: 'EXPIRED',
        usedCount: 0,
      }),
    ],
    total: 3,
    page: 1,
    pageSize: 1000,
    totalPages: 1,
    kpis: {
      totalCoupons: 3,
      activeCoupons: 1,
      totalUses: 5,
    },
    ...overrides,
  }
}

function stubList(
  response: unknown,
  status = 200,
  query = 'pageSize=1000',
) {
  fetchMock.mockImplementationOnce(
    async (
      input:
        | RequestInfo
        | URL,
    ) => {
      expect(
        String(input),
      ).toBe(
        `/api/admin/coupons?${query}`,
      )

      return createJsonResponse(
        response,
        status,
      )
    },
  )
}

function kpiCard(
  heading: string,
) {
  return screen
    .getAllByText(
      heading,
    )[0].closest(
    'div',
  )
}

describe(
  'Admin Coupons Client',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      vi.stubGlobal(
        'fetch',
        fetchMock,
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test(
      'apresenta KPIs de topo e a lista de cupões com estados',
      async () => {
        stubList(
          createPage(),
        )

        render(
          <CouponsClient />,
        )

        expect(
          await screen.findByText(
            'Total de cupões',
          ),
        ).toBeInTheDocument()

        expect(
          kpiCard(
            'Total de cupões',
          ),
        ).toHaveTextContent(
          '3',
        )

        expect(
          kpiCard(
            'Ativos',
          ),
        ).toHaveTextContent(
          '1',
        )

        expect(
          kpiCard(
            'Utilizações totais',
          ),
        ).toHaveTextContent(
          '5',
        )

        expect(
          screen.getByText(
            'PROMO10',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '10%',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '5.00 €',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '3 / ilimitado',
          ),
        ).toBeInTheDocument()

        // Badges por estado, dentro da linha respetiva
        // (o <select> de filtro também tem estas opções).
        const promoRow =
          screen.getByText(
            'PROMO10',
          ).closest('tr')

        expect(
          within(
            promoRow as HTMLElement,
          ).getByText('Ativo'),
        ).toBeInTheDocument()

        const oldRow =
          screen.getByText(
            'OLD5',
          ).closest('tr')

        expect(
          within(
            oldRow as HTMLElement,
          ).getByText('Inativo'),
        ).toBeInTheDocument()

        const expiredRow =
          screen.getByText(
            'EXPIRED10',
          ).closest('tr')

        expect(
          within(
            expiredRow as HTMLElement,
          ).getByText(
            'Expirado',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            /3 de 3 cupões/,
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'filtra por estado e termo de pesquisa',
      async () => {
        stubList(
          createPage(),
        )

        render(
          <CouponsClient />,
        )

        await screen.findByText(
          'PROMO10',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Estado',
          ),
          {
            target: {
              value:
                'ACTIVE',
            },
          },
        )

        expect(
          screen.getByText(
            'PROMO10',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'OLD5',
          ),
        ).not.toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Estado',
          ),
          {
            target: {
              value: 'ALL',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Pesquisar por código',
          ),
          {
            target: {
              value:
                'old5',
            },
          },
        )

        expect(
          screen.getByText(
            'OLD5',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'EXPIRED10',
          ),
        ).not.toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Pesquisar por código',
          ),
          {
            target: {
              value:
                'zzz-sem-dados',
            },
          },
        )

        expect(
          screen.getByText(
            'Sem cupões para os filtros aplicados.',
          ),
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Limpar filtros',
            },
          ),
        )

        expect(
          screen.getByText(
            'EXPIRED10',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Sem cupões para os filtros aplicados.',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'pagina a lista com mais de 20 cupões',
      async () => {
        const coupons =
          Array.from(
            { length: 25 },
            (_, index) =>
              createCouponRow({
                id: `coupon-${index + 1}`,
                code: `CODE${String(index + 1).padStart(2, '0')}`,
              }),
          )

        stubList(
          createPage({
            coupons,
            total: 25,
            kpis: {
              totalCoupons:
                25,
              activeCoupons:
                25,
              totalUses:
                0,
            },
          }),
        )

        render(
          <CouponsClient />,
        )

        expect(
          await screen.findByText(
            'CODE01',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'CODE21',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByText(
            'Página 1 de 2',
          ),
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Página seguinte',
            },
          ),
        )

        expect(
          screen.getByText(
            'CODE21',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'CODE01',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'cria cupão e recarrega a vista',
      async () => {
        stubList(
          createPage(),
        )

        fetchMock.mockImplementationOnce(
          async (
            input:
              | RequestInfo
              | URL,
            init?:
              | RequestInit,
          ) => {
            expect(
              String(input),
            ).toBe(
              '/api/admin/coupons',
            )

            expect(
              init?.method,
            ).toBe(
              'POST',
            )

            expect(
              JSON.parse(
                String(
                  init?.body,
                ),
              ) as Record<
                string,
                unknown
              >,
            ).toEqual({
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue:
                10,
              minOrderValue:
                20,
              maxUses: 10,
              startsAt:
                '2026-11-01T00:00:00.000Z',
              expiresAt:
                '2026-11-30T23:59:59.999Z',
            })

            return createJsonResponse(
              createCouponRow(),
            )
          },
        )

        stubList(
          createPage({
            total: 4,
            kpis: {
              totalCoupons:
                4,
              activeCoupons:
                2,
              totalUses:
                5,
            },
          }),
        )

        render(
          <CouponsClient />,
        )

        await screen.findByText(
          'PROMO10',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Código',
          ),
          {
            target: {
              value:
                ' promo10 ',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Valor do desconto',
          ),
          {
            target: {
              value: '10',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Subtotal mínimo (€)',
          ),
          {
            target: {
              value: '20',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Limite de utilizações',
          ),
          {
            target: {
              value: '10',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Início (opcional)',
          ),
          {
            target: {
              value:
                '2026-11-01',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Fim (opcional)',
          ),
          {
            target: {
              value:
                '2026-11-30',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Criar cupão',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Cupão PROMO10 criado.',
        )

        // O formulário é limpo após a criação.
        expect(
          screen.getByLabelText(
            'Código',
          ),
        ).toHaveValue('')
      },
    )

    test(
      'mostra erro do servidor na criação',
      async () => {
        stubList(
          createPage(),
        )

        fetchMock.mockImplementationOnce(
          async () =>
            createJsonResponse(
              {
                error:
                  'Dados inválidos',
                fieldErrors:
                  {
                    code: [
                      'Introduz um código de cupão válido',
                    ],
                  },
              },
              400,
            ),
        )

        render(
          <CouponsClient />,
        )

        await screen.findByText(
          'PROMO10',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Código',
          ),
          {
            target: {
              value:
                'PROMO10',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Valor do desconto',
          ),
          {
            target: {
              value: '10',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Criar cupão',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Dados inválidos (Introduz um código de cupão válido)',
        )
      },
    )

    test(
      'valida o formulário no cliente antes do pedido',
      async () => {
        stubList(
          createPage(),
        )

        render(
          <CouponsClient />,
        )

        await screen.findByText(
          'PROMO10',
        )

        // Sem código: erro no cliente, sem POST.
        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Criar cupão',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Introduz o código do cupão antes de criar.',
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        )
      },
    )

    test(
      'toggle desativa o cupão e recarrega a vista',
      async () => {
        stubList(
          createPage(),
        )

        fetchMock.mockImplementationOnce(
          async (
            input:
              | RequestInfo
              | URL,
            init?:
              | RequestInit,
          ) => {
            expect(
              String(input),
            ).toBe(
              '/api/admin/coupons/coupon-1',
            )

            expect(
              init?.method,
            ).toBe(
              'PATCH',
            )

            expect(
              JSON.parse(
                String(
                  init?.body,
                ),
              ),
            ).toEqual({
              isActive:
                false,
            })

            return createJsonResponse(
              createCouponRow(
                {
                  isActive:
                    false,
                  status:
                    'INACTIVE',
                },
              ),
            )
          },
        )

        stubList(
          createPage({
            kpis: {
              totalCoupons:
                3,
              activeCoupons:
                0,
              totalUses:
                5,
            },
          }),
        )

        render(
          <CouponsClient />,
        )

        await screen.findByText(
          'PROMO10',
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Desativar cupão PROMO10',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Cupão PROMO10 desativado.',
        )
      },
    )

    test(
      'mostra erro do servidor no toggle',
      async () => {
        stubList(
          createPage(),
        )

        fetchMock.mockImplementationOnce(
          async () =>
            createJsonResponse(
              {
                error:
                  'Erro interno do servidor',
              },
              500,
            ),
        )

        render(
          <CouponsClient />,
        )

        await screen.findByText(
          'PROMO10',
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Desativar cupão PROMO10',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Erro interno do servidor',
        )
      },
    )

    test(
      'mostra erro quando a listagem falha',
      async () => {
        fetchMock.mockImplementationOnce(
          async () => {
            throw new Error(
              'Falhou',
            )
          },
        )

        render(
          <CouponsClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Falhou',
        )
      },
    )
  },
)
