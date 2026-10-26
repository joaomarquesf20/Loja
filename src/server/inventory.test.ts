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
  DEFAULT_MOVEMENTS_PAGE_SIZE,
  InventoryNotFoundError,
  getInventoryOverview,
  inventoryOverviewQuerySchema,
  listLowStockVariants,
  listStockMovements,
  recordStockMovement,
  stockMovementsQuerySchema,
  updateVariantStock,
  type InventoryClient,
  type InventoryTransactionClient,
  type RawStockMovementRecord,
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

  // Épico 6 — histórico de movimentos dentro da transação.
  const stockMovementCreate =
    vi.fn(async () => ({
      id: 'movement-1',
    }))

  const stockMovementCount =
    vi.fn()

  const stockMovementFindMany =
    vi.fn()

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
        stockMovement: {
          create:
            stockMovementCreate,
          count:
            stockMovementCount,
          findMany:
            stockMovementFindMany,
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
    stockMovementCreate,
    stockMovementCount,
    stockMovementFindMany,
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

        test(
          'registra o movimento MANUAL_ADJUSTMENT na mesma transação quando o stock muda',
          async () => {
            const created =
              createClient()

            created.findUnique.mockResolvedValue(
              createVariantRecord({
                stockQuantity: 3,
              }),
            )

            created.update.mockResolvedValue(
              createVariantRecord({
                stockQuantity: 12,
              }),
            )

            await updateVariantStock(
              {
                variantId:
                  'variant-1',
                stock: 12,
              },
              created.client,
            )

            expect(
              created.stockMovementCreate,
            ).toHaveBeenCalledTimes(
              1,
            )

            expect(
              created.stockMovementCreate,
            ).toHaveBeenCalledWith({
              data: {
                variantId:
                  'variant-1',
                type:
                  'MANUAL_ADJUSTMENT',
                quantityChange: 9,
                previousStock: 3,
                newStock: 12,
                actorUserId: null,
              },
            })

            expect(
              created.$transaction,
            ).toHaveBeenCalledTimes(
              1,
            )
          },
        )

        test(
          'registra o admin autenticado como ator do movimento',
          async () => {
            const created =
              createClient()

            created.findUnique.mockResolvedValue(
              createVariantRecord({
                stockQuantity: 8,
              }),
            )

            created.update.mockResolvedValue(
              createVariantRecord({
                stockQuantity: 2,
              }),
            )

            await updateVariantStock(
              {
                variantId:
                  'variant-1',
                stock: 2,
              },
              created.client,
              'admin-test',
            )

            expect(
              created.stockMovementCreate,
            ).toHaveBeenCalledWith({
              data: {
                variantId:
                  'variant-1',
                type:
                  'MANUAL_ADJUSTMENT',
                quantityChange: -6,
                previousStock: 8,
                newStock: 2,
                actorUserId:
                  'admin-test',
              },
            })
          },
        )

        test(
          'não registra movimento quando o stock fica igual',
          async () => {
            const created =
              createClient()

            created.findUnique.mockResolvedValue(
              createVariantRecord({
                stockQuantity: 5,
              }),
            )

            created.update.mockResolvedValue(
              createVariantRecord({
                stockQuantity: 5,
              }),
            )

            await updateVariantStock(
              {
                variantId:
                  'variant-1',
                stock: 5,
              },
              created.client,
            )

            expect(
              created.stockMovementCreate,
            ).not.toHaveBeenCalled()
          },
        )
      },
    )
  },
)

