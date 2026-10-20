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
  getCatalogCategoryFacetsBySlug,
  getCatalogCategoryPageBySlug,
  getCatalogProductBySlug,
  listCatalogCategories,
  listCatalogProducts,
} from './catalog'

/** Forma das linhas devolvidas por vehicleBrand.findMany. */
type TestVehicleBrandRecord = {
  id: string
  name: string
  models: Array<{
    id: string
    name: string
    generations: Array<{
      id: string
      name: string
    }>
  }>
}

type TestCatalogClient =
  CatalogClient & {
    productVehicleCompatibility: NonNullable<
      CatalogClient['productVehicleCompatibility']
    >
    vehicleBrand: NonNullable<
      CatalogClient['vehicleBrand']
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
    productImage: {
      findMany: vi.fn(
        async () => [],
      ),
    },
    productVehicleCompatibility: {
      findMany: vi.fn(
        async () => [],
      ),
    },
    vehicleBrand: {
      findMany: vi.fn(
        async () => [] as TestVehicleBrandRecord[],
      ),
    },
  }
}

const testVariantSelect = {
  select: {
    id: true,
    sku: true,
    price: true,
    priceSet: true,
    stockQuantity: true,
    isActive: true,
    images: true,
    position: true,
    selections: {
      select: {
        optionValue: {
          select: {
            id: true,
            value: true,
            option: {
              select: {
                id: true,
                code: true,
                name: true,
                position: true,
              },
            },
          },
        },
      },
    },
  },
}

const testProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  stockQuantity: true,
  images: true,
  defaultFinish: true,
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
  variants: testVariantSelect,
}

const testProductDetailSelect = {
  ...testProductSelect,
  sku: true,
}

const testOptionNames: Record<
  string,
  string
> = {
  diameter: 'Diâmetro',
  width: 'Largura',
  pcd: 'Padrão de parafusos',
  offset: 'Offset (ET)',
  finish: 'Acabamento',
  front_drop_mm: 'Rebaixo dianteiro',
  rear_drop_mm: 'Rebaixo traseiro',
  axle_load: 'Carga por eixo',
}

function createVariantRecord({
  id,
  sku,
  selections,
  isActive = true,
  position = 0,
}: {
  id: string
  sku: string
  selections: Record<string, string>
  isActive?: boolean
  position?: number
}) {
  return {
    id,
    sku,
    price: '100.00',
    priceSet: null,
    stockQuantity: 5,
    isActive,
    images: [],
    position,
    selections: Object.entries(
      selections,
    ).map(([code, value], index) => ({
      optionValue: {
        id: `value-${code}-${value}`,
        value,
        option: {
          id: `option-${code}`,
          code,
          name: testOptionNames[code] ?? code,
          position: index,
        },
      },
    })),
  }
}

function createVariantProduct(
  id: string,
  variants: ReturnType<
    typeof createVariantRecord
  >[],
) {
  return {
    id,
    name: `Produto ${id}`,
    slug: `produto-${id}`,
    description: null,
    price: '100.00',
    stockQuantity: 5,
    images: [],
    category: {
      id: 'category-1',
      name: 'Categoria 1',
      slug: 'categoria-1',
    },
    brand: null,
    variants,
  }
}

function createFacetedProduct(
  id: string,
  overrides?: {
    brand?: {
      id: string
      name: string
      slug: string
    } | null
    stockQuantity?: number
  },
) {
  return {
    id,
    name: `Produto ${id}`,
    slug: `produto-${id}`,
    description: null,
    price: '100.00',
    stockQuantity:
      overrides?.stockQuantity ?? 5,
    images: [],
    category: {
      id: 'category-1',
      name: 'Categoria 1',
      slug: 'categoria-1',
    },
    brand:
      overrides?.brand === undefined
        ? null
        : overrides.brand,
    variants: [
      createVariantRecord({
        id: `${id}-variant`,
        sku: `${id}-SKU`,
        selections: {},
      }),
    ],
  }
}

