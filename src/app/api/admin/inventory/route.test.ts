import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock(
  '@/server/inventory',
  () => {
    class InventoryValidationError extends Error {
      field: string

      constructor(
        field: string,
        message: string,
      ) {
        super(message)
        this.field = field
      }
    }

    class InventoryNotFoundError extends InventoryValidationError {
      constructor() {
        super(
          'variantId',
          'Variante não encontrada',
        )
      }
    }

    return {
      InventoryValidationError,
      InventoryNotFoundError,
      normalizeLowStockThreshold:
        vi.fn(
          (value: unknown) => {
            if (
              value ===
              undefined
            ) {
              return 5
            }

            const number = Number(
              value,
            )

            if (
              !Number.isFinite(
                number,
              ) ||
              number < 1 ||
              number > 99
            ) {
              throw new InventoryValidationError(
                'threshold',
                'O limiar de stock deve estar entre 1 e 99',
              )
            }

            return number
          },
        ),
      listLowStockVariants:
        vi.fn(),
      updateVariantStock:
        vi.fn(),
    }
  },
)

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  InventoryNotFoundError,
  InventoryValidationError,
  listLowStockVariants,
  normalizeLowStockThreshold,
  updateVariantStock,
} from '@/server/inventory'
import {
  GET,
  PATCH,
} from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockListLowStockVariants =
  vi.mocked(listLowStockVariants)

const mockUpdateVariantStock =
  vi.mocked(updateVariantStock)

const mockNormalizeLowStockThreshold =
  vi.mocked(normalizeLowStockThreshold)

function inventoryVariants() {
  return [
    {
      variantId:
        'variant-1',
      sku: 'FLT-001',
      stock: 3,
      productId:
        'product-1',
      productName:
        'Filtro de óleo',
      productSlug:
        'filtro-de-oleo',
    },
  ]
}

