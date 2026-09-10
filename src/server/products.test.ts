import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

vi.mock('./commercial-settings', () => ({
  getCommercialSettings: vi.fn(),
}))

import {
  getCommercialSettings,
} from './commercial-settings'
import {
  ConflictError,
  NotFoundError,
  ProductClient,
  ValidationError,
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct,
} from './products'

const mockGetCommercialSettings =
  vi.mocked(getCommercialSettings)

const mainlandInclude = {
  shippingRates: {
    where: {
      region:
        'PORTUGAL_MAINLAND',
    },
    select: {
      region: true,
      shippingCost: true,
    },
  },
}

const product = {
  id: 'product-test',
  categoryId: 'category-test',
  productBrandId: 'brand-test',
  name: 'Produto Teste',
  slug: 'produto-teste',
  sku: 'SKU-TESTE-001',
  description: null,
  price: 19.99,
  stockQuantity: 10,
  isActive: true,
  images: [],
  shippingClass:
    'STANDARD' as const,
  shippingRates: [],
}

const productResponse = {
  id: product.id,
  categoryId: product.categoryId,
  productBrandId:
    product.productBrandId,
  name: product.name,
  slug: product.slug,
  sku: product.sku,
  description: product.description,
  price: product.price,
  stockQuantity:
    product.stockQuantity,
  isActive: product.isActive,
  images: product.images,
  shippingClass: 'STANDARD',
  mainlandShippingCost: null,
}

function bulkySettings(
  minimum = '19.90',
  maximum = '29.90',
) {
  return {
    store: {
      id: 'store',
      pricesIncludeTax: true,
    },
    regions: [
      {
        region:
          'PORTUGAL_MAINLAND' as const,
        checkoutEnabled: true,
        taxRatePercent: '23.00',
        shippingRules: [
          {
            id: 'bulky-rule',
            region:
              'PORTUGAL_MAINLAND' as const,
            shippingClass:
              'BULKY' as const,
            checkoutEnabled: true,
            shippingCost: minimum,
            maximumShippingCost:
              maximum,
            freeShippingThreshold:
              null,
          },
        ],
      },
    ],
  }
}

function createClient():
  ProductClient {
  return {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
    productBrand: {
      findUnique: vi.fn(),
    },
    orderItem: {
      count: vi.fn(),
    },
    cartItem: {
      count: vi.fn(),
    },
  }
}

