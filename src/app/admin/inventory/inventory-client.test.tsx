import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import InventoryClient from './inventory-client'

import type {
  InventoryOverview,
  InventoryRow,
} from '@/server/inventory'

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

function createRow(
  overrides: Partial<
    InventoryRow
  > = {},
): InventoryRow {
  return {
    variantId:
      'variant-1',
    sku: 'FLT-001',
    stock: 0,
    status: 'OUT_OF_STOCK',
    lowStockThreshold: null,
    productId:
      'product-1',
    productName:
      'Filtro de óleo',
    productSlug:
      'filtro-de-oleo',
    ...overrides,
  }
}

function baseRows(): InventoryRow[] {
  return [
    createRow(),
    createRow({
      variantId:
        'variant-2',
      sku: 'PAD-002',
      stock: 3,
      status: 'LOW_STOCK',
      productId:
        'product-2',
      productName:
        'Pastilhas de travão',
      productSlug:
        'pastilhas-de-travao',
    }),
    createRow({
      variantId:
        'variant-3',
      sku: 'VEL-003',
      stock: 12,
      status: 'IN_STOCK',
      productId:
        'product-3',
      productName:
        'Velocímetro digital',
      productSlug:
        'velocimetro-digital',
    }),
  ]
}

function createOverview(
  overrides: Partial<
    InventoryOverview
  > = {},
): InventoryOverview {
  return {
    threshold: 5,
    kpis: {
      totalSkus: 3,
      inStockCount: 1,
      lowStockCount: 1,
      outOfStockCount: 1,
    },
    variants: baseRows(),
    ...overrides,
  }
}