describe(
  'Admin Inventory API',
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

      mockNormalizeLowStockThreshold.mockImplementation(
        (value: unknown) => {
          if (
            value ===
            undefined
          ) {
            return 5
          }

          const number = Number(
            value,
          )

          if (
            !Number.isFinite(
              number,
            ) ||
            number < 1 ||
            number > 99
          ) {
            throw new InventoryValidationError(
              'threshold',
              'O limiar de stock deve estar entre 1 e 99',
            )
          }

          return number
        },
      )
    })

    describe(
      'GET',
      () => {
        test(
          'devolve variantes com stock baixo e o limiar usado',
          async () => {
            const variants =
              inventoryVariants()

            mockListLowStockVariants.mockResolvedValue(
              variants,
            )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/inventory',
                ),
              )

            expect(
              response.status,
            ).toBe(200)

            expect(
              await response.json(),
            ).toEqual({
              threshold: 5,
              variants,
            })

            expect(
              mockListLowStockVariants,
            ).toHaveBeenCalledWith({
              threshold: 5,
            })
          },
        )

        test(
          'normaliza o limiar da querystring',
          async () => {
            mockListLowStockVariants.mockResolvedValue(
              [],
            )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/inventory?threshold=2',
                ),
              )

            expect(
              response.status,
            ).toBe(200)

            expect(
              mockListLowStockVariants,
            ).toHaveBeenCalledWith({
              threshold: 2,
            })
          },
        )

        test(
          'devolve 401 sem autenticação',
          async () => {
            mockRequireAdmin.mockRejectedValueOnce(
              new UnauthorizedError(),
            )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/inventory',
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
              mockListLowStockVariants,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'devolve 403 sem perfil admin',
          async () => {
            mockRequireAdmin.mockRejectedValueOnce(
              new AdminForbiddenError(),
            )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/inventory',
                ),
              )

            expect(
              response.status,
            ).toBe(403)

            expect(
              await response.json(),
            ).toEqual({
              error:
                'Sem autorização',
            })
          },
        )

        test(
          'devolve 400 com limiar inválido',
          async () => {
            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/inventory?threshold=0',
                ),
              )

            expect(
              response.status,
            ).toBe(400)

            expect(
              await response.json(),
            ).toEqual({
              error:
                'O limiar de stock deve estar entre 1 e 99',
            })

            expect(
              mockListLowStockVariants,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'devolve 500 num erro inesperado',
          async () => {
            mockListLowStockVariants.mockRejectedValueOnce(
              new Error(
                'base de dados em baixo',
              ),
            )

            const consoleError =
              vi.spyOn(
                console,
                'error',
              ).mockImplementation(
                () => undefined,
              )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/inventory',
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

    describe(
      'PATCH',
      () => {
        function createPatchRequest(
          body: unknown,
        ) {
          return new Request(
            'http://localhost/api/admin/inventory',
            {
              method: 'PATCH',
              headers: {
                'content-type':
                  'application/json',
              },
              body:
                typeof body ===
                'string'
                  ? body
                  : JSON.stringify(
                      body,
                    ),
            },
          )
        }

        test(
          'guarda o stock corrigido e devolve a variante atualizada',
          async () => {
            const result = {
              previousStock: 3,
              variant: {
                variantId:
                  'variant-1',
                sku: 'FLT-001',
                stock: 12,
                productId:
                  'product-1',
                productName:
                  'Filtro de óleo',
                productSlug:
                  'filtro-de-oleo',
              },
            }

            mockUpdateVariantStock.mockResolvedValueOnce(
              result,
            )

            const response =
              await PATCH(
                createPatchRequest({
                  variantId:
                    'variant-1',
                  stock: 12,
                }),
              )

            expect(
              response.status,
            ).toBe(200)

            expect(
              await response.json(),
            ).toEqual(result)

            expect(
              mockUpdateVariantStock,
            ).toHaveBeenCalledWith(
              {
                variantId:
                  'variant-1',
                stock: 12,
              },
              undefined,
              // Ator do movimento MANUAL_ADJUSTMENT.
              'admin-test',
            )
          },
        )

        test(
          'devolve 401 sem autenticação',
          async () => {
            mockRequireAdmin.mockRejectedValueOnce(
              new UnauthorizedError(),
            )

            const response =
              await PATCH(
                createPatchRequest({
                  variantId:
                    'variant-1',
                  stock: 5,
                }),
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
              mockUpdateVariantStock,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'devolve 400 com corpo inválido',
          async () => {
            const response =
              await PATCH(
                createPatchRequest(
                  '[1, 2, 3]',
                ),
              )

            expect(
              response.status,
            ).toBe(400)

            expect(
              await response.json(),
            ).toEqual({
              error:
                'Correção de stock inválida',
            })
          },
        )

        test(
          'devolve 400 com JSON inválido',
          async () => {
            const response =
              await PATCH(
                createPatchRequest(
                  '{not json',
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
          },
        )

        test(
          'devolve 404 quando a variante não existe',
          async () => {
            mockUpdateVariantStock.mockRejectedValueOnce(
              new InventoryNotFoundError(),
            )

            const response =
              await PATCH(
                createPatchRequest({
                  variantId:
                    'variante-inexistente',
                  stock: 5,
                }),
              )

            expect(
              response.status,
            ).toBe(404)

            expect(
              await response.json(),
            ).toEqual({
              error:
                'Variante não encontrada',
            })
          },
        )

        test(
          'devolve 400 com stock inválido da validação do serviço',
          async () => {
            mockUpdateVariantStock.mockRejectedValueOnce(
              new InventoryValidationError(
                'stock',
                'O stock deve estar entre 0 e 999999',
              ),
            )

            const response =
              await PATCH(
                createPatchRequest({
                  variantId:
                    'variant-1',
                  stock: -5,
                }),
              )

            expect(
              response.status,
            ).toBe(400)

            expect(
              await response.json(),
            ).toEqual({
              error:
                'O stock deve estar entre 0 e 999999',
            })
          },
        )
      },
    )
  },
)
