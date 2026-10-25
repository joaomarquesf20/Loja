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
  getInventoryOverview,
  inventoryOverviewQuerySchema,
  listLowStockVariants,
  updateVariantStock,
  type InventoryClient,
  type InventoryTransactionClient,
  type VariantRecord,
} from './inventory'
import { ZodError } from 'zod'

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

  const count = vi.fn()

  // Tipagem funcional do `$transaction` (padrão de admin-users.test):
  // o callback recebe diretamente o fake client de transação.
  const $transaction = vi.fn(
    (
      callback: (
        transaction: InventoryTransactionClient,
      ) => Promise<unknown>,
    ) =>
      callback({
        productVariant: {
          findMany,
          findUnique,
          update,
          count,
        },
      }),
  )

  const client: InventoryClient =
    {
      productVariant: {
        findMany,
        findUnique,
        update,
      },
      $transaction: $transaction as unknown as
        InventoryClient['$transaction'],
    }

  return {
    client,
    findMany,
    findUnique,
    update,
    count,
    $transaction,
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

describe(
  'Inventário — vista de administração e transações (Épico 6)',
  () => {
    function overviewRowsFor(
      threshold: number,
    ) {
      return [
        createVariantRecord({
          id: 'variant-ruptura',
          sku: 'AAA-001',
          stockQuantity: 0,
        }),
        createVariantRecord({
          id: 'variant-baixo',
          sku: 'BBB-002',
          stockQuantity: 2,
        }),
        createVariantRecord({
          id: 'variant-limite',
          sku: 'CCC-003',
          stockQuantity: threshold,
        }),
        createVariantRecord({
          id: 'variant-disponivel',
          sku: 'DDD-004',
          stockQuantity:
            threshold + 1,
        }),
      ]
    }

    describe(
      'inventoryOverviewQuerySchema',
      () => {
        test(
          'aplica o limiar padrão com entradas ausentes ou vazias',
          () => {
            for (const value of [
              undefined,
              null,
              '',
              '   ',
            ]) {
              expect(
                inventoryOverviewQuerySchema.parse(
                  {
                    threshold:
                      value,
                  },
                ),
              ).toEqual({
                threshold:
                  DEFAULT_LOW_STOCK_THRESHOLD,
              })
            }
          },
        )

        test(
          'aceita inteiros escritos como texto dentro dos limites',
          () => {
            expect(
              inventoryOverviewQuerySchema.parse(
                { threshold: '7' },
              ),
            ).toEqual({
              threshold: 7,
            })

            expect(
              inventoryOverviewQuerySchema.parse(
                { threshold: 99 },
              ),
            ).toEqual({
              threshold: 99,
            })
          },
        )

        test(
          'rejeita texto não numérico e frações',
          () => {
            for (const value of [
              'abc',
              '2.5',
              2.5,
            ]) {
              expect(() =>
                inventoryOverviewQuerySchema.parse(
                  {
                    threshold:
                      value,
                  },
                ),
              ).toThrow(
                ZodError,
              )
            }
          },
        )

        test(
          'rejeita limiares fora de [1, 99]',
          () => {
            for (const value of [
              0,
              -3,
              100,
              '0',
              '100',
            ]) {
              expect(() =>
                inventoryOverviewQuerySchema.parse(
                  {
                    threshold:
                      value,
                  },
                ),
              ).toThrow(
                ZodError,
              )
            }
          },
        )
      },
    )

    describe(
      'getInventoryOverview',
      () => {
        let client: InventoryClient
        let count: ReturnType<
          typeof vi.fn
        >
        let findMany: ReturnType<
          typeof vi.fn
        >

        beforeEach(() => {
          const created =
            createClient()

          client =
            created.client

          count =
            created.count

          findMany =
            created.findMany
        })

        function stubCounts({
          total,
          low,
          out,
        }: {
          total: number
          low: number
          out: number
        }) {
          count
            .mockResolvedValueOnce(
              total,
            )
            .mockResolvedValueOnce(
              low,
            )
            .mockResolvedValueOnce(
              out,
            )

          findMany.mockResolvedValue(
            [],
          )
        }

        test(
          'devolve os KPIs da vista com o snapshot numa única transação',
          async () => {
            stubCounts({
              total: 50,
              low: 8,
              out: 3,
            })

            const result =
              await getInventoryOverview(
                undefined,
                client,
              )

            expect(result.kpis).toEqual(
              {
                totalSkus: 50,
                inStockCount: 39,
                lowStockCount: 8,
                outOfStockCount: 3,
              },
            )

            expect(
              result.threshold,
            ).toBe(
              DEFAULT_LOW_STOCK_THRESHOLD,
            )

            // Três contadores (total, stock baixo, sem stock).
            expect(
              count,
            ).toHaveBeenCalledTimes(
              3,
            )

            expect(
              count,
            ).toHaveBeenNthCalledWith(
              1,
              {
                where: {
                  isActive: true,
                  product: {
                    isActive: true,
                  },
                },
              },
            )

            expect(
              count,
            ).toHaveBeenNthCalledWith(
              2,
              {
                where: {
                  isActive: true,
                  product: {
                    isActive: true,
                  },
                  stockQuantity: {
                    gte: 1,
                    lte: DEFAULT_LOW_STOCK_THRESHOLD,
                  },
                },
              },
            )

            expect(
              count,
            ).toHaveBeenNthCalledWith(
              3,
              {
                where: {
                  isActive: true,
                  product: {
                    isActive: true,
                  },
                  stockQuantity: 0,
                },
              },
            )
          },
        )

        test(
          'calcula o estado de cada variante a partir do limiar',
          async () => {
            count.mockResolvedValue(
              4,
            )

            findMany.mockResolvedValue(
              overviewRowsFor(
                DEFAULT_LOW_STOCK_THRESHOLD,
              ),
            )

            const result =
              await getInventoryOverview(
                undefined,
                client,
              )

            expect(
              result.variants,
            ).toEqual([
              expect.objectContaining(
                {
                  variantId:
                    'variant-ruptura',
                  status:
                    'OUT_OF_STOCK',
                },
              ),
              expect.objectContaining(
                {
                  variantId:
                    'variant-baixo',
                  status:
                    'LOW_STOCK',
                },
              ),
              expect.objectContaining(
                {
                  variantId:
                    'variant-limite',
                  status:
                    'LOW_STOCK',
                },
              ),
              expect.objectContaining(
                {
                  variantId:
                    'variant-disponivel',
                  status:
                    'IN_STOCK',
                },
              ),
            ])
          },
        )

        test(
          'limiar configurado altera os contadores e os estados',
          async () => {
            count
              .mockResolvedValueOnce(
                4,
              )
              .mockResolvedValueOnce(
                3,
              )
              .mockResolvedValueOnce(
                1,
              )

            findMany.mockResolvedValue(
              overviewRowsFor(10),
            )

            const result =
              await getInventoryOverview(
                { threshold: 10 },
                client,
              )

            expect(
              result.threshold,
            ).toBe(10)

            expect(
              result.kpis,
            ).toEqual({
              totalSkus: 4,
              inStockCount: 0,
              lowStockCount: 3,
              outOfStockCount: 1,
            })

            // O stock baixo passa a cobrir 1..10.
            expect(
              count,
            ).toHaveBeenNthCalledWith(
              2,
              {
                where: {
                  isActive: true,
                  product: {
                    isActive: true,
                  },
                  stockQuantity: {
                    gte: 1,
                    lte: 10,
                  },
                },
              },
            )

            const statuses =
              Object.fromEntries(
                result.variants.map(
                  (row) => [
                    row.variantId,
                    row.status,
                  ],
                ),
              )

            expect(
              statuses,
            ).toEqual({
              'variant-ruptura':
                'OUT_OF_STOCK',
              'variant-baixo':
                'LOW_STOCK',
              'variant-limite':
                'LOW_STOCK',
              'variant-disponivel':
                'IN_STOCK',
            })
          },
        )

        test(
          'limita a listagem ao teto de variantes por consulta',
          async () => {
            stubCounts({
              total: 1000,
              low: 0,
              out: 0,
            })

            await getInventoryOverview(
              undefined,
              client,
            )

            expect(
              findMany,
            ).toHaveBeenCalledWith(
              expect.objectContaining(
                {
                  take: 1000,
                  orderBy: [
                    {
                      stockQuantity:
                        'asc',
                    },
                    {
                      sku: 'asc',
                    },
                  ],
                },
              ),
            )
          },
        )

        test(
          'rejeita limiares inválidos com ZodError antes de tocar na base de dados',
          async () => {
            for (const threshold of [
              'abc',
              0,
              100,
            ]) {
              await expect(
                getInventoryOverview(
                  {
                    threshold,
                  },
                  client,
                ),
              ).rejects.toThrow(
                ZodError,
              )
            }

            expect(
              count,
            ).not.toHaveBeenCalled()

            expect(
              findMany,
            ).not.toHaveBeenCalled()
          },
        )
      },
    )

    describe(
      'updateVariantStock — transação',
      () => {
        test(
          'a leitura do stock anterior e a escrita correm na mesma transação',
          async () => {
            const created =
              createClient()

            created.findUnique.mockResolvedValue(
              createVariantRecord({
                stockQuantity: 3,
              }),
            )

            created.update.mockResolvedValueOnce(
              createVariantRecord({
                stockQuantity: 9,
              }),
            )

            const result =
              await updateVariantStock(
                {
                  variantId:
                    'variant-1',
                  stock: 9,
                },
                created.client,
              )

            expect(
              created.$transaction,
            ).toHaveBeenCalledTimes(
              1,
            )

            expect(
              result,
            ).toEqual({
              previousStock: 3,
              variant:
                expect.objectContaining(
                  {
                    variantId:
                      'variant-1',
                    stock: 9,
                  },
                ),
            })

            expect(
              created.findUnique,
            ).toHaveBeenCalledTimes(
              1,
            )

            expect(
              created.update,
            ).toHaveBeenCalledTimes(
              1,
            )
          },
        )

        test(
          'transação tem acesso aos contadores e à listagem completos',
          async () => {
            const created =
              createClient()

            created.count.mockResolvedValue(
              7,
            )

            created.findMany.mockResolvedValueOnce(
              [
                createVariantRecord(),
              ],
            )

            const result =
              await created.client.$transaction(
                async (transaction) => {
                  const total =
                    await transaction.productVariant.count(
                      {
                        where: {
                          isActive: true,
                          product: {
                            isActive:
                              true,
                          },
                        },
                      },
                    )

                  const rows =
                    await transaction.productVariant.findMany(
                      {
                        where: {
                          isActive: true,
                          product: {
                            isActive:
                              true,
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
                        take: 5,
                        select: {
                          id: true,
                          sku: true,
                          stockQuantity:
                            true,
                          product: {
                            select: {
                              id: true,
                              name: true,
                              slug: true,
                            },
                          },
                        },
                      },
                    )

                  return {
                    total,
                    rows,
                  }
                },
              )

            expect(result.total).toBe(
              7,
            )

            expect(
              result.rows,
            ).toHaveLength(1)
          },
        )
      },
    )
  },
)