describe(
  'Histórico de movimentos de stock (Épico 6 — etapa 2)',
  () => {
    function createRawMovement(
      overrides: Partial<
        RawStockMovementRecord
      > = {},
    ): RawStockMovementRecord {
      return {
        id: 'movement-1',
        type: 'RESTOCK',
        quantityChange: 8,
        previousStock: 2,
        newStock: 10,
        actorUserId:
          'admin-test',
        createdAt: new Date(
          '2026-10-01T10:30:00.000Z',
        ),
        productVariant: {
          id: 'variant-1',
          sku: 'FLT-001',
          product: {
            id: 'product-1',
            name: 'Filtro de óleo',
            slug: 'filtro-de-oleo',
          },
        },
        actorUser: {
          id: 'admin-test',
          email: 'admin@example.com',
        },
        ...overrides,
      }
    }

    describe(
      'recordStockMovement',
      () => {
        test(
          'grava o movimento com os valores antes/depois e o ator normalizado',
          async () => {
            const created =
              createClient()

            await created.client.$transaction(
              async (transaction) => {
                await recordStockMovement(
                  transaction,
                  {
                    variantId:
                      'variant-1',
                    type: 'SALE',
                    quantityChange: -2,
                    previousStock: 5,
                    newStock: 3,
                    actorUserId:
                      'user-1',
                  },
                )
              },
            )

            expect(
              created.stockMovementCreate,
            ).toHaveBeenCalledTimes(
              1,
            )

            expect(
              created.stockMovementCreate,
            ).toHaveBeenCalledWith({
              data: {
                variantId:
                  'variant-1',
                type: 'SALE',
                quantityChange: -2,
                previousStock: 5,
                newStock: 3,
                actorUserId:
                  'user-1',
              },
            })
          },
        )

        test(
          'grava a referência do ator como null quando não há utilizador',
          async () => {
            const created =
              createClient()

            await created.client.$transaction(
              async (transaction) => {
                await recordStockMovement(
                  transaction,
                  {
                    variantId:
                      'variant-2',
                    type: 'RESTOCK',
                    quantityChange: 10,
                    previousStock: 0,
                    newStock: 10,
                    actorUserId:
                      null,
                  },
                )
              },
            )

            expect(
              created.stockMovementCreate,
            ).toHaveBeenCalledWith({
              data: {
                variantId:
                  'variant-2',
                type: 'RESTOCK',
                quantityChange: 10,
                previousStock: 0,
                newStock: 10,
                actorUserId: null,
              },
            })
          },
        )

        test(
          'propaga a falha do registo ao chamador (a transação é revertida em conjunto)',
          async () => {
            const created =
              createClient()

            created.stockMovementCreate.mockRejectedValueOnce(
              new Error(
                'falha no registo do movimento',
              ),
            )

            await expect(
              created.client.$transaction(
                async (
                  transaction,
                ) => {
                  await recordStockMovement(
                    transaction,
                    {
                      variantId:
                        'variant-1',
                      type: 'SALE',
                      quantityChange: -1,
                      previousStock: 5,
                      newStock: 4,
                      actorUserId:
                        null,
                    },
                  )
                },
              ),
            ).rejects.toThrow(
              'falha no registo do movimento',
            )
          },
        )
      },
    )

    describe(
      'stockMovementsQuerySchema',
      () => {
        test(
          'aplica a paginação padrão quando ausente ou vazia',
          () => {
            for (const input of [
              {},
              {
                page: '',
                pageSize: '',
              },
            ]) {
              expect(
                stockMovementsQuerySchema.parse(
                  input,
                ),
              ).toEqual({
                page: 1,
                pageSize:
                  DEFAULT_MOVEMENTS_PAGE_SIZE,
              })
            }
          },
        )

        test(
          'aceita todos os tipos de movimento declarados',
          () => {
            for (const type of [
              'RESTOCK',
              'SALE',
              'MANUAL_ADJUSTMENT',
              'RETURN',
            ] as const) {
              expect(
                stockMovementsQuerySchema.parse(
                  { type },
                ),
              ).toEqual({
                type,
                page: 1,
                pageSize:
                  DEFAULT_MOVEMENTS_PAGE_SIZE,
              })
            }
          },
        )

        test(
          'trima o SKU e ignora filtros vazios',
          () => {
            expect(
              stockMovementsQuerySchema.parse(
                {
                  sku: '  FLT-001  ',
                  type: '',
                  from: '',
                },
              ),
            ).toEqual({
              sku: 'FLT-001',
              page: 1,
              pageSize:
                DEFAULT_MOVEMENTS_PAGE_SIZE,
            })
          },
        )

        test(
          'rejeita tipos desconhecidos e datas malformadas',
          () => {
            for (const input of [
              { type: 'MAGIC' },
              { from: 'hoje' },
              { to: '2026-13-10' },
              { from: '10/2026' },
            ]) {
              expect(() =>
                stockMovementsQuerySchema.parse(
                  input,
                ),
              ).toThrow(ZodError)
            }
          },
        )

        test(
          'rejeita página e pageSize fora dos limites',
          () => {
            for (const input of [
              { page: 0 },
              { page: -1 },
              { page: 'abc' },
              { page: '2.5' },
              { pageSize: 0 },
              { pageSize: 101 },
              { pageSize: '1.5' },
            ]) {
              expect(() =>
                stockMovementsQuerySchema.parse(
                  input,
                ),
              ).toThrow(ZodError)
            }
          },
        )

        test(
          'rejeita data inicial posterior à data final',
          () => {
            expect(() =>
              stockMovementsQuerySchema.parse(
                {
                  from: '2026-10-10',
                  to: '2026-10-01',
                },
              ),
            ).toThrow(
              /A data inicial não pode ser posterior à data final/,
            )
          },
        )
      },
    )

    describe(
      'listStockMovements',
      () => {
        let client: InventoryClient

        let stockMovementCount:
          ReturnType<
            typeof vi.fn
          >

        let stockMovementFindMany:
          ReturnType<
            typeof vi.fn
          >

        let $transaction:
          ReturnType<
            typeof vi.fn
          >

        beforeEach(() => {
          const created =
            createClient()

          client =
            created.client

          stockMovementCount =
            created.stockMovementCount

          stockMovementFindMany =
            created.stockMovementFindMany

          $transaction =
            created.$transaction
        })

        test(
          'conta e lista na mesma transação com os filtros de tipo, SKU e datas',
          async () => {
            stockMovementCount.mockResolvedValue(
              3,
            )

            stockMovementFindMany.mockResolvedValue(
              [
                createRawMovement(),
              ],
            )

            const result =
              await listStockMovements(
                {
                  type: 'SALE',
                  sku: '  flt-001  ',
                  from: '2026-09-01',
                  to: '2026-09-30',
                },
                client,
              )

            // Contagem e listagem no MESMO snapshot.
            expect(
              $transaction,
            ).toHaveBeenCalledTimes(
              1,
            )

            expect(
              stockMovementCount,
            ).toHaveBeenNthCalledWith(
              1,
              {
                where: {
                  type: 'SALE',
                  productVariant: {
                    sku: {
                      contains:
                        'flt-001',
                      mode: 'insensitive',
                    },
                  },
                  createdAt: {
                    gte: new Date(
                      '2026-09-01T00:00:00.000Z',
                    ),
                    lte: new Date(
                      '2026-09-30T23:59:59.999Z',
                    ),
                  },
                },
              },
            )

            expect(
              stockMovementFindMany,
            ).toHaveBeenCalledWith({
              where: {
                type: 'SALE',
                productVariant: {
                  sku: {
                    contains:
                      'flt-001',
                    mode: 'insensitive',
                  },
                },
                createdAt: {
                  gte: new Date(
                    '2026-09-01T00:00:00.000Z',
                  ),
                  lte: new Date(
                    '2026-09-30T23:59:59.999Z',
                  ),
                },
              },
              orderBy: [
                {
                  createdAt:
                    'desc',
                },
                { id: 'desc' },
              ],
              skip: 0,
              take: DEFAULT_MOVEMENTS_PAGE_SIZE,
              select:
                expect.anything(),
            })

            expect(
              result,
            ).toEqual({
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
              total: 3,
              page: 1,
              pageSize:
                DEFAULT_MOVEMENTS_PAGE_SIZE,
              totalPages: 1,
            })
          },
        )

        test(
          'filtra apenas pelo tipo quando não há datas nem SKU',
          async () => {
            stockMovementCount.mockResolvedValue(
              0,
            )

            stockMovementFindMany.mockResolvedValue(
              [],
            )

            const result =
              await listStockMovements(
                { type: 'RETURN' },
                client,
              )

            expect(
              stockMovementCount,
            ).toHaveBeenCalledWith({
              where: {
                type: 'RETURN',
              },
            })

            expect(result).toEqual({
              movements: [],
              total: 0,
              page: 1,
              pageSize:
                DEFAULT_MOVEMENTS_PAGE_SIZE,
              totalPages: 1,
            })
          },
        )

        test(
          'aplica o teto da última página a pedidos além do fim',
          async () => {
            stockMovementCount.mockResolvedValue(
              120,
            )

            stockMovementFindMany.mockResolvedValue(
              [],
            )

            const result =
              await listStockMovements(
                { page: 99 },
                client,
              )

            expect(result.page).toBe(
              3,
            )

            expect(
              result.totalPages,
            ).toBe(3)

            expect(
              stockMovementFindMany,
            ).toHaveBeenCalledWith(
              expect.objectContaining(
                {
                  skip: 100,
                  take: DEFAULT_MOVEMENTS_PAGE_SIZE,
                },
              ),
            )
          },
        )

        test(
          'mapeia o ator ausente para email null',
          async () => {
            stockMovementCount.mockResolvedValue(
              1,
            )

            stockMovementFindMany.mockResolvedValue(
              [
                createRawMovement({
                  actorUserId: null,
                  actorUser: null,
                }),
              ],
            )

            const result =
              await listStockMovements(
                undefined,
                client,
              )

            expect(
              result.movements[0]
                .actorEmail,
            ).toBeNull()
          },
        )

        test(
          'rejeita queries inválidas com ZodError antes de tocar na base de dados',
          async () => {
            for (const input of [
              { type: 'MAGIC' },
              { from: 'hoje' },
              { from: '2026-10-10', to: '2026-10-01' },
              { page: 'abc' },
            ]) {
              await expect(
                listStockMovements(
                  input,
                  client,
                ),
              ).rejects.toThrow(
                ZodError,
              )
            }

            expect(
              stockMovementCount,
            ).not.toHaveBeenCalled()

            expect(
              stockMovementFindMany,
            ).not.toHaveBeenCalled()
          },
        )
      },
    )
  },
)
