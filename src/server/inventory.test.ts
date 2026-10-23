import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  './db',
  () => ({
    prisma: {},
  }),
)

import {
  DEFAULT_LOW_STOCK_LIMIT,
  DEFAULT_LOW_STOCK_THRESHOLD,
  InventoryNotFoundError,
  listLowStockVariants,
  updateVariantStock,
  type InventoryClient,
  type VariantRecord,
} from './inventory'

function createVariantRecord(
  overrides: Partial<
    VariantRecord
  > = {},
): VariantRecord {
  return {
    id: 'variant-1',
    sku: 'FLT-001',
    stockQuantity: 3,
    product: {
      id: 'product-1',
      name: 'Filtro de óleo',
      slug:
        'filtro-de-oleo',
    },
    ...overrides,
  }
}

function createClient() {
  const findMany = vi.fn()

  const findUnique = vi.fn()

  const update = vi.fn()

  const client: InventoryClient =
    {
      productVariant: {
        findMany,
        findUnique,
        update,
      },
    }

  return {
    client,
    findMany,
    findUnique,
    update,
  }
}

describe(
  'Serviço de inventário',
  () => {
    let client: InventoryClient
    let findMany: ReturnType<
      typeof vi.fn
    >

    beforeEach(() => {
      const created =
        createClient()

      client = created.client
      findMany = created.findMany
    })

    describe(
      'listLowStockVariants',
      () => {
        test(
          'consulta variantes ativas de produtos ativos com o limiar padrão',
          async () => {
            findMany.mockResolvedValue(
              [],
            )

            const result =
              await listLowStockVariants(
                undefined,
                client,
              )

            expect(
              result,
            ).toEqual([])

            expect(
              findMany,
            ).toHaveBeenCalledTimes(
              1,
            )

            expect(
              findMany,
            ).toHaveBeenCalledWith({
              where: {
                stockQuantity: {
                  lte: 5,
                },
                isActive: true,
                product: {
                  isActive: true,
                },
              },
              orderBy: [
                {
                  stockQuantity:
                    'asc',
                },
                {
                  sku: 'asc',
                },
              ],
              take: DEFAULT_LOW_STOCK_LIMIT,
              select: {
                id: true,
                sku: true,
                stockQuantity: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            })
          },
        )

        test(
          'aceita limiar e limite personalizados',
          async () => {
            findMany.mockResolvedValue(
              [],
            )

            await listLowStockVariants(
              {
                threshold: 2,
                limit: 50,
              },
              client,
            )

            expect(
              findMany,
            ).toHaveBeenCalledWith({
              where: {
                stockQuantity: {
                  lte: 2,
                },
                isActive: true,
                product: {
                  isActive: true,
                },
              },
              orderBy: [
                {
                  stockQuantity:
                    'asc',
                },
                {
                  sku: 'asc',
                },
              ],
              take: 50,
              select:
                expect.anything(),
            })
          },
        )

        test(
          'usa o limiar padrão quando a entrada é vazia',
          async () => {
            findMany.mockResolvedValue(
              [],
            )

            for (const threshold of [
              undefined,
              null,
              '',
            ]) {
              findMany.mockClear()

              await listLowStockVariants(
                {
                  threshold,
                },
                client,
              )

              expect(
                findMany.mock.calls[0]?.[0]
                  .where
                  .stockQuantity,
              ).toEqual({
                lte: DEFAULT_LOW_STOCK_THRESHOLD,
              })
            }
          },
        )

        test(
          'rejeita limiares fora dos limites',
          async () => {
            for (const threshold of [
              0,
              -3,
              '1e3',
              100,
            ]) {
              await expect(
                listLowStockVariants(
                  {
                    threshold,
                  },
                  client,
                ),
              ).rejects.toMatchObject(
                {
                  name: 'InventoryValidationError',
                  field:
                    'threshold',
                  message:
                    'O limiar de stock deve estar entre 1 e 99',
                },
              )
            }

            for (const threshold of [
              'abc',
              2.5,
            ]) {
              await expect(
                listLowStockVariants(
                  {
                    threshold,
                  },
                  client,
                ),
              ).rejects.toMatchObject(
                {
                  field:
                    'threshold',
                  message:
                    'O limiar de stock deve ser um número inteiro',
                },
              )
            }

            expect(
              findMany,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'rejeita limites de resultados fora dos limites',
          async () => {
            for (const limit of [
              0,
              -1,
              101,
            ]) {
              await expect(
                listLowStockVariants(
                  {
                    limit,
                  },
                  client,
                ),
              ).rejects.toMatchObject(
                {
                  name: 'InventoryValidationError',
                  field: 'limit',
                  message:
                    'O limite de resultados deve estar entre 1 e 100',
                },
              )
            }

            for (const limit of [
              'abc',
              1.5,
            ]) {
              await expect(
                listLowStockVariants(
                  {
                    limit,
                  },
                  client,
                ),
              ).rejects.toMatchObject(
                {
                  field: 'limit',
                  message:
                    'O limite de resultados deve ser um número inteiro',
                },
              )
            }

            expect(
              findMany,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'mapeia os registos da base de dados para variantes do painel',
          async () => {
            findMany.mockResolvedValue(
              [
                createVariantRecord(),
                createVariantRecord(
                  {
                    id: 'variant-2',
                    sku: 'FLT-002',
                    stockQuantity: 0,
                  },
                ),
              ],
            )

            const result =
              await listLowStockVariants(
                undefined,
                client,
              )

            expect(
              result,
            ).toEqual([
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
              {
                variantId:
                  'variant-2',
                sku: 'FLT-002',
                stock: 0,
                productId:
                  'product-1',
                productName:
                  'Filtro de óleo',
                productSlug:
                  'filtro-de-oleo',
              },
            ])
          },
        )
      },
    )

    describe(
      'updateVariantStock',
      () => {
        let findUnique: ReturnType<
          typeof vi.fn
        >
        let update: ReturnType<
          typeof vi.fn
        >

        beforeEach(() => {
          const created =
            createClient()

          client =
            created.client

          findUnique =
            created.findUnique

          update =
            created.update
        })

        test(
          'define o stock exato da variante e devolve o valor anterior',
          async () => {
            findUnique.mockResolvedValue(
              createVariantRecord(),
            )

            update.mockResolvedValue(
              createVariantRecord(
                {
                  stockQuantity: 12,
                },
              ),
            )

            const result =
              await updateVariantStock(
                {
                  variantId:
                    'variant-1',
                  stock: 12,
                },
                client,
              )

            expect(
              result,
            ).toEqual({
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
            })

            expect(
              findUnique,
            ).toHaveBeenCalledWith({
              where: {
                id: 'variant-1',
              },
              select:
                expect.anything(),
            })

            expect(
              update,
            ).toHaveBeenCalledWith({
              where: {
                id: 'variant-1',
              },
              data: {
                stockQuantity:
                  12,
              },
              select:
                expect.anything(),
            })
          },
        )

        test(
          'usa variantes com stock a zero como valor anterior',
          async () => {
            findUnique.mockResolvedValue(
              createVariantRecord(
                {
                  stockQuantity: 0,
                },
              ),
            )

            update.mockResolvedValue(
              createVariantRecord(
                {
                  stockQuantity: 8,
                },
              ),
            )

            const result =
              await updateVariantStock(
                {
                  variantId:
                    'variant-1',
                  stock: '8',
                },
                client,
              )

            expect(
              result.previousStock,
            ).toBe(0)

            expect(
              result.variant.stock,
            ).toBe(8)
          },
        )

        test(
          'lança inventário não encontrado e não faz update',
          async () => {
            findUnique.mockResolvedValue(
              null,
            )

            await expect(
              updateVariantStock(
                {
                  variantId:
                    'variante-inexistente',
                  stock: 5,
                },
                client,
              ),
            ).rejects.toEqual(
              new InventoryNotFoundError(),
            )

            expect(
              update,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'rejeita identificadores de variante inválidos sem consultar',
          async () => {
            for (const variantId of [
              undefined,
              null,
              42,
            ]) {
              await expect(
                updateVariantStock(
                  {
                    variantId:
                      variantId as unknown as string,
                    stock: 5,
                  },
                  client,
                ),
              ).rejects.toMatchObject(
                {
                  field:
                    'variantId',
                  message:
                    'Variante inválida',
                },
              )
            }

            for (const variantId of [
              '',
              '   ',
            ]) {
              await expect(
                updateVariantStock(
                  {
                    variantId,
                    stock: 5,
                  },
                  client,
                ),
              ).rejects.toMatchObject(
                {
                  field:
                    'variantId',
                  message:
                    'Variante é obrigatória',
                },
              )
            }

            expect(
              findUnique,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'rejeita stocks inválidos sem atualizar',
          async () => {
            for (const stock of [
              undefined,
              null,
              'abc',
              2.5,
            ]) {
              await expect(
                updateVariantStock(
                  {
                    variantId:
                      'variant-1',
                    stock: stock as unknown as number,
                  },
                  client,
                ),
              ).rejects.toMatchObject(
                {
                  field: 'stock',
                  message:
                    'O stock deve ser um número inteiro',
                },
              )
            }

            for (const stock of [
              -1,
              1000000,
            ]) {
              await expect(
                updateVariantStock(
                  {
                    variantId:
                      'variant-1',
                    stock: stock as number,
                  },
                  client,
                ),
              ).rejects.toMatchObject(
                {
                  field: 'stock',
                  message:
                    'O stock deve estar entre 0 e 999999',
                },
              )
            }

            expect(
              findUnique,
            ).not.toHaveBeenCalled()

            expect(
              update,
            ).not.toHaveBeenCalled()
          },
        )

        test(
          'aceita os limites válidos de stock (0 e 999999)',
          async () => {
            for (const stock of [
              0,
              999999,
            ]) {
              findUnique.mockResolvedValue(
                createVariantRecord(),
              )

              update.mockResolvedValue(
                createVariantRecord(
                  {
                    stockQuantity:
                      stock,
                  },
                ),
              )

              const result =
                await updateVariantStock(
                  {
                    variantId:
                      'variant-1',
                    stock,
                  },
                  client,
                )

              expect(
                result.variant.stock,
              ).toBe(stock)
            }
          },
        )
      },
    )
  },
)