function stubOverview(
  response: unknown,
  status = 200,
  query = 'threshold=5',
) {
  fetchMock.mockImplementationOnce(
    async (input: RequestInfo | URL) => {
      expect(
        String(input),
      ).toBe(
        `/api/admin/inventory/overview?${query}`,
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
  return screen.getAllByText(
    heading,
  )[0].closest('div')
}

describe(
  'Admin Inventory Client',
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
      'apresenta KPIs de topo e a lista de SKUs com estados',
      async () => {
        stubOverview(
          createOverview(),
        )

        render(
          <InventoryClient />,
        )

        expect(
          await screen.findByText(
            'Total de SKUs',
          ),
        ).toBeInTheDocument()

        expect(
          kpiCard(
            'Total de SKUs',
          ),
        ).toHaveTextContent('3')

        expect(
          kpiCard('Stock baixo'),
        ).toHaveTextContent('1')

        expect(
          kpiCard('Sem stock'),
        ).toHaveTextContent('1')

        expect(
          screen.getByText(
            'Limiar global de 5 unidades ou limiar próprio da variante.',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'FLT-001',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pastilhas de travão',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Velocímetro digital',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            /3 de 3 SKUs/,
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'filtra por estado e termo de pesquisa',
      async () => {
        stubOverview(
          createOverview(),
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Estado',
          ),
          {
            target: {
              value:
                'OUT_OF_STOCK',
            },
          },
        )

        expect(
          screen.getByText(
            'Filtro de óleo',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Pastilhas de travão',
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
            'Pesquisar por SKU ou produto',
          ),
          {
            target: {
              value:
                'pastilha',
            },
          },
        )

        expect(
          screen.getByText(
            'Pastilhas de travão',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Velocímetro digital',
          ),
        ).not.toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Pesquisar por SKU ou produto',
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
            'Sem SKUs para os filtros aplicados.',
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
            'Velocímetro digital',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Sem SKUs para os filtros aplicados.',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'pagina a lista com mais de 20 SKUs',
      async () => {
        const variants =
          Array.from(
            { length: 25 },
            (_, index) =>
              createRow({
                variantId: `variant-${index + 1}`,
                sku: `SKU-${String(index + 1).padStart(3, '0')}`,
                stock: 50,
                status: 'IN_STOCK',
                productId:
                  `product-${index + 1}`,
                productName:
                  `Produto ${index + 1}`,
                productSlug: `produto-${index + 1}`,
              }),
          )

        stubOverview(
          createOverview({
            kpis: {
              totalSkus: 25,
              inStockCount: 25,
              lowStockCount: 0,
              outOfStockCount: 0,
            },
            variants,
          }),
        )

        render(
          <InventoryClient />,
        )

        expect(
          await screen.findByText(
            'SKU-001',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'SKU-021',
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
            'SKU-021',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'SKU-001',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByText(
            /25 de 25 SKUs/,
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'guarda correção rápida e recarrega os KPIs',
      async () => {
        stubOverview(
          createOverview(),
        )

        fetchMock.mockImplementationOnce(
          async (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => {
            expect(
              String(input),
            ).toBe(
              '/api/admin/inventory',
            )

            expect(
              init?.method,
            ).toBe('PATCH')

            expect(
              JSON.parse(
                String(init?.body),
              ) as {
                variantId: string
                stock: number
              },
            ).toEqual({
              variantId:
                'variant-1',
              stock: 8,
            })

            return createJsonResponse(
              {
                previousStock:
                  0,
                variant: {
                  variantId:
                    'variant-1',
                  sku: 'FLT-001',
                  stock: 8,
                  productId:
                    'product-1',
                  productName:
                    'Filtro de óleo',
                  productSlug:
                    'filtro-de-oleo',
                },
              },
            )
          },
        )

        stubOverview(
          createOverview(),
          200,
          'threshold=5',
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Novo stock de FLT-001',
          ),
          {
            target: {
              value: '8',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar stock de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Stock de Filtro de óleo guardado (0 → 8 unidades).',
        )

        await waitForFetchCalls(
          3,
        )

        const overviewCalls =
          fetchMock.mock.calls.filter(
            (call) =>
              String(
                call[0],
              ).includes(
                '/overview',
              ),
          )

        expect(
          overviewCalls,
        ).toHaveLength(2)
      },
    )

    test(
      'mostra erro do servidor quando a correção rápida falha',
      async () => {
        stubOverview(
          createOverview(),
        )

        fetchMock.mockImplementationOnce(
          async () =>
            createJsonResponse(
              {
                error:
                  'O stock deve estar entre 0 e 999999',
              },
              400,
            ),
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Novo stock de FLT-001',
          ),
          {
            target: {
              value:
                '1000000',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar stock de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'O stock deve estar entre 0 e 999999',
        )
      },
    )

    test(
      'muda o limiar e recarrega a vista com o novo valor',
      async () => {
        stubOverview(
          createOverview(),
        )

        fetchMock.mockImplementationOnce(
          async (
            input: RequestInfo | URL,
          ) => {
            expect(
              String(input),
            ).toBe(
              '/api/admin/inventory/overview?threshold=10',
            )

            return createJsonResponse(
              createOverview(
                {
                  threshold: 10,
                  variants: [
                    createRow({
                      stock: 8,
                      status:
                        'LOW_STOCK',
                    }),
                  ],
                  kpis: {
                    totalSkus: 1,
                    inStockCount: 0,
                    lowStockCount:
                      1,
                    outOfStockCount:
                      0,
                  },
                },
              ),
            )
          },
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Limiar de stock baixo (unidades)',
          ),
          {
            target: {
              value: '10',
            },
          },
        )

        fireEvent.blur(
          screen.getByLabelText(
            'Limiar de stock baixo (unidades)',
          ),
        )

        expect(
          await screen.findByText(
            'Limiar global de 10 unidades ou limiar próprio da variante.',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'rejeita limiar inválido sem recarregar',
      async () => {
        stubOverview(
          createOverview(),
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        const thresholdInput =
          screen.getByLabelText(
            'Limiar de stock baixo (unidades)',
          )

        fireEvent.change(
          thresholdInput,
          {
            target: {
              value: '150',
            },
          },
        )

        fireEvent.blur(
          thresholdInput,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'O limiar de stock deve estar entre 1 e 99',
        )

        expect(
          (screen.getByLabelText(
            'Limiar de stock baixo (unidades)',
          ) as HTMLInputElement)
            .value,
        ).toBe('5')

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        )
      },
    )

    test(
      'mostra o limiar efetivo marcado como próprio ou global',
      async () => {
        stubOverview(
          createOverview({
            variants: [
              createRow({
                stock: 2,
                status:
                  'LOW_STOCK',
                lowStockThreshold: 2,
              }),
              createRow({
                variantId:
                  'variant-2',
                sku: 'PAD-002',
                stock: 3,
                status:
                  'LOW_STOCK',
                productId:
                  'product-2',
                productName:
                  'Pastilhas de travão',
                productSlug:
                  'pastilhas-de-travao',
                lowStockThreshold:
                  null,
              }),
            ],
          }),
        )

        render(
          <InventoryClient />,
        )

        expect(
          await screen.findByText(
            'FLT-001',
          ),
        ).toBeInTheDocument()

        // Limiar próprio da variante (violeta).
        expect(
          screen.getByText(
            'Próprio: 2',
          ),
        ).toBeInTheDocument()

        // Limiar global da consulta.
        expect(
          screen.getByText(
            'Global: 5',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'guarda o limiar próprio e recarrega a vista',
      async () => {
        stubOverview(
          createOverview(),
        )

        fetchMock.mockImplementationOnce(
          async (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => {
            expect(
              String(input),
            ).toBe(
              '/api/admin/inventory/threshold',
            )

            expect(
              init?.method,
            ).toBe('PATCH')

            expect(
              JSON.parse(
                String(init?.body),
              ) as {
                variantId: string
                lowStockThreshold: number
              },
            ).toEqual({
              variantId:
                'variant-1',
              lowStockThreshold: 3,
            })

            return createJsonResponse(
              {
                previousThreshold:
                  null,
                threshold: 3,
                variant: {
                  variantId:
                    'variant-1',
                  sku: 'FLT-001',
                  stock: 0,
                  productId:
                    'product-1',
                  productName:
                    'Filtro de óleo',
                  productSlug:
                    'filtro-de-oleo',
                },
              },
            )
          },
        )

        stubOverview(
          createOverview(),
          200,
          'threshold=5',
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Limiar de stock de FLT-001',
          ),
          {
            target: {
              value: '3',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar limiar de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Limiar próprio de Filtro de óleo guardado (3 unidades).',
        )

        await waitForFetchCalls(
          3,
        )

        const thresholdCalls =
          fetchMock.mock.calls.filter(
            (call) =>
              String(
                call[0],
              ).includes(
                '/threshold',
              ),
          )

        expect(
          thresholdCalls,
        ).toHaveLength(1)

        const overviewCalls =
          fetchMock.mock.calls.filter(
            (call) =>
              String(
                call[0],
              ).includes(
                '/overview',
              ),
          )

        expect(
          overviewCalls,
        ).toHaveLength(2)
      },
    )

    test(
      'entrada vazia remove o limiar próprio e usa o global',
      async () => {
        stubOverview(
          createOverview({
            variants: [
              createRow({
                stock: 2,
                status:
                  'LOW_STOCK',
                lowStockThreshold: 2,
              }),
            ],
          }),
        )

        fetchMock.mockImplementationOnce(
          async (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => {
            expect(
              String(input),
            ).toBe(
              '/api/admin/inventory/threshold',
            )

            expect(
              init?.method,
            ).toBe('PATCH')

            expect(
              JSON.parse(
                String(init?.body),
              ) as {
                variantId: string
                lowStockThreshold: null
              },
            ).toEqual({
              variantId:
                'variant-1',
              lowStockThreshold:
                null,
            })

            return createJsonResponse(
              {
                previousThreshold: 2,
                threshold: null,
                variant: {
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
              },
            )
          },
        )

        stubOverview(
          createOverview(),
          200,
          'threshold=5',
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        // Input pré-preenchido com o limiar
        // próprio (2) → limpar e guardar.
        fireEvent.change(
          screen.getByLabelText(
            'Limiar de stock de FLT-001',
          ),
          {
            target: {
              value: '',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar limiar de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Limiar próprio de Filtro de óleo removido — usa o global (5 unidades).',
        )
      },
    )

    test(
      'guardar sem valor numa linha global é erro sem chamada',
      async () => {
        stubOverview(
          createOverview(),
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar limiar de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Introduz o novo limiar antes de guardar.',
        )

        // Só o GET inicial da overview.
        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        )
      },
    )

    test(
      'limiar próprio inválido é validado no cliente sem tocar na API',
      async () => {
        stubOverview(
          createOverview(),
        )

        render(
          <InventoryClient />,
        )

        await screen.findByText(
          'FLT-001',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Limiar de stock de FLT-001',
          ),
          {
            target: {
              value: '0',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar limiar de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'O limiar de stock deve estar entre 1 e 99',
        )

        // Só o GET inicial da overview.
        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        )
      },
    )
  },
)

async function waitForFetchCalls(
  count: number,
) {
  await vi.waitFor(() => {
    expect(
      fetchMock.mock.calls
        .length,
    ).toBeGreaterThanOrEqual(
      count,
    )
  })
}
