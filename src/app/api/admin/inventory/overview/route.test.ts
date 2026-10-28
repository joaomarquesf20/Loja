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
  async () => {
    const { z } =
      await import('zod')

    const thresholdMessage =
      'O limiar de stock deve estar entre 1 e 99'

    // Schema espelha o contrato validado pelo serviço real (Zod).
    return {
      inventoryOverviewQuerySchema:
        z.object({
          threshold: z.preprocess(
            (value) =>
              value === undefined ||
              value === null ||
              (typeof value ===
                'string' &&
                value.trim() ===
                  '')
                ? undefined
                : value,
            z.coerce
              .number({
                message:
                  'O limiar de stock deve ser um número inteiro',
              })
              .int({
                message:
                  'O limiar de stock deve ser um número inteiro',
              })
              .min(1, {
                message:
                  thresholdMessage,
              })
              .max(99, {
                message:
                  thresholdMessage,
              })
              .default(
                5,
              ),
          ),
        }),
      getInventoryOverview:
        vi.fn(),
    }
  },
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  getInventoryOverview,
  type InventoryOverview,
} from '@/server/inventory'
import { GET } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockGetInventoryOverview =
  vi.mocked(
    getInventoryOverview,
  )

function createOverview(): InventoryOverview {
  return {
    threshold: 5,
    kpis: {
      totalSkus: 12,
      inStockCount: 7,
      lowStockCount: 3,
      outOfStockCount: 2,
    },
    variants: [
      {
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
      },
    ],
  }
}

function createRequest(
  query = '',
) {
  return new Request(
    `http://localhost/api/admin/inventory/overview${query}`,
  )
}

describe(
  'Admin Inventory Overview API',
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
      'devolve KPIs e variantes com o limiar padrão',
      async () => {
        mockGetInventoryOverview.mockResolvedValue(
          createOverview(),
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
        ).toEqual(
          createOverview(),
        )

        expect(
          mockGetInventoryOverview,
        ).toHaveBeenCalledWith({
          threshold: undefined,
        })
      },
    )

    test(
      'passa o limiar da query ao serviço',
      async () => {
        mockGetInventoryOverview.mockResolvedValue(
          {
            ...createOverview(),
            threshold: 10,
          },
        )

        const response =
          await GET(
            createRequest(
              '?threshold=10',
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mockGetInventoryOverview,
        ).toHaveBeenCalledWith({
          threshold: '10',
        })

        expect(
          (await response.json()) as {
            threshold: number
          },
        ).toMatchObject({
          threshold: 10,
        })
      },
    )

    test(
      'devolve 400 para limiar inválido',
      async () => {
        const { inventoryOverviewQuerySchema } =
          await import(
            '@/server/inventory'
          )

        let zodError: unknown

        try {
          inventoryOverviewQuerySchema.parse(
            { threshold: 'abc' },
          )
        } catch (caught) {
          zodError = caught
        }

        mockGetInventoryOverview.mockRejectedValue(
          zodError,
        )

        const response =
          await GET(
            createRequest(
              '?threshold=abc',
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

        expect(body.error).toBe(
          'Dados inválidos',
        )

        expect(
          body.fieldErrors?.threshold,
        ).toContain(
          'O limiar de stock deve ser um número inteiro',
        )
      },
    )

    test(
      'devolve 400 para limiar fora dos limites',
      async () => {
        const { inventoryOverviewQuerySchema } =
          await import(
            '@/server/inventory'
          )

        let zodError: unknown

        try {
          inventoryOverviewQuerySchema.parse(
            { threshold: 150 },
          )
        } catch (caught) {
          zodError = caught
        }

        mockGetInventoryOverview.mockRejectedValue(
          zodError,
        )

        const response =
          await GET(
            createRequest(
              '?threshold=150',
            ),
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          mockGetInventoryOverview,
        ).toHaveBeenCalledWith({
          threshold: '150',
        })
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
          mockGetInventoryOverview,
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
          mockGetInventoryOverview,
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

        mockGetInventoryOverview.mockRejectedValue(
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
