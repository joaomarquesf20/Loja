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

import MovementsClient from './movements-client'

import type {
  StockMovementRow,
  StockMovementsPage,
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
    StockMovementRow
  > = {},
): StockMovementRow {
  return {
    id: 'movement-1',
    variantId:
      'variant-1',
    sku: 'FLT-001',
    productId:
      'product-1',
    productName:
      'Filtro de óleo',
    productSlug:
      'filtro-de-oleo',
    type: 'RESTOCK',
    quantityChange: 8,
    previousStock: 2,
    newStock: 10,
    actorEmail:
      'admin@example.com',
    createdAt:
      '2026-10-01T10:30:00.000Z',
    ...overrides,
  }
}

function baseRows(): StockMovementRow[] {
  return [
    createRow(),
    createRow({
      id: 'movement-2',
      sku: 'PAD-002',
      type: 'SALE',
      quantityChange: -2,
      previousStock: 9,
      newStock: 7,
      actorEmail: null,
      productName:
        'Pastilhas de travão',
      productSlug:
        'pastilhas-de-travao',
      variantId:
        'variant-2',
      productId:
        'product-2',
    }),
  ]
}

function createMovementsPage(
  overrides: Partial<
    StockMovementsPage
  > = {},
): StockMovementsPage {
  return {
    movements: baseRows(),
    total: 2,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    ...overrides,
  }
}

function stubMovements(
  response: unknown,
  status = 200,
  query = 'page=1&pageSize=50',
) {
  fetchMock.mockImplementationOnce(
    async (input: RequestInfo | URL) => {
      expect(
        String(input),
      ).toBe(
        `/api/admin/inventory/movements?${query}`,
      )

      return createJsonResponse(
        response,
        status,
      )
    },
  )
}

describe(
  'Admin Inventory Movements Client',
  () => {
    beforeEach(() => {
      // mockReset limpa também as filas de mockImplementationOnce
      // pendentes; clearAllMocks deixaria stubs órfãos a vazarem
      // para o teste seguinte.
      fetchMock.mockReset()

      vi.stubGlobal(
        'fetch',
        fetchMock,
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test(
      'carrega o histórico com a paginação padrão',
      async () => {
        stubMovements(
          createMovementsPage(),
        )

        render(
          <MovementsClient />,
        )

        expect(
          await screen.findByText(
            '2 movimentos no histórico',
          ),
        ).toBeInTheDocument()

        const rows =
          screen.getAllByTestId(
            'stock-movement-row',
          )

        expect(rows).toHaveLength(
          2,
        )

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

        // Etiquetas por tipo, dentro das linhas (o filtro de
        // tipo também usa o mesmo texto).
        expect(
          within(rows[0]).getByText(
            'Reposição',
          ),
        ).toBeInTheDocument()

        expect(
          within(rows[1]).getByText(
            'Venda',
          ),
        ).toBeInTheDocument()

        // Stock antes → depois.
        expect(
          screen.getByText(
            /\b2 → 10\b/,
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            /\b9 → 7\b/,
          ),
        ).toBeInTheDocument()

        // Ator: email quando existente, "Sistema" quando nulo.
        expect(
          screen.getByText(
            'admin@example.com',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Sistema',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'refiltra por tipo de movimento e volta à primeira página',
      async () => {
        stubMovements(
          createMovementsPage(),
        )

        render(
          <MovementsClient />,
        )

        expect(
          await screen.findByText(
            '2 movimentos no histórico',
          ),
        ).toBeInTheDocument()

        stubMovements(
          createMovementsPage({
            movements: [
              createRow(),
            ],
            total: 1,
          }),
          200,
          'type=RESTOCK&page=1&pageSize=50',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Tipo de movimento',
          ),
          {
            target: {
              value: 'RESTOCK',
            },
          },
        )

        expect(
          await screen.findByText(
            '1 movimentos no histórico',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getAllByTestId(
            'stock-movement-row',
          ),
        ).toHaveLength(1)
      },
    )

    test(
      'commite a pesquisa por SKU no blur',
      async () => {
        stubMovements(
          createMovementsPage(),
        )

        render(
          <MovementsClient />,
        )

        expect(
          await screen.findByText(
            '2 movimentos no histórico',
          ),
        ).toBeInTheDocument()

        const input =
          screen.getByLabelText(
            'SKU',
          )

        fireEvent.change(
          input,
          {
            target: {
              value: '  PAD-002  ',
            },
          },
        )

        stubMovements(
          createMovementsPage({
            movements: [
              createRow({
                id: 'movement-2',
                sku: 'PAD-002',
              }),
            ],
            total: 1,
          }),
          200,
          'sku=PAD-002&page=1&pageSize=50',
        )

        fireEvent.blur(input)

        expect(
          await screen.findByText(
            '1 movimentos no histórico',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'navega entre páginas com os botões anterior/seguinte',
        async () => {
          stubMovements(
            createMovementsPage({
              total: 120,
              totalPages: 3,
            }),
          )

          render(
            <MovementsClient />,
          )

          expect(
            await screen.findByText(
              '120 movimentos no histórico',
            ),
          ).toBeInTheDocument()

          expect(
            screen.getByText(
              'Página 1 de 3',
            ),
          ).toBeInTheDocument()

          expect(
            screen.getByLabelText(
              'Página anterior',
            ),
          ).toBeDisabled()

          expect(
            screen.getByLabelText(
              'Página seguinte',
            ),
          ).toBeEnabled()

          stubMovements(
            createMovementsPage({
              total: 120,
              page: 2,
              totalPages: 3,
            }),
            200,
            'page=2&pageSize=50',
          )

          fireEvent.click(
            screen.getByLabelText(
              'Página seguinte',
            ),
          )

          expect(
            await screen.findByText(
              'Página 2 de 3',
            ),
          ).toBeInTheDocument()

          expect(
            screen.getByLabelText(
              'Página anterior',
            ),
          ).toBeEnabled()
        },
      )

    test(
      'apresenta estado vazio quando não há movimentos',
      async () => {
        stubMovements(
          createMovementsPage({
            movements: [],
            total: 0,
          }),
        )

        render(
          <MovementsClient />,
        )

        expect(
          await screen.findByText(
            '0 movimentos no histórico',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Sem movimentos para os filtros aplicados.',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'apresenta erro quando o histórico não carrega',
      async () => {
        stubMovements(
          {
            error:
              'Erro interno do servidor',
          },
          500,
        )

        render(
          <MovementsClient />,
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
      'limpa os filtros aplicados',
      async () => {
        stubMovements(
          createMovementsPage(),
        )

        render(
          <MovementsClient />,
        )

        expect(
          await screen.findByText(
            '2 movimentos no histórico',
          ),
        ).toBeInTheDocument()

        stubMovements(
          createMovementsPage({
            movements: [
              createRow(),
            ],
            total: 1,
          }),
          200,
          'type=RESTOCK&page=1&pageSize=50',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Tipo de movimento',
          ),
          {
            target: {
              value: 'RESTOCK',
            },
          },
        )

        expect(
          await screen.findByText(
            '1 movimentos no histórico',
          ),
        ).toBeInTheDocument()

        // Limpar filtros repõe a vista completa.
        stubMovements(
          createMovementsPage(),
          200,
          'page=1&pageSize=50',
        )

        fireEvent.click(
          screen.getByText(
            'Limpar filtros',
          ),
        )

        expect(
          await screen.findByText(
            '2 movimentos no histórico',
          ),
        ).toBeInTheDocument()
      },
    )
  },
)
