import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  '@/server/admin-auth',
  () => {
    class UnauthorizedError
      extends Error {}

    class ForbiddenError
      extends Error {}

    return {
      UnauthorizedError,
      ForbiddenError,
      requireAdmin: vi.fn(),
    }
  },
)

vi.mock(
  '@/server/inventory',
  () => ({
    InventoryNotFoundError: class extends Error {},
    updateVariantThreshold:
      vi.fn(),
  }),
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  InventoryNotFoundError,
  updateVariantThreshold,
  type VariantThresholdUpdate,
} from '@/server/inventory'
import { PATCH } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockUpdateVariantThreshold =
  vi.mocked(
    updateVariantThreshold,
  )

function createThresholdResult(
  overrides: Partial<
    VariantThresholdUpdate
  > = {},
): VariantThresholdUpdate {
  return {
    previousThreshold: null,
    threshold: 3,
    variant: {
      variantId:
        'variant-1',
      sku: 'FLT-001',
      stock: 5,
      productId:
        'product-1',
      productName:
        'Filtro de óleo',
      productSlug:
        'filtro-de-oleo',
    },
    ...overrides,
  }
}

function createPatchRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/inventory/threshold',
    {
      method: 'PATCH',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify(
        body,
      ),
    },
  )
}

describe(
  'Admin Inventory Threshold API',
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
      'guarda o limiar próprio e devolve o resultado do serviço',
      async () => {
        const result =
          createThresholdResult()

        mockUpdateVariantThreshold.mockResolvedValue(
          result,
        )

        const response =
          await PATCH(
            createPatchRequest(
              {
                variantId:
                  'variant-1',
                lowStockThreshold: 3,
              },
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual(result)

        expect(
          mockUpdateVariantThreshold,
        ).toHaveBeenCalledWith(
          {
            variantId:
              'variant-1',
            lowStockThreshold: 3,
          },
        )
      },
    )

    test(
      'remove o limiar próprio (null) e devolve o anterior',
      async () => {
        const result =
          createThresholdResult(
            {
              previousThreshold: 3,
              threshold: null,
            },
          )

        mockUpdateVariantThreshold.mockResolvedValue(
          result,
        )

        const response =
          await PATCH(
            createPatchRequest(
              {
                variantId:
                  'variant-1',
                lowStockThreshold:
                  null,
              },
            ),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual(result)

        expect(
          mockUpdateVariantThreshold,
        ).toHaveBeenCalledWith(
          {
            variantId:
              'variant-1',
            lowStockThreshold:
              null,
          },
        )
      },
    )

    test(
      'devolve 400 com fieldErrors para payload inválido',
      async () => {
        const { z } =
          await import(
            'zod'
          )

        // Erro Zod real (com issues) produzido por um schema
        // mínimo — o handler normaliza os issues.
        let zodError: unknown

        try {
          z.object({
            variantId: z
              .string()
              .min(1),
          }).parse({
            variantId: '',
          })
        } catch (
          caught
        ) {
          zodError =
            caught
        }

        mockUpdateVariantThreshold.mockRejectedValue(
          zodError,
        )

        const response =
          await PATCH(
            createPatchRequest(
              {
                variantId: '',
                lowStockThreshold: 3,
              },
            ),
          )

        expect(
          response.status,
        ).toBe(400)

        const body =
          (await response.json()) as
            | {
                error?: string
                fieldErrors?: Record<
                  string,
                  string[]
                >
              }
            | null

        expect(
          body?.error,
        ).toBe(
          'Dados inválidos',
        )

        expect(
          body?.fieldErrors
            ?.variantId,
        ).toBeDefined()
      },
    )

    test(
      'devolve 400 para JSON inválido',
      async () => {
        const response =
          await PATCH(
            new Request(
              'http://localhost/api/admin/inventory/threshold',
              {
                method:
                  'PATCH',
                headers:
                  {
                    'content-type':
                      'application/json',
                  },
                body: 'não é json',
              },
            ),
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'JSON inválido',
        })

        expect(
          mockUpdateVariantThreshold,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 404 quando a variante não existe',
      async () => {
        mockUpdateVariantThreshold.mockRejectedValue(
          new InventoryNotFoundError(),
        )

        const response =
          await PATCH(
            createPatchRequest(
              {
                variantId:
                  'variant-x',
                lowStockThreshold: 3,
              },
            ),
          )

        expect(
          response.status,
        ).toBe(404)

        expect(
          mockRequireAdmin,
        ).toHaveBeenCalledTimes(
          1,
        )
      },
    )

    test(
      'devolve 401 sem autenticação',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const response =
          await PATCH(
            createPatchRequest(
              {
                variantId:
                  'variant-1',
                lowStockThreshold: 3,
              },
            ),
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
          mockUpdateVariantThreshold,
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
          await PATCH(
            createPatchRequest(
              {
                variantId:
                  'variant-1',
                lowStockThreshold: 3,
              },
            ),
          )

        expect(
          response.status,
        ).toBe(403)

        expect(
          mockUpdateVariantThreshold,
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

        mockUpdateVariantThreshold.mockRejectedValue(
          new Error(
            'base de dados indisponível',
          ),
        )

        const response =
          await PATCH(
            createPatchRequest(
              {
                variantId:
                  'variant-1',
                lowStockThreshold: 3,
              },
            ),
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
