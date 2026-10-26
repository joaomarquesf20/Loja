import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError
    extends Error {}

  class ForbiddenError
    extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock(
  '@/server/inventory',
  () => ({
    listStockMovements: vi.fn(),
  }),
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  listStockMovements,
  type StockMovementsPage,
} from '@/server/inventory'
import { GET } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockListStockMovements =
  vi.mocked(
    listStockMovements,
  )

function createMovementsPage(
  overrides: Partial<
    StockMovementsPage
  > = {},
): StockMovementsPage {
  return {
    movements: [
      {
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
      },
    ],
    total: 1,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    ...overrides,
  }
}

function createRequest(
  query = '',
) {
  return new Request(
    `http://localhost/api/admin/inventory/movements${query}`,
  )
}

describe(
  'Admin Inventory Movements API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRequireAdmin.mockResolvedValue(
        {
          user: {
            id: 'admin-test',
            role: 'ADMIN',
          },
        } as Awaited<
          ReturnType<
            typeof requireAdmin
          >
        >,
      )
    })

    test(
      'devolve o histórico com a página e o tamanho padrão',
      async () => {
        const page =
          createMovementsPage()

        mockListStockMovements.mockResolvedValue(
          page,
        )

        const response =
          await GET(
            createRequest(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual(page)

        expect(
          mockListStockMovements,
        ).toHaveBeenCalledWith({
          type: undefined,
          sku: undefined,
          from: undefined,
          to: undefined,
          page: undefined,
          pageSize: undefined,
        })
      },
    )

    test(
      'passa os filtros da query ao serviço sem validar',
      async () => {
        mockListStockMovements.mockResolvedValue(
          createMovementsPage({
            page: 2,
            pageSize: 25,
          }),
        )

        const response =
          await GET(
            createRequest(
              '?type=RESTOCK&sku=flt-001&from=2026-09-01&to=2026-09-30&page=2&pageSize=25',
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mockListStockMovements,
        ).toHaveBeenCalledWith({
          type: 'RESTOCK',
          sku: 'flt-001',
          from: '2026-09-01',
          to: '2026-09-30',
          page: '2',
          pageSize: '25',
        })
      },
    )

    test(
      'devolve 400 com fieldErrors para query inválida',
      async () => {
        const { z } =
          await import(
            'zod'
          )

        // Erro Zod real (com issues) produzido por um schema
        // mínimo — o handler universal normaliza os issues.
        let zodError: unknown

        try {
          z.object({
            page: z.coerce
              .number()
              .int()
              .min(1),
          }).parse({
            page: 'abc',
          })
        } catch (caught) {
          zodError = caught
        }

        mockListStockMovements.mockRejectedValue(
          zodError,
        )

        const response =
          await GET(
            createRequest(
              '?page=abc',
            ),
          )

        expect(
          response.status,
        ).toBe(400)

        const body = (await response.json()) as {
          error?: string
          fieldErrors?: Record<
            string,
            string[]
          >
        }

        expect(
          body.error,
        ).toBe(
          'Dados inválidos',
        )

        expect(
          body.fieldErrors?.page,
        ).toBeDefined()
      },
    )

    test(
      'devolve 401 sem autenticação',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const response =
          await GET(
            createRequest(),
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Não autenticado',
        })

        expect(
          mockListStockMovements,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 403 sem papel ADMIN',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new ForbiddenError(),
        )

        const response =
          await GET(
            createRequest(),
          )

        expect(
          response.status,
        ).toBe(403)

        expect(
          mockListStockMovements,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 500 seguro para erro inesperado',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => undefined,
          )

        mockListStockMovements.mockRejectedValue(
          new Error(
            'base de dados indisponível',
          ),
        )

        const response =
          await GET(
            createRequest(),
          )

        expect(
          response.status,
        ).toBe(500)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Erro interno do servidor',
        })

        consoleError.mockRestore()
      },
    )
  },
)