describe('Catalog', () => {
  describe('listCatalogProducts', () => {
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
        select: testProductSelect,
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
          variants: [],
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
          variants: [],
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

    test('expõe galerias de acabamento e prioriza a imagem de catálogo', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-wheel',
          name: 'Jante MF-Z7',
          slug: 'mf-z7',
          description: null,
          price: '100.00',
          stockQuantity: 5,
          images: ['/general.jpg'],
          defaultFinish: 'Satin Black',
          category: {
            id: 'category-1',
            name: 'Jantes',
            slug: 'jantes',
          },
          brand: null,
          variants: [],
        },
      ])
      vi.mocked(
        client.productImage!.findMany,
      ).mockResolvedValue([
        {
          id: 'image-general',
          productId: 'product-wheel',
          url: '/general.jpg',
          altText: 'Vista geral',
          sortOrder: 0,
          isPrimary: true,
          finishValueId: null,
          finishValue: null,
        },
        {
          id: 'image-black',
          productId: 'product-wheel',
          url: '/black.jpg',
          altText: 'Jante preta',
          sortOrder: 0,
          isPrimary: true,
          finishValueId: 'finish-value-black',
          finishValue: {
            value: 'Satin Black',
            option: {
              code: 'finish',
            },
          },
        },
      ])

      const [product] =
        await listCatalogProducts(client)

      expect(product?.imageMetadata).toEqual([
        expect.objectContaining({
          url: '/general.jpg',
          finish: null,
        }),
        expect.objectContaining({
          url: '/black.jpg',
          finish: 'Satin Black',
        }),
      ])
      expect(product?.defaultFinish).toBe(
        'Satin Black',
      )
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

    test('deriva preço do variante mais barato e inStock dos variantes ativos', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Jante JR11',
          slug: 'jante-jr11',
          description: 'Jante Japan Racing JR11',
          price: '300.00',
          stockQuantity: 0,
          images: ['/wheels/jr11.jpg'],
          category: {
            id: 'category-1',
            name: 'Jantes',
            slug: 'jantes',
          },
          brand: {
            id: 'brand-1',
            name: 'Japan Racing',
            slug: 'japan-racing',
          },
          variants: [
            {
              id: 'variant-b',
              sku: 'JR11-18-85-112',
              price: '189.00',
              priceSet: null,
              stockQuantity: 4,
              isActive: true,
              images: [],
              position: 2,
              selections: [],
            },
            {
              id: 'variant-a',
              sku: 'JR11-17-75-112',
              price: '169.90',
              priceSet: null,
              stockQuantity: 0,
              isActive: true,
              images: [],
              position: 1,
              selections: [],
            },
            {
              id: 'variant-x',
              sku: 'JR11-19-85-112',
              price: '199.00',
              priceSet: null,
              stockQuantity: 9,
              isActive: false,
              images: [],
              position: 3,
              selections: [],
            },
          ],
        },
      ])

      const result =
        await listCatalogProducts(client)

      const product = result[0]

      expect(product?.price).toBe(169.9)

      expect(product?.inStock).toBe(true)

      expect(product?.variants).toEqual([
        {
          id: 'variant-a',
          sku: 'JR11-17-75-112',
          price: 169.9,
          priceSet: null,
          inStock: false,
          options: [],
          image: null,
        },
        {
          id: 'variant-b',
          sku: 'JR11-18-85-112',
          price: 189,
          priceSet: null,
          inStock: true,
          options: [],
          image: null,
        },
      ])
    })

    test('ordena variantes por posição e expõe opções ordenadas e imagem', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Mola H&R',
          slug: 'mola-hr',
          description: null,
          price: '289.90',
          stockQuantity: 5,
          images: ['/springs/hr.jpg'],
          category: {
            id: 'category-1',
            name: 'Suspensão',
            slug: 'suspensão',
          },
          brand: null,
          variants: [
            {
              id: 'variant-2',
              sku: 'HR-40-30',
              price: '299.90',
              priceSet: null,
              stockQuantity: 2,
              isActive: true,
              images: ['/springs/hr-40.jpg'],
              position: 2,
              selections: [
                {
                  optionValue: {
                    id: 'value-front-40',
                    value: '40',
                    option: {
                      id: 'option-front',
                      code: 'front_drop_mm',
                      name: 'Rebaixo dianteiro',
                      position: 2,
                    },
                  },
                },
                {
                  optionValue: {
                    id: 'value-rear-30',
                    value: '30',
                    option: {
                      id: 'option-rear',
                      code: 'rear_drop_mm',
                      name: 'Rebaixo traseiro',
                      position: 3,
                    },
                  },
                },
                {
                  optionValue: {
                    id: 'value-vehicle',
                    value: 'Golf Mk7 2.0 TDI (até 1000 kg eixo)',
                    option: {
                      id: 'option-vehicle',
                      code: 'axle_load',
                      name: 'Carga por eixo',
                      position: 1,
                    },
                  },
                },
              ],
            },
          ],
        },
      ])

      const product = (
        await listCatalogProducts(client)
      )[0]

      expect(product?.variants).toEqual([
        {
          id: 'variant-2',
          sku: 'HR-40-30',
          price: 299.9,
          priceSet: null,
          inStock: true,
          options: [
            {
              code: 'axle_load',
              name: 'Carga por eixo',
              value:
                'Golf Mk7 2.0 TDI (até 1000 kg eixo)',
            },
            {
              code: 'front_drop_mm',
              name: 'Rebaixo dianteiro',
              value: '40',
            },
            {
              code: 'rear_drop_mm',
              name: 'Rebaixo traseiro',
              value: '30',
            },
          ],
          image: '/springs/hr-40.jpg',
        },
      ])

      expect(product?.price).toBe(299.9)

      expect(product?.inStock).toBe(true)
    })

    test('produto só com variantes inativas cai para preço/stock do produto', async () => {
      const client = createClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          id: 'product-1',
          name: 'Produto antigo',
          slug: 'produto-antigo',
          description: null,
          price: '99.00',
          stockQuantity: 3,
          images: [],
          category: {
            id: 'category-1',
            name: 'Acessórios',
            slug: 'acessorios',
          },
          brand: null,
          variants: [
            {
              id: 'variant-dead',
              sku: 'OLD-DEAD',
              price: '10.00',
              priceSet: null,
              stockQuantity: 99,
              isActive: false,
              images: [],
              position: 0,
              selections: [],
            },
          ],
        },
      ])

      const product = (
        await listCatalogProducts(client)
      )[0]

      expect(product?.price).toBe(99)

      expect(product?.inStock).toBe(true)

      expect(product?.variants).toEqual([])
    })
  })

  describe('getCatalogProductBySlug', () => {
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
        select: testProductDetailSelect,
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
        variants: [],
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
        variants: [],
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
          variants: [],
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
        select: testProductSelect,
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
            variants: [],
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
            variants: {
              some: {
                isActive: true,
                stockQuantity: {
                  gt: 0,
                },
              },
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
            variants: {
              some: {
                isActive: true,
                price: {
                  gte: 25,
                },
              },
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
            variants: {
              some: {
                isActive: true,
                price: {
                  lte: 75,
                },
              },
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
            variants: {
              some: {
                isActive: true,
                price: {
                  gte: 20,
                  lte: 100,
                },
                stockQuantity: {
                  gt: 0,
                },
              },
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
            vehicleModelIds: ['model-1'],
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
                OR: [
                  {
                    vehicleModelId: {
                      in: ['model-1'],
                    },
                  },
                ],
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
          vehicleModelIds: ['model-1'],
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
            variants: {
              some: {
                isActive: true,
                price: {
                  gte: 20,
                  lte: 100,
                },
                stockQuantity: {
                  gt: 0,
                },
              },
            },
            compatibilities: {
              some: {
                OR: [
                  {
                    vehicleModelId: {
                      in: ['model-1'],
                    },
                  },
                ],
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
        {            vehicleModelIds: ['   '],
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
            vehicleGenerationIds: ['g1'],
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
            variants: {
              some: {
                isActive: true,
                stockQuantity: {
                  gt: 0,
                },
              },
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

    test('filtra por opções de variante com OR dentro do eixo e AND entre eixos', async () => {
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
          variantSelections: [
            {
              code: 'diameter',
              values: ['17"', '19"'],
            },
            {
              code: 'pcd',
              values: ['5x120'],
            },
          ],
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenNthCalledWith(1, {
        where: {
          isActive: true,
          categoryId: {
            in: ['category-1'],
          },
          variants: {
            some: {
              isActive: true,
              AND: [
                {
                  selections: {
                    some: {
                      optionValue: {
                        value: {
                          in: ['17"', '19"'],
                        },
                        option: {
                          code: 'diameter',
                        },
                      },
                    },
                  },
                },
                {
                  selections: {
                    some: {
                      optionValue: {
                        value: {
                          in: ['5x120'],
                        },
                        option: {
                          code: 'pcd',
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        select: testProductSelect,
      })
    })

    test('combina filtro de variante com stock e preço', async () => {
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
          inStockOnly: true,
          priceMax: 500,
          variantSelections: [
            {
              code: 'diameter',
              values: ['19"'],
            },
          ],
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            isActive: true,
            categoryId: {
              in: ['category-1'],
            },
            stockQuantity: {
              gt: 0,
            },
            price: {
              lte: 500,
            },
            variants: {
              some: {
                isActive: true,
                price: {
                  lte: 500,
                },
                stockQuantity: {
                  gt: 0,
                },
                AND: [
                  {
                    selections: {
                      some: {
                        optionValue: {
                          value: {
                            in: ['19"'],
                          },
                          option: {
                            code: 'diameter',
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
      )
    })

    test('ignora opções de variante vazias', async () => {
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
          variantSelections: [
            {
              code: '  ',
              values: ['19"'],
            },
            {
              code: 'diameter',
              values: ['  '],
            },
          ],
        },
        client,
      )

      expect(
        client.product.findMany,
      ).toHaveBeenCalledTimes(1)

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith({
        where: {
          isActive: true,
          categoryId: {
            in: ['category-1'],
          },
        },
        orderBy: {
          name: 'asc',
        },
        select: testProductSelect,
      })
    })

    test('deriva facetas das variantes ativas e ignora variantes inativas', async () => {
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
        createVariantProduct(
          'product-1',
          [
            createVariantRecord({
              id: 'variant-1',
              sku: 'JR11-19',
              selections: {
                diameter: '19"',
                pcd: '5x120',
              },
            }),
            createVariantRecord({
              id: 'variant-2',
              sku: 'JR11-18',
              selections: {
                diameter: '18"',
                pcd: '5x112',
              },
            }),
          ],
        ),
        createVariantProduct(
          'product-2',
          [
            createVariantRecord({
              id: 'variant-3',
              sku: 'OZ-19',
              selections: {
                diameter: '19"',
                pcd: '5x112',
              },
            }),
            createVariantRecord({
              id: 'variant-4',
              sku: 'OZ-20',
              isActive: false,
              selections: {
                diameter: '20"',
                pcd: '5x120',
              },
            }),
          ],
        ),
      ])

      const result =
        await getCatalogCategoryFacetsBySlug(
          'categoria-1',
          {},
          { client },
        )

      expect(
        result?.variantFacets,
      ).toEqual([
        {
          code: 'diameter',
          name: 'Diâmetro',
          values: [
            {
              value: '18"',
              productCount: 1,
            },
            {
              value: '19"',
              productCount: 2,
            },
          ],
        },
        {
          code: 'pcd',
          name: 'Padrão de parafusos',
          values: [
            {
              value: '5x112',
              productCount: 2,
            },
            {
              value: '5x120',
              productCount: 1,
            },
          ],
        },
      ])
    })

    test('conta facetas só nas combinações reais com a seleção de outros eixos', async () => {
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

      const products = [
        createVariantProduct(
          'product-1',
          [
            createVariantRecord({
              id: 'variant-1',
              sku: 'JR11-19-120',
              selections: {
                diameter: '19"',
                pcd: '5x120',
              },
            }),
            createVariantRecord({
              id: 'variant-2',
              sku: 'JR11-18-112',
              selections: {
                diameter: '18"',
                pcd: '5x112',
              },
            }),
          ],
        ),
        createVariantProduct(
          'product-2',
          [
            createVariantRecord({
              id: 'variant-3',
              sku: 'OZ-19-112',
              selections: {
                diameter: '19"',
                pcd: '5x112',
              },
            }),
          ],
        ),
      ]

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue(products)

      const result =
        await getCatalogCategoryFacetsBySlug(
          'categoria-1',
          {
            variantSelections: [
              {
                code: 'diameter',
                values: ['19"'],
              },
            ],
          },
          { client },
        )

      // 5x120 existe em 19" (product-1) e 5x112 em
      // 19" (product-2). O 18" continua disponível
      // como alternativa do próprio eixo, mesmo sem
      // combinar com 19".
      expect(
        result?.variantFacets,
      ).toEqual([
        {
          code: 'diameter',
          name: 'Diâmetro',
          values: [
            {
              value: '18"',
              productCount: 1,
            },
            {
              value: '19"',
              productCount: 2,
            },
          ],
        },
        {
          code: 'pcd',
          name: 'Padrão de parafusos',
          values: [
            {
              value: '5x112',
              productCount: 1,
            },
            {
              value: '5x120',
              productCount: 1,
            },
          ],
        },
      ])
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

  describe('getCatalogCategoryFacetsBySlug', () => {
    function createFacetedClient() {
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

      return client
    }

    function createCompatibility(
      productId: string,
      overrides?: {
        vehicleBrandId?: string
        vehicleModelId?: string
        vehicleGenerationId?:
          | string
          | null
      },
    ) {
      return {
        productId,
        vehicleBrandId:
          overrides?.vehicleBrandId ??
          'make-vw',
        vehicleModelId:
          overrides?.vehicleModelId ??
          'model-golf',
        vehicleGenerationId:
          overrides
            ?.vehicleGenerationId ??
          'gen-mk7',
      }
    }

    test('conta stock, marca e veículo a partir dos dados reais', async () => {
      const client = createFacetedClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        createFacetedProduct('product-1', {
          brand: {
            id: 'brand-bbs',
            name: 'BBS',
            slug: 'bbs',
          },
          stockQuantity: 4,
        }),
        createFacetedProduct('product-2', {
          brand: {
            id: 'brand-oz',
            name: 'OZ Racing',
            slug: 'oz-racing',
          },
          stockQuantity: 0,
        }),
        createFacetedProduct('product-3', {
          brand: null,
          stockQuantity: 2,
        }),
      ])

      vi.mocked(
        client.productVehicleCompatibility.findMany,
      ).mockResolvedValue([
        createCompatibility('product-1'),
        createCompatibility('product-2', {
          vehicleBrandId: 'make-audi',
          vehicleModelId: 'model-a3',
          vehicleGenerationId: 'gen-8v',
        }),
      ])

      vi.mocked(
        client.vehicleBrand.findMany,
      ).mockResolvedValue([
        {
          id: 'make-vw',
          name: 'Volkswagen',
          models: [
            {
              id: 'model-golf',
              name: 'Golf',
              generations: [
                {
                  id: 'gen-mk7',
                  name: 'Mk7',
                },
              ],
            },
          ],
        },
        {
          id: 'make-audi',
          name: 'Audi',
          models: [
            {
              id: 'model-a3',
              name: 'A3',
              generations: [
                {
                  id: 'gen-8v',
                  name: '8V',
                },
              ],
            },
          ],
        },
      ])

      const facets =
        await getCatalogCategoryFacetsBySlug(
          'categoria-1',
          {},
          { client },
        )

      expect(facets?.inStockCount).toBe(2)

      expect(facets?.brands).toEqual([
        {
          id: 'brand-bbs',
          name: 'BBS',
          slug: 'bbs',
          productCount: 1,
        },
        {
          id: 'brand-oz',
          name: 'OZ Racing',
          slug: 'oz-racing',
          productCount: 1,
        },
      ])

      expect(
        facets?.vehicleMakes,
      ).toEqual([
        {
          id: 'make-audi',
          name: 'Audi',
          productCount: 1,
          models: [
            {
              id: 'model-a3',
              name: 'A3',
              brandId: 'make-audi',
              productCount: 1,
              generations: [
                {
                  id: 'gen-8v',
                  name: '8V',
                  modelId: 'model-a3',
                  productCount: 1,
                },
              ],
            },
          ],
        },
        {
          id: 'make-vw',
          name: 'Volkswagen',
          productCount: 1,
          models: [
            {
              id: 'model-golf',
              name: 'Golf',
              brandId: 'make-vw',
              productCount: 1,
              generations: [
                {
                  id: 'gen-mk7',
                  name: 'Mk7',
                  modelId: 'model-golf',
                  productCount: 1,
                },
              ],
            },
          ],
        },
      ])
    })

    test('as contagens de cada opção respeitam os restantes filtros', async () => {
      const client = createFacetedClient()

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        createFacetedProduct('product-1', {
          brand: {
            id: 'brand-bbs',
            name: 'BBS',
            slug: 'bbs',
          },
        }),
        createFacetedProduct('product-2', {
          brand: {
            id: 'brand-oz',
            name: 'OZ Racing',
            slug: 'oz-racing',
          },
        }),
        createFacetedProduct('product-3', {
          brand: {
            id: 'brand-bbs',
            name: 'BBS',
            slug: 'bbs',
          },
        }),
      ])

      vi.mocked(
        client.productVehicleCompatibility.findMany,
      ).mockResolvedValue([
        createCompatibility('product-1'),
        createCompatibility('product-2', {
          vehicleBrandId: 'make-audi',
          vehicleModelId: 'model-a3',
          vehicleGenerationId: 'gen-8v',
        }),
        createCompatibility('product-3', {
          vehicleBrandId: 'make-audi',
          vehicleModelId: 'model-a3',
          vehicleGenerationId: 'gen-8v',
        }),
      ])

      vi.mocked(
        client.vehicleBrand.findMany,
      ).mockResolvedValue([
        {
          id: 'make-vw',
          name: 'Volkswagen',
          models: [
            {
              id: 'model-golf',
              name: 'Golf',
              generations: [
                {
                  id: 'gen-mk7',
                  name: 'Mk7',
                },
              ],
            },
          ],
        },
        {
          id: 'make-audi',
          name: 'Audi',
          models: [
            {
              id: 'model-a3',
              name: 'A3',
              generations: [
                {
                  id: 'gen-8v',
                  name: '8V',
                },
              ],
            },
          ],
        },
      ])

      const facets =
        await getCatalogCategoryFacetsBySlug(
          'categoria-1',
          {
            vehicleMakeIds: ['make-audi'],
          },
          { client },
        )

      // Dentro da mesma dimensão os valores são
      // alternativas: Volkswagen continua visível com a
      // contagem que teria se passasse a ser a marca
      // selecionada. A marca, pelo contrário, é contada
      // com o filtro de veículo aplicado.
      expect(
        facets?.vehicleMakes.map(
          (make) => [
            make.name,
            make.productCount,
          ],
        ),
      ).toEqual([
        ['Audi', 2],
        ['Volkswagen', 1],
      ])

      expect(
        facets?.brands.map((brand) => [
          brand.name,
          brand.productCount,
        ]),
      ).toEqual([
        ['BBS', 1],
        ['OZ Racing', 1],
      ])

      expect(
        facets?.inStockCount,
      ).toBe(2)
    })

    test('devolve null para categoria inexistente ou sem slug', async () => {
      const client = createFacetedClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([])

      expect(
        await getCatalogCategoryFacetsBySlug(
          'categoria-1',
          {},
          { client },
        ),
      ).toBeNull()

      expect(
        await getCatalogCategoryFacetsBySlug(
          '   ',
          {},
          { client },
        ),
      ).toBeNull()

      expect(
        client.product.findMany,
      ).not.toHaveBeenCalled()
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

  describe('regressão — facetas de veículo em categorias não-wheel', () => {
    test('vehicleBrand.findMany recebe select e buildCategoryFacets nunca lê models undefined', async () => {
      const client = createClient()

      vi.mocked(
        client.category.findMany,
      ).mockResolvedValue([
        {
          id: 'category-ext',
          parentId: null,
          name: 'Exterior',
          slug: 'dev-exterior',
          description: null,
          _count: {
            products: 1,
          },
        },
      ])

      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        createFacetedProduct('product-1'),
      ])

      // Simula o bug original: a chamada vinha SEM select e
      // o Prisma devolveria modelos inteiros; com select, o
      // formato tem de ser exatamente este (aninhado).
      vi.mocked(
        client.vehicleBrand.findMany,
      ).mockImplementation(async (args?: {
        select?: Record<string, unknown>
      }) => {
        // Prisma lança validação sem argumentos esperados;
        // aqui basta garantir que foram PASSADOS argumentos.
        expect(args).toBeDefined()
        expect(args?.select).toMatchObject({
          id: true,
          name: true,
          models: expect.any(Object),
        })

        return [
          {
            id: 'make-bmw',
            name: 'BMW',
            models: [
              {
                id: 'model-serie4',
                name: 'Série 4',
                generations: [
                  { id: 'gen-g22', name: 'G22' },
                  { id: 'gen-g23', name: 'G23' },
                ],
              },
            ],
          },
        ]
      })

      vi.mocked(
        client.productVehicleCompatibility.findMany,
      ).mockResolvedValue([
        {
          productId: 'product-1',
          vehicleBrandId: 'make-bmw',
          vehicleModelId: 'model-serie4',
          vehicleGenerationId: 'gen-g22',
        },
      ])

      const facets =
        await getCatalogCategoryFacetsBySlug(
          'dev-exterior',
          {},
          { client },
        )

      expect(facets).not.toBeNull()
      expect(facets?.vehicleMakes).toEqual([
        expect.objectContaining({
          id: 'make-bmw',
          name: 'BMW',
          models: [
            expect.objectContaining({
              name: 'Série 4',
              generations: expect.any(Array),
            }),
          ],
        }),
      ])
    })
  })
})