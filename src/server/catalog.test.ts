import {
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  CatalogClient,
  getCatalogCategoryPageBySlug,
  getCatalogProductBySlug,
  listCatalogCategories,
  listCatalogProducts,
} from './catalog'

type TestCatalogClient =
  CatalogClient & {
    productVehicleCompatibility: NonNullable<
      CatalogClient['productVehicleCompatibility']
    >
  }

function createClient(): TestCatalogClient {
  return {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    productBrand: {
      findMany: vi.fn(
        async () => [],
      ),
    },
    productVehicleCompatibility: {
      findMany: vi.fn(
        async () => [],
      ),
    },
  }
}

describe('Catalog', () => {
  describe('listCatalogProducts', () => {
    test('usa preço e stock da variante default após o checkout', async () => {
      const client = createClient()
      client.productVariant = {
        findMany: vi.fn().mockResolvedValue([
          {
            productId: 'product-1',
            sku: 'VAR-001',
            price: '24.50',
            stockQuantity: 0,
            isActive: true,
            images: [],
          },
        ]),
      }

      vi.mocked(client.product.findMany).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: '19.99',
          stockQuantity: 5,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: null,
        },
      ])

      const [product] = await listCatalogProducts(client)

      expect(product).toMatchObject({
        price: 24.5,
        inStock: false,
      })
    })

    test('consulta apenas produtos ativos', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await listCatalogProducts(client)

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          stockQuantity: true,
          images: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })
    })

    test('transforma produto no modelo público', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: 'Descrição',
          price: '19.99',
          stockQuantity: 5,
          images: [
            '/products/produto-1.jpg',
          ],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: {
            id: 'brand-1',
            name: 'Marca 1',
            slug: 'marca-1',
          },
        },
      ])

      const result =
        await listCatalogProducts(client)

      expect(result).toEqual([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: 'Descrição',
          price: 19.99,
          inStock: true,
          images: [
            '/products/produto-1.jpg',
          ],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: {
            id: 'brand-1',
            name: 'Marca 1',
            slug: 'marca-1',
          },
        },
      ])
    })

    test('produto sem stock devolve inStock false', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: 10,
          stockQuantity: 0,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: null,
        },
      ])

      const result =
        await listCatalogProducts(client)

      expect(
        result[0]?.inStock,
      ).toBe(false)

      expect(
        result[0]?.brand,
      ).toBeNull()

      expect(
        result[0]?.images,
      ).toEqual([])
    })

    test('não expõe stockQuantity no modelo público', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: 10,
          stockQuantity: 37,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: null,
        },
      ])

      const [product] =
        await listCatalogProducts(client)

      expect(product).not.toHaveProperty(
        'stockQuantity',
      )

      expect(product?.inStock).toBe(true)
    })
  })

  describe('getCatalogProductBySlug', () => {
    test('mostra SKU e preço da variante default', async () => {
      const client = createClient()
      client.productVariant = {
        findMany: vi.fn().mockResolvedValue([
          {
            productId: 'product-1',
            sku: 'VAR-001',
            price: '29.90',
            stockQuantity: 1,
            isActive: true,
            images: ['/variant.jpg'],
          },
        ]),
      }

      vi.mocked(client.product.findFirst).mockResolvedValue({
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        sku: 'SKU-001',
        description: null,
        price: '19.90',
        stockQuantity: 0,
        images: [],
        category: {
          id: 'category-1',
          name: 'Categoria 1',
          slug: 'categoria-1',
        },
        brand: null,
      })

      const product = await getCatalogProductBySlug(
        'produto-1',
        client,
      )

      expect(product).toMatchObject({
        sku: 'VAR-001',
        price: 29.9,
        inStock: true,
        images: ['/variant.jpg'],
      })
    })

    test('procura apenas produto ativo pelo slug', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue(null)

      await getCatalogProductBySlug(
        'produto-1',
        client,
      )

      expect(
        client.product.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          slug: 'produto-1',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          description: true,
          price: true,
          stockQuantity: true,
          images: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })
    })

    test('devolve detalhe público do produto', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue({
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        sku: 'SKU-001',
        description: 'Descrição',
        price: '49.90',
        stockQuantity: 2,
        images: [
          '/products/produto-1.jpg',
        ],
        category: {
          id: 'category-1',
          name: 'Categoria 1',
          slug: 'categoria-1',
        },
        brand: {
          id: 'brand-1',
          name: 'Marca 1',
          slug: 'marca-1',
        },
      })

      const result =
        await getCatalogProductBySlug(
          'produto-1',
          client,
        )

      expect(result).toEqual({
        id: 'product-1',
        name: 'Produto 1',
        slug: 'produto-1',
        sku: 'SKU-001',
        description: 'Descrição',
        price: 49.9,
        inStock: true,
        images: [
          '/products/produto-1.jpg',
        ],
        category: {
          id: 'category-1',
          name: 'Categoria 1',
          slug: 'categoria-1',
        },
        brand: {
          id: 'brand-1',
          name: 'Marca 1',
          slug: 'marca-1',
        },
      })

      expect(result).not.toHaveProperty(
        'stockQuantity',
      )
    })

    test('devolve null quando produto não existe ou está inativo', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findFirst,
      ).mockResolvedValue(null)

      const result =
        await getCatalogProductBySlug(
          'produto-inexistente',
          client,
        )

      expect(result).toBeNull()
    })

    test('slug vazio devolve null sem consultar a base de dados', async () => {
      const client = createClient()

      const result =
        await getCatalogProductBySlug(
          '   ',
          client,
        )

      expect(result).toBeNull()

      expect(
        client.product.findFirst,
      ).not.toHaveBeenCalled()
    })
  })

  describe('getCatalogCategoryPageBySlug', () => {
    test('filtra stock e preço e ordena pelo preço das variantes default', async () => {
      const client = createClient()
      client.productVariant = {
        findMany: vi.fn().mockResolvedValue([
          {
            productId: 'product-a',
            sku: 'VAR-A',
            price: '10.00',
            stockQuantity: 0,
            isActive: true,
            images: [],
          },
          {
            productId: 'product-b',
            sku: 'VAR-B',
            price: '30.00',
            stockQuantity: 2,
            isActive: true,
            images: [],
          },
          {
            productId: 'product-c',
            sku: 'VAR-C',
            price: '20.00',
            stockQuantity: 2,
            isActive: true,
            images: [],
          },
        ]),
      }

      vi.mocked(client.category.findMany).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: { products: 3 },
        },
      ])

      vi.mocked(client.product.findMany).mockResolvedValue(
        ['a', 'b', 'c'].map((letter) => ({
          id: `product-${letter}`,
          name: `Produto ${letter}`,
          slug: `produto-${letter}`,
          description: null,
          price: '100.00',
          stockQuantity: 10,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: null,
        })),
      )

      const page = await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          inStockOnly: true,
          priceMin: 20,
          sort: 'price-asc',
        },
        client,
      )

      expect(client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: { in: ['category-1'] },
          },
          orderBy: { name: 'asc' },
        }),
      )
      expect(page?.products.map((product) => product.id)).toEqual([
        'product-c',
        'product-b',
      ])
    })

    test('slug vazio devolve null sem consultar a base de dados', async () => {
      const client = createClient()

      const result =
        await getCatalogCategoryPageBySlug(
          '   ',
          client,
        )

      expect(result).toBeNull()

      expect(
        client.category.findMany,
      ).not.toHaveBeenCalled()

      expect(
        client.product.findMany,
      ).not.toHaveBeenCalled()

      expect(
        client.productBrand.findMany,
      ).not.toHaveBeenCalled()

      expect(
        client.productVehicleCompatibility
          .findMany,
      ).not.toHaveBeenCalled()
    })

    test('devolve null quando categoria não existe', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'inexistente',
          client,
        )

      expect(result).toBeNull()

      expect(
        client.product.findMany,
      ).not.toHaveBeenCalled()

      expect(
        client.productBrand.findMany,
      ).not.toHaveBeenCalled()

      expect(
        client.productVehicleCompatibility
          .findMany,
      ).not.toHaveBeenCalled()
    })

    test('inclui produtos das subcategorias', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'root',
          parentId: null,
          name: 'Raiz',
          slug: 'raiz',
          description: 'Categoria principal',
          _count: {
            products: 0,
          },
        },
        {
          id: 'child',
          parentId: 'root',
          name: 'Filha',
          slug: 'filha',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'grandchild',
          parentId: 'child',
          name: 'Neta',
          slug: 'neta',
          description: null,
          _count: {
            products: 1,
          },
        },
        {
          id: 'other',
          parentId: null,
          name: 'Outra',
          slug: 'outra',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: '25.50',
          stockQuantity: 3,
          images: [],
          category: {
            id: 'grandchild',
            name: 'Neta',
            slug: 'neta',
          },
          brand: null,
        },
      ])

      const result =
        await getCatalogCategoryPageBySlug(
          'raiz',
          client,
        )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith({
        where: {
          isActive: true,
          categoryId: {
            in: [
              'root',
              'child',
              'grandchild',
            ],
          },
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          stockQuantity: true,
          images: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      expect(result).toEqual({
        category: {
          id: 'root',
          parentId: null,
          name: 'Raiz',
          slug: 'raiz',
          description: 'Categoria principal',
        },
        brands: [],
        vehicleConfigurations: [],
        products: [
          {
            id: 'product-1',
            name: 'Produto 1',
            slug: 'produto-1',
            description: null,
            price: 25.5,
            inStock: true,
            images: [],
            category: {
              id: 'grandchild',
              name: 'Neta',
              slug: 'neta',
            },
            brand: null,
          },
        ],
      })
    })

    test('lista marcas com produtos ativos na árvore da categoria', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'root',
          parentId: null,
          name: 'Raiz',
          slug: 'raiz',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'child',
          parentId: 'root',
          name: 'Filha',
          slug: 'filha',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.productBrand.findMany,
      ).mockResolvedValue([
        {
          id: 'brand-a',
          name: 'Marca A',
          slug: 'marca-a',
        },
        {
          id: 'brand-b',
          name: 'Marca B',
          slug: 'marca-b',
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'raiz',
          client,
        )

      expect(
        client.productBrand.findMany,
      ).toHaveBeenCalledWith({
        where: {
          products: {
            some: {
              isActive: true,
              categoryId: {
                in: [
                  'root',
                  'child',
                ],
              },
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      })

      expect(result?.brands).toEqual([
        {
          id: 'brand-a',
          name: 'Marca A',
          slug: 'marca-a',
        },
        {
          id: 'brand-b',
          name: 'Marca B',
          slug: 'marca-b',
        },
      ])
    })

    test('lista configurações compatíveis com produtos ativos da árvore da categoria', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'root',
          parentId: null,
          name: 'Raiz',
          slug: 'raiz',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'child',
          parentId: 'root',
          name: 'Filha',
          slug: 'filha',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.productVehicleCompatibility
          .findMany,
      ).mockResolvedValue([
        {
          vehicleConfiguration: {
            id: 'configuration-1',
            name: '2.0 TDI',
            engineCode: 'CFFB',
            engineType: 'Diesel',
            displacementCc: 1968,
            powerKw: '103.5',
            bodyType: 'Hatchback',
            yearFrom: 2010,
            yearTo: 2014,
            generation: {
              id: 'generation-1',
              name: 'Mk6',
              model: {
                id: 'model-1',
                name: 'Golf',
                brand: {
                  id: 'vehicle-brand-1',
                  name: 'Volkswagen',
                },
              },
            },
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'raiz',
          client,
        )

      expect(
        client.productVehicleCompatibility
          .findMany,
      ).toHaveBeenCalledWith({
        where: {
          product: {
            isActive: true,
            categoryId: {
              in: [
                'root',
                'child',
              ],
            },
          },
          vehicleConfigurationId: {
            not: null,
          },
        },
        select: {
          vehicleConfiguration: {
            select: {
              id: true,
              name: true,
              engineCode: true,
              engineType: true,
              displacementCc: true,
              powerKw: true,
              bodyType: true,
              yearFrom: true,
              yearTo: true,
              generation: {
                select: {
                  id: true,
                  name: true,
                  model: {
                    select: {
                      id: true,
                      name: true,
                      brand: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      expect(
        result?.vehicleConfigurations,
      ).toEqual([
        {
          id: 'configuration-1',
          name: '2.0 TDI',
          engineCode: 'CFFB',
          engineType: 'Diesel',
          displacementCc: 1968,
          powerKw: 103.5,
          bodyType: 'Hatchback',
          yearFrom: 2010,
          yearTo: 2014,
          generation: {
            id: 'generation-1',
            name: 'Mk6',
            model: {
              id: 'model-1',
              name: 'Golf',
              brand: {
                id: 'vehicle-brand-1',
                name: 'Volkswagen',
              },
            },
          },
        },
      ])
    })

    test('remove configurações de veículo duplicadas', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      const duplicatedConfiguration = {
        id: 'configuration-1',
        name: '1.9 TDI',
        engineCode: 'BKC',
        engineType: 'Diesel',
        displacementCc: 1896,
        powerKw: 77,
        bodyType: null,
        yearFrom: 2004,
        yearTo: 2008,
        generation: {
          id: 'generation-1',
          name: 'Mk5',
          model: {
            id: 'model-1',
            name: 'Golf',
            brand: {
              id: 'vehicle-brand-1',
              name: 'Volkswagen',
            },
          },
        },
      }

      vi.mocked(
        client.productVehicleCompatibility
          .findMany,
      ).mockResolvedValue([
        {
          vehicleConfiguration:
            duplicatedConfiguration,
        },
        {
          vehicleConfiguration:
            duplicatedConfiguration,
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          client,
        )

      expect(
        result?.vehicleConfigurations,
      ).toHaveLength(1)

      expect(
        result?.vehicleConfigurations[0]?.id,
      ).toBe('configuration-1')
    })

    test('ignora compatibilidades sem configuração de veículo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.productVehicleCompatibility
          .findMany,
      ).mockResolvedValue([
        {
          vehicleConfiguration: null,
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          client,
        )

      expect(
        result?.vehicleConfigurations,
      ).toEqual([])
    })

    test('ordena configurações por marca, modelo, geração e configuração', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 3,
          },
        },
      ])

      vi.mocked(
        client.productVehicleCompatibility
          .findMany,
      ).mockResolvedValue([
        {
          vehicleConfiguration: {
            id: 'configuration-z',
            name: '2.0',
            engineCode: null,
            engineType: null,
            displacementCc: null,
            powerKw: null,
            bodyType: null,
            yearFrom: null,
            yearTo: null,
            generation: {
              id: 'generation-z',
              name: 'Zeta',
              model: {
                id: 'model-z',
                name: 'Modelo Z',
                brand: {
                  id: 'brand-z',
                  name: 'Volkswagen',
                },
              },
            },
          },
        },
        {
          vehicleConfiguration: {
            id: 'configuration-a',
            name: '1.0',
            engineCode: null,
            engineType: null,
            displacementCc: null,
            powerKw: null,
            bodyType: null,
            yearFrom: null,
            yearTo: null,
            generation: {
              id: 'generation-a',
              name: 'Alpha',
              model: {
                id: 'model-a',
                name: 'A3',
                brand: {
                  id: 'brand-a',
                  name: 'Audi',
                },
              },
            },
          },
        },
        {
          vehicleConfiguration: {
            id: 'configuration-b',
            name: '1.5',
            engineCode: null,
            engineType: null,
            displacementCc: null,
            powerKw: null,
            bodyType: null,
            yearFrom: null,
            yearTo: null,
            generation: {
              id: 'generation-b',
              name: 'Beta',
              model: {
                id: 'model-b',
                name: 'Golf',
                brand: {
                  id: 'brand-b',
                  name: 'Volkswagen',
                },
              },
            },
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          client,
        )

      expect(
        result?.vehicleConfigurations.map(
          (configuration) =>
            configuration.id,
        ),
      ).toEqual([
        'configuration-a',
        'configuration-b',
        'configuration-z',
      ])
    })

    test('filtra produtos pelas marcas selecionadas', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.productBrand.findMany,
      ).mockResolvedValue([
        {
          id: 'brand-a',
          name: 'Marca A',
          slug: 'marca-a',
        },
        {
          id: 'brand-b',
          name: 'Marca B',
          slug: 'marca-b',
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-b',
          name: 'Produto B',
          slug: 'produto-b',
          description: null,
          price: 30,
          stockQuantity: 5,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: {
            id: 'brand-b',
            name: 'Marca B',
            slug: 'marca-b',
          },
        },
      ])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          {
            brandSlugs: [
              'marca-b',
            ],
          },
          client,
        )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            productBrandId: {
              in: ['brand-b'],
            },
          },
        }),
      )

      expect(
        result?.products,
      ).toHaveLength(1)

      expect(
        result?.products[0]?.brand?.slug,
      ).toBe('marca-b')
    })

    test('combina filtros de marca e stock', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.productBrand.findMany,
      ).mockResolvedValue([
        {
          id: 'brand-a',
          name: 'Marca A',
          slug: 'marca-a',
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          inStockOnly: true,
          brandSlugs: [
            'marca-a',
          ],
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            stockQuantity: {
              gt: 0,
            },
            productBrandId: {
              in: ['brand-a'],
            },
          },
        }),
      )
    })

    test('ordena produtos por nome ascendente', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          sort: 'name-asc',
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            name: 'asc',
          },
        }),
      )
    })

    test('ordena produtos por nome descendente', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          sort: 'name-desc',
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            name: 'desc',
          },
        }),
      )
    })

    test('ordena produtos por preço ascendente com nome como desempate', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          sort: 'price-asc',
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            {
              price: 'asc',
            },
            {
              name: 'asc',
            },
          ],
        }),
      )
    })

    test('ordena produtos por preço descendente com nome como desempate', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          sort: 'price-desc',
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            {
              price: 'desc',
            },
            {
              name: 'asc',
            },
          ],
        }),
      )
    })

    test('filtra produtos por preço mínimo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          priceMin: 25,
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            price: {
              gte: 25,
            },
          },
        }),
      )
    })

    test('filtra produtos por preço máximo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          priceMax: 75,
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            price: {
              lte: 75,
            },
          },
        }),
      )
    })

    test('combina intervalo de preço com marca e stock', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.productBrand.findMany,
      ).mockResolvedValue([
        {
          id: 'brand-a',
          name: 'Marca A',
          slug: 'marca-a',
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          inStockOnly: true,
          brandSlugs: [
            'marca-a',
          ],
          priceMin: 20,
          priceMax: 100,
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            stockQuantity: {
              gt: 0,
            },
            productBrandId: {
              in: ['brand-a'],
            },
            price: {
              gte: 20,
              lte: 100,
            },
          },
        }),
      )
    })

    test('ignora preço negativo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          priceMin: -10,
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
          },
        }),
      )
    })

    test('ignora limites de preço não finitos', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          priceMin: Number.NaN,
          priceMax:
            Number.POSITIVE_INFINITY,
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
          },
        }),
      )
    })

    test('ignora intervalo de preço invertido', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          priceMin: 100,
          priceMax: 20,
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
          },
        }),
      )
    })

    test('filtra produtos pela configuração de veículo selecionada', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: 50,
          stockQuantity: 3,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: null,
        },
      ])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          {
            vehicleConfigurationId:
              'configuration-1',
          },
          client,
        )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            compatibilities: {
              some: {
                vehicleConfigurationId:
                  'configuration-1',
              },
            },
          },
        }),
      )

      expect(
        result?.products,
      ).toHaveLength(1)
    })

    test('combina veículo com stock, marca e preço', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.productBrand.findMany,
      ).mockResolvedValue([
        {
          id: 'brand-a',
          name: 'Marca A',
          slug: 'marca-a',
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          inStockOnly: true,
          brandSlugs: [
            'marca-a',
          ],
          priceMin: 20,
          priceMax: 100,
          vehicleConfigurationId:
            'configuration-1',
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            stockQuantity: {
              gt: 0,
            },
            productBrandId: {
              in: ['brand-a'],
            },
            price: {
              gte: 20,
              lte: 100,
            },
            compatibilities: {
              some: {
                vehicleConfigurationId:
                  'configuration-1',
              },
            },
          },
        }),
      )
    })

    test('ignora configuração de veículo vazia', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      await getCatalogCategoryPageBySlug(
        'categoria-1',
        {
          vehicleConfigurationId:
            '   ',
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
          },
        }),
      )
    })

    test('mantém categoria quando filtro de veículo não encontra produtos', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          {
            vehicleConfigurationId:
              'configuration-sem-produtos',
          },
          client,
        )

      expect(result).toEqual({
        category: {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
        },
        brands: [],
        vehicleConfigurations: [],
        products: [],
      })
    })

    test('filtra produtos em stock quando inStockOnly está ativo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 2,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          description: null,
          price: 20,
          stockQuantity: 4,
          images: [],
          category: {
            id: 'category-1',
            name: 'Categoria 1',
            slug: 'categoria-1',
          },
          brand: null,
        },
      ])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          {
            inStockOnly: true,
          },
          client,
        )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            stockQuantity: {
              gt: 0,
            },
          },
        }),
      )

      expect(
        result?.products,
      ).toHaveLength(1)

      expect(
        result?.products[0]?.inStock,
      ).toBe(true)
    })

    test('mantém categoria quando filtro em stock não encontra produtos', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          {
            inStockOnly: true,
          },
          client,
        )

      expect(result).toEqual({
        category: {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
        },
        brands: [],
        vehicleConfigurations: [],
        products: [],
      })
    })

    test('mantém categoria quando filtro de marca não encontra produtos', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.productBrand.findMany,
      ).mockResolvedValue([
        {
          id: 'brand-a',
          name: 'Marca A',
          slug: 'marca-a',
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          {
            brandSlugs: [
              'marca-inexistente',
            ],
          },
          client,
        )

      expect(result).toEqual({
        category: {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
        },
        brands: [
          {
            id: 'brand-a',
            name: 'Marca A',
            slug: 'marca-a',
          },
        ],
        vehicleConfigurations: [],
        products: [],
      })

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            productBrandId: {
              in: [],
            },
          },
        }),
      )
    })

    test('devolve null quando categoria não tem produtos ativos na árvore', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 0,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([])

      const result =
        await getCatalogCategoryPageBySlug(
          'categoria-1',
          client,
        )

      expect(result).toBeNull()
    })
  })

  describe('listCatalogCategories', () => {
    test('consulta contagem apenas de produtos ativos', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([])

      await listCatalogCategories(client)

      expect(
        client.category.findMany,
      ).toHaveBeenCalledWith({
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          parentId: true,
          name: true,
          slug: true,
          description: true,
          _count: {
            select: {
              products: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
      })
    })

    test('devolve categoria com produto ativo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      const result =
        await listCatalogCategories(client)

      expect(result).toEqual([
        {
          id: 'category-1',
          parentId: null,
          name: 'Categoria 1',
          slug: 'categoria-1',
          description: null,
        },
      ])
    })

    test('esconde categoria sem produtos ativos', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'empty-category',
          parentId: null,
          name: 'Vazia',
          slug: 'vazia',
          description: null,
          _count: {
            products: 0,
          },
        },
      ])

      const result =
        await listCatalogCategories(client)

      expect(result).toEqual([])
    })

    test('mantém categoria pai quando descendente tem produto ativo', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'parent',
          parentId: null,
          name: 'Pai',
          slug: 'pai',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'child',
          parentId: 'parent',
          name: 'Filha',
          slug: 'filha',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      const result =
        await listCatalogCategories(client)

      expect(result).toEqual([
        {
          id: 'parent',
          parentId: null,
          name: 'Pai',
          slug: 'pai',
          description: null,
        },
        {
          id: 'child',
          parentId: 'parent',
          name: 'Filha',
          slug: 'filha',
          description: null,
        },
      ])
    })

    test('mantém todos os antepassados necessários', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'root',
          parentId: null,
          name: 'Raiz',
          slug: 'raiz',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'parent',
          parentId: 'root',
          name: 'Pai',
          slug: 'pai',
          description: null,
          _count: {
            products: 0,
          },
        },
        {
          id: 'child',
          parentId: 'parent',
          name: 'Filha',
          slug: 'filha',
          description: null,
          _count: {
            products: 1,
          },
        },
        {
          id: 'empty',
          parentId: null,
          name: 'Vazia',
          slug: 'vazia',
          description: null,
          _count: {
            products: 0,
          },
        },
      ])

      const result =
        await listCatalogCategories(client)

      expect(
        result.map(
          (category) => category.id,
        ),
      ).toEqual([
        'root',
        'parent',
        'child',
      ])
    })
  })
})