describe('products service', () => {
  let client: ProductClient

  beforeEach(() => {
  vi.clearAllMocks()

  client = createClient()

  mockGetCommercialSettings.mockResolvedValue(
    bulkySettings(),
  )
})

  describe('listProducts', () => {
    test('ordena produtos e inclui os portes do Continente', async () => {
      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([product])

      const result =
        await listProducts(client)

      expect(
        client.product.findMany,
      ).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: mainlandInclude,
      })

      expect(result).toEqual([
        productResponse,
      ])
    })

    test('devolve tarifa específica de produto volumoso', async () => {
      vi.mocked(
        client.product.findMany,
      ).mockResolvedValue([
        {
          ...product,
          shippingClass: 'BULKY',
          shippingRates: [
            {
              region:
                'PORTUGAL_MAINLAND',
              shippingCost: '24.90',
            },
          ],
        },
      ])

      const result =
        await listProducts(client)

      expect(
        result[0]
          .mainlandShippingCost,
      ).toBe('24.90')
    })
  })

  describe('getProductById', () => {
    test('rejeita id vazio', async () => {
      await expect(
        getProductById('', client),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      await expect(
        getProductById(
          'product-test',
          client,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      )

      expect(
        client.product.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
        include: mainlandInclude,
      })
    })

    test('devolve produto existente', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      const result =
        await getProductById(
          'product-test',
          client,
        )

      expect(result).toEqual(
        productResponse,
      )
    })
  })

  describe('createProduct', () => {
    test('rejeita input inválido', async () => {
      await expect(
        createProduct(
          {
            name: '',
          },
          client,
        ),
      ).rejects.toThrow()
    })

    test('exige classe de transporte', async () => {
      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
          },
          client,
        ),
      ).rejects.toThrow()

      expect(
        client.product.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita slug duplicado', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValueOnce(
        product,
      )

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'STANDARD',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )
    })

    test('rejeita sku duplicado', async () => {
      vi.mocked(
        client.product.findUnique,
      )
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          product,
        )

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'STANDARD',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )
    })

    test('rejeita categoryId inexistente', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue(null)

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'STANDARD',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('rejeita productBrandId inexistente', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      vi.mocked(
        client.productBrand
          .findUnique,
      ).mockResolvedValue(null)

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            productBrandId:
              'brand-test',
            shippingClass:
              'STANDARD',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('permite productBrandId null', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      vi.mocked(
        client.product.create,
      ).mockResolvedValue({
        ...product,
        productBrandId: null,
      })

      const result =
        await createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            productBrandId: null,
            shippingClass:
              'STANDARD',
          },
          client,
        )

      expect(
        client.productBrand
          .findUnique,
      ).not.toHaveBeenCalled()

      expect(
        result.productBrandId,
      ).toBeNull()
    })

    test('cria produto STANDARD válido', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      vi.mocked(
        client.productBrand
          .findUnique,
      ).mockResolvedValue({
        id: 'brand-test',
      })

      vi.mocked(
        client.product.create,
      ).mockResolvedValue(product)

      const result =
        await createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            productBrandId:
              'brand-test',
            isActive: true,
            shippingClass:
              'STANDARD',
          },
          client,
        )

      expect(result).toEqual(
        productResponse,
      )

      expect(
        mockGetCommercialSettings,
      ).not.toHaveBeenCalled()
    })

    test('cria produto com imagens', async () => {
      const productWithImages = {
        ...product,
        images: [
          '/products/produto-1.jpg',
          'https://example.com/products/produto-2.jpg',
        ],
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      vi.mocked(
        client.product.create,
      ).mockResolvedValue(
        productWithImages,
      )

      const result =
        await createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'STANDARD',
            images: [
              '/products/produto-1.jpg',
              'https://example.com/products/produto-2.jpg',
            ],
          },
          client,
        )

      expect(
        client.product.create,
      ).toHaveBeenCalledWith({
        data: {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId:
            'category-test',
          shippingClass:
            'STANDARD',
          images: [
            '/products/produto-1.jpg',
            'https://example.com/products/produto-2.jpg',
          ],
          isActive: true,
        },
      })

      expect(result.images).toEqual([
        '/products/produto-1.jpg',
        'https://example.com/products/produto-2.jpg',
      ])
    })

    test('isActive e images omitidos aplicam defaults', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      vi.mocked(
        client.product.create,
      ).mockResolvedValue(product)

      await createProduct(
        {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId:
            'category-test',
          shippingClass:
            'STANDARD',
        },
        client,
      )

      expect(
        client.product.create,
      ).toHaveBeenCalledWith({
        data: {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId:
            'category-test',
          shippingClass:
            'STANDARD',
          isActive: true,
          images: [],
        },
      })
    })

    test('rejeita tarifa individual numa classe não volumosa', async () => {
      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'STANDARD',
            mainlandShippingCost:
              8.9,
          },
          client,
        ),
      ).rejects.toThrow()

      expect(
        client.product.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita BULKY sem tarifa específica', async () => {
      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'BULKY',
          },
          client,
        ),
      ).rejects.toThrow()
    })

    test('cria BULKY com tarifa específica dentro dos limites configurados', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      vi.mocked(
        client.product.create,
      ).mockResolvedValue({
        ...product,
        shippingClass: 'BULKY',
      })

      const result =
        await createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'BULKY',
            mainlandShippingCost:
              24.9,
          },
          client,
        )

      expect(
        client.product.create,
      ).toHaveBeenCalledWith({
        data: {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId:
            'category-test',
          shippingClass: 'BULKY',
          isActive: true,
          images: [],
          shippingRates: {
            create: {
              region:
                'PORTUGAL_MAINLAND',
              shippingCost:
                '24.90',
            },
          },
        },
      })

      expect(
        result.shippingClass,
      ).toBe('BULKY')

      expect(
        result.mainlandShippingCost,
      ).toBe('24.90')
    })

    test('rejeita tarifa BULKY abaixo do mínimo configurado', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'BULKY',
            mainlandShippingCost:
              19.89,
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(
        client.product.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita tarifa BULKY acima do máximo configurado', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'BULKY',
            mainlandShippingCost:
              29.91,
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('usa limites comerciais configuráveis e não valores fixos no produto', async () => {
      mockGetCommercialSettings.mockResolvedValue(
        bulkySettings(
          '25.00',
          '35.00',
        ),
      )

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue({
        id: 'category-test',
      })

      vi.mocked(
        client.product.create,
      ).mockResolvedValue({
        ...product,
        shippingClass: 'BULKY',
      })

      const result =
        await createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId:
              'category-test',
            shippingClass:
              'BULKY',
            mainlandShippingCost:
              30,
          },
          client,
        )

      expect(
        result.mainlandShippingCost,
      ).toBe('30.00')
    })
  })

  describe('updateProduct', () => {
    test('rejeita id vazio', async () => {
      await expect(
        updateProduct(
          '',
          {
            name:
              'Produto Atualizado',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateProduct(
          'product-test',
          {
            name:
              'Produto Atualizado',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    test('rejeita slug duplicado', async () => {
      vi.mocked(
        client.product.findUnique,
      )
        .mockResolvedValueOnce(product)
        .mockResolvedValueOnce({
          ...product,
          id: 'other-product',
        })

      await expect(
        updateProduct(
          'product-test',
          {
            slug: 'outro-produto',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )
    })

    test('rejeita sku duplicado', async () => {
      vi.mocked(
        client.product.findUnique,
      )
        .mockResolvedValueOnce(product)
        .mockResolvedValueOnce({
          ...product,
          id: 'other-product',
        })

      await expect(
        updateProduct(
          'product-test',
          {
            sku: 'SKU-OUTRO-001',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )
    })

    test('rejeita categoryId inexistente', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.category.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateProduct(
          'product-test',
          {
            categoryId:
              'category-missing',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('rejeita productBrandId inexistente', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.productBrand
          .findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateProduct(
          'product-test',
          {
            productBrandId:
              'brand-missing',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('permite productBrandId null', async () => {
      const updated = {
        ...product,
        productBrandId: null,
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.product.update,
      ).mockResolvedValue(updated)

      const result =
        await updateProduct(
          'product-test',
          {
            productBrandId: null,
          },
          client,
        )

      expect(
        client.productBrand
          .findUnique,
      ).not.toHaveBeenCalled()

      expect(
        client.product.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
        data: {
          productBrandId: null,
        },
      })

      expect(
        result.productBrandId,
      ).toBeNull()
    })

    test('atualiza imagens do produto', async () => {
      const updated = {
        ...product,
        images: [
          '/products/atualizado-1.jpg',
          '/products/atualizado-2.jpg',
        ],
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.product.update,
      ).mockResolvedValue(updated)

      const result =
        await updateProduct(
          'product-test',
          {
            images: [
              '/products/atualizado-1.jpg',
              '/products/atualizado-2.jpg',
            ],
          },
          client,
        )

      expect(
        client.product.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
        data: {
          images: [
            '/products/atualizado-1.jpg',
            '/products/atualizado-2.jpg',
          ],
        },
      })

      expect(result.images).toEqual([
        '/products/atualizado-1.jpg',
        '/products/atualizado-2.jpg',
      ])
    })

    test('faz update parcial válido', async () => {
      const updated = {
        ...product,
        name: 'Produto Atualizado',
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.product.update,
      ).mockResolvedValue(updated)

      const result =
        await updateProduct(
          'product-test',
          {
            name:
              'Produto Atualizado',
          },
          client,
        )

      expect(
        client.product.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
        data: {
          name:
            'Produto Atualizado',
        },
      })

      expect(result.name).toBe(
        'Produto Atualizado',
      )
    })

    test('permite corrigir produto histórico UNASSIGNED', async () => {
      const unassigned = {
        ...product,
        shippingClass:
          'UNASSIGNED' as const,
      }

      const updated = {
        ...product,
        shippingClass:
          'STANDARD' as const,
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(unassigned)

      vi.mocked(
        client.product.update,
      ).mockResolvedValue(updated)

      const result =
        await updateProduct(
          'product-test',
          {
            shippingClass:
              'STANDARD',
          },
          client,
        )

      expect(
        client.product.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
        data: {
          shippingClass:
            'STANDARD',
        },
      })

      expect(
        result.shippingClass,
      ).toBe('STANDARD')
    })

    test('rejeita mudar para BULKY sem tarifa específica', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      await expect(
        updateProduct(
          'product-test',
          {
            shippingClass:
              'BULKY',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(
        client.product.update,
      ).not.toHaveBeenCalled()
    })

    test('muda STANDARD para BULKY e cria tarifa específica', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.product.update,
      ).mockResolvedValue({
        ...product,
        shippingClass: 'BULKY',
      })

      const result =
        await updateProduct(
          'product-test',
          {
            shippingClass:
              'BULKY',
            mainlandShippingCost:
              24.9,
          },
          client,
        )

      expect(
        client.product.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
        data: {
          shippingClass:
            'BULKY',
          shippingRates: {
            deleteMany: {
              region:
                'PORTUGAL_MAINLAND',
            },
            create: {
              region:
                'PORTUGAL_MAINLAND',
              shippingCost:
                '24.90',
            },
          },
        },
      })

      expect(
        result.mainlandShippingCost,
      ).toBe('24.90')
    })

    test('atualiza tarifa específica de BULKY', async () => {
      const bulkyProduct = {
        ...product,
        shippingClass:
          'BULKY' as const,
        shippingRates: [
          {
            region:
              'PORTUGAL_MAINLAND' as const,
            shippingCost: '24.90',
          },
        ],
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(
        bulkyProduct,
      )

      vi.mocked(
        client.product.update,
      ).mockResolvedValue({
        ...bulkyProduct,
        shippingRates: [],
      })

      const result =
        await updateProduct(
          'product-test',
          {
            mainlandShippingCost:
              29.9,
          },
          client,
        )

      expect(
        client.product.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
        data: {
          shippingRates: {
            deleteMany: {
              region:
                'PORTUGAL_MAINLAND',
            },
            create: {
              region:
                'PORTUGAL_MAINLAND',
              shippingCost:
                '29.90',
            },
          },
        },
      })

      expect(
        result.mainlandShippingCost,
      ).toBe('29.90')
    })

    test('mantém tarifa BULKY ao editar outro campo', async () => {
      const bulkyProduct = {
        ...product,
        shippingClass:
          'BULKY' as const,
        shippingRates: [
          {
            region:
              'PORTUGAL_MAINLAND' as const,
            shippingCost: '24.90',
          },
        ],
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(
        bulkyProduct,
      )

      vi.mocked(
        client.product.update,
      ).mockResolvedValue({
        ...bulkyProduct,
        name:
          'Produto Atualizado',
        shippingRates: [],
      })

      const result =
        await updateProduct(
          'product-test',
          {
            name:
              'Produto Atualizado',
          },
          client,
        )

      expect(
        result.mainlandShippingCost,
      ).toBe('24.90')

      expect(
        mockGetCommercialSettings,
      ).not.toHaveBeenCalled()
    })

    test('rejeita remover tarifa mantendo BULKY', async () => {
      const bulkyProduct = {
        ...product,
        shippingClass:
          'BULKY' as const,
        shippingRates: [
          {
            region:
              'PORTUGAL_MAINLAND' as const,
            shippingCost: '24.90',
          },
        ],
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(
        bulkyProduct,
      )

      await expect(
        updateProduct(
          'product-test',
          {
            mainlandShippingCost:
              null,
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('remove tarifa específica ao deixar de ser BULKY', async () => {
      const bulkyProduct = {
        ...product,
        shippingClass:
          'BULKY' as const,
        shippingRates: [
          {
            region:
              'PORTUGAL_MAINLAND' as const,
            shippingCost: '24.90',
          },
        ],
      }

      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(
        bulkyProduct,
      )

      vi.mocked(
        client.product.update,
      ).mockResolvedValue({
        ...product,
        shippingClass:
          'STANDARD',
      })

      const result =
        await updateProduct(
          'product-test',
          {
            shippingClass:
              'STANDARD',
          },
          client,
        )

      expect(
        client.product.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
        data: {
          shippingClass:
            'STANDARD',
          shippingRates: {
            deleteMany: {
              region:
                'PORTUGAL_MAINLAND',
            },
          },
        },
      })

      expect(
        result.mainlandShippingCost,
      ).toBeNull()
    })

    test('rejeita tarifa específica numa classe normal', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      await expect(
        updateProduct(
          'product-test',
          {
            mainlandShippingCost:
              8.9,
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(
        client.product.update,
      ).not.toHaveBeenCalled()
    })
  })

  describe('deleteProduct', () => {
    test('rejeita id vazio', async () => {
      await expect(
        deleteProduct('', client),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(null)

      await expect(
        deleteProduct(
          'product-test',
          client,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    test('rejeita produto com OrderItem associado', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.orderItem.count,
      ).mockResolvedValue(1)

      await expect(
        deleteProduct(
          'product-test',
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )

      expect(
        client.cartItem.count,
      ).not.toHaveBeenCalled()
    })

    test('rejeita produto com CartItem associado', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.orderItem.count,
      ).mockResolvedValue(0)

      vi.mocked(
        client.cartItem.count,
      ).mockResolvedValue(1)

      await expect(
        deleteProduct(
          'product-test',
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )
    })

    test('apaga produto sem referências', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValue(product)

      vi.mocked(
        client.orderItem.count,
      ).mockResolvedValue(0)

      vi.mocked(
        client.cartItem.count,
      ).mockResolvedValue(0)

      vi.mocked(
        client.product.delete,
      ).mockResolvedValue(product)

      const result =
        await deleteProduct(
          'product-test',
          client,
        )

      expect(
        client.product.delete,
      ).toHaveBeenCalledWith({
        where: {
          id: 'product-test',
        },
      })

      expect(result).toEqual(product)
    })
  })
})
