import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

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
}

function createClient(): ProductClient {
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
    client = createClient()
  })

  describe('listProducts', () => {
    test('ordena produtos por name asc', async () => {
      vi.mocked(client.product.findMany).mockResolvedValue([product])

      const result = await listProducts(client)

      expect(client.product.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      })
      expect(result).toEqual([product])
    })
  })

  describe('getProductById', () => {
    test('rejeita id vazio', async () => {
      await expect(
        getProductById('', client),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)

      await expect(
        getProductById('product-test', client),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(client.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'product-test' },
      })
    })

    test('devolve produto existente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(product)

      const result = await getProductById(
        'product-test',
        client,
      )

      expect(result).toEqual(product)
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

    test('rejeita slug duplicado', async () => {
      vi.mocked(
        client.product.findUnique,
      ).mockResolvedValueOnce(product)

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId: 'category-test',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    test('rejeita sku duplicado', async () => {
      vi.mocked(client.product.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(product)

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId: 'category-test',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    test('rejeita categoryId inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)
      vi.mocked(client.category.findUnique).mockResolvedValue(null)

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId: 'category-test',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita productBrandId inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)
      vi.mocked(client.category.findUnique).mockResolvedValue({
        id: 'category-test',
      })
      vi.mocked(client.productBrand.findUnique).mockResolvedValue(
        null,
      )

      await expect(
        createProduct(
          {
            name: 'Produto Teste',
            slug: 'produto-teste',
            sku: 'SKU-TESTE-001',
            price: 19.99,
            stockQuantity: 10,
            categoryId: 'category-test',
            productBrandId: 'brand-test',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('permite productBrandId null', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)
      vi.mocked(client.category.findUnique).mockResolvedValue({
        id: 'category-test',
      })
      vi.mocked(client.product.create).mockResolvedValue({
        ...product,
        productBrandId: null,
      })

      const result = await createProduct(
        {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId: 'category-test',
          productBrandId: null,
        },
        client,
      )

      expect(
        client.productBrand.findUnique,
      ).not.toHaveBeenCalled()
      expect(result.productBrandId).toBeNull()
    })

    test('cria produto válido', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)
      vi.mocked(client.category.findUnique).mockResolvedValue({
        id: 'category-test',
      })
      vi.mocked(client.productBrand.findUnique).mockResolvedValue({
        id: 'brand-test',
      })
      vi.mocked(client.product.create).mockResolvedValue(product)

      const result = await createProduct(
        {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId: 'category-test',
          productBrandId: 'brand-test',
          isActive: true,
        },
        client,
      )

      expect(result).toEqual(product)
    })

    test('cria produto com imagens', async () => {
      const productWithImages = {
        ...product,
        images: [
          '/products/produto-1.jpg',
          'https://example.com/products/produto-2.jpg',
        ],
      }

      vi.mocked(client.product.findUnique).mockResolvedValue(null)
      vi.mocked(client.category.findUnique).mockResolvedValue({
        id: 'category-test',
      })
      vi.mocked(client.product.create).mockResolvedValue(
        productWithImages,
      )

      const result = await createProduct(
        {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId: 'category-test',
          images: [
            '/products/produto-1.jpg',
            'https://example.com/products/produto-2.jpg',
          ],
        },
        client,
      )

      expect(client.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId: 'category-test',
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
      vi.mocked(client.product.findUnique).mockResolvedValue(null)
      vi.mocked(client.category.findUnique).mockResolvedValue({
        id: 'category-test',
      })
      vi.mocked(client.product.create).mockResolvedValue(product)

      await createProduct(
        {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId: 'category-test',
        },
        client,
      )

      expect(client.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          categoryId: 'category-test',
          isActive: true,
          images: [],
        },
      })
    })
  })

  describe('updateProduct', () => {
    test('rejeita id vazio', async () => {
      await expect(
        updateProduct(
          '',
          { name: 'Produto Atualizado' },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)

      await expect(
        updateProduct(
          'product-test',
          { name: 'Produto Atualizado' },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita slug duplicado', async () => {
      vi.mocked(client.product.findUnique)
        .mockResolvedValueOnce(product)
        .mockResolvedValueOnce({
          ...product,
          id: 'other-product',
        })

      await expect(
        updateProduct(
          'product-test',
          { slug: 'outro-produto' },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    test('rejeita sku duplicado', async () => {
      vi.mocked(client.product.findUnique)
        .mockResolvedValueOnce(product)
        .mockResolvedValueOnce({
          ...product,
          id: 'other-product',
        })

      await expect(
        updateProduct(
          'product-test',
          { sku: 'SKU-OUTRO-001' },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    test('rejeita categoryId inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(product)
      vi.mocked(client.category.findUnique).mockResolvedValue(null)

      await expect(
        updateProduct(
          'product-test',
          { categoryId: 'category-missing' },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita productBrandId inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(product)
      vi.mocked(client.productBrand.findUnique).mockResolvedValue(
        null,
      )

      await expect(
        updateProduct(
          'product-test',
          { productBrandId: 'brand-missing' },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('permite productBrandId null', async () => {
      const updated = {
        ...product,
        productBrandId: null,
      }

      vi.mocked(client.product.findUnique).mockResolvedValue(product)
      vi.mocked(client.product.update).mockResolvedValue(updated)

      const result = await updateProduct(
        'product-test',
        { productBrandId: null },
        client,
      )

      expect(
        client.productBrand.findUnique,
      ).not.toHaveBeenCalled()
      expect(client.product.update).toHaveBeenCalledWith({
        where: { id: 'product-test' },
        data: { productBrandId: null },
      })
      expect(result.productBrandId).toBeNull()
    })

    test('atualiza imagens do produto', async () => {
      const updated = {
        ...product,
        images: [
          '/products/atualizado-1.jpg',
          '/products/atualizado-2.jpg',
        ],
      }

      vi.mocked(client.product.findUnique).mockResolvedValue(product)
      vi.mocked(client.product.update).mockResolvedValue(updated)

      const result = await updateProduct(
        'product-test',
        {
          images: [
            '/products/atualizado-1.jpg',
            '/products/atualizado-2.jpg',
          ],
        },
        client,
      )

      expect(client.product.update).toHaveBeenCalledWith({
        where: { id: 'product-test' },
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

      vi.mocked(client.product.findUnique).mockResolvedValue(product)
      vi.mocked(client.product.update).mockResolvedValue(updated)

      const result = await updateProduct(
        'product-test',
        { name: 'Produto Atualizado' },
        client,
      )

      expect(client.product.update).toHaveBeenCalledWith({
        where: { id: 'product-test' },
        data: { name: 'Produto Atualizado' },
      })
      expect(result).toEqual(updated)
    })
  })

  describe('deleteProduct', () => {
    test('rejeita id vazio', async () => {
      await expect(
        deleteProduct('', client),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)

      await expect(
        deleteProduct('product-test', client),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita produto com OrderItem associado', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(product)
      vi.mocked(client.orderItem.count).mockResolvedValue(1)

      await expect(
        deleteProduct('product-test', client),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(client.cartItem.count).not.toHaveBeenCalled()
    })

    test('rejeita produto com CartItem associado', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(product)
      vi.mocked(client.orderItem.count).mockResolvedValue(0)
      vi.mocked(client.cartItem.count).mockResolvedValue(1)

      await expect(
        deleteProduct('product-test', client),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    test('apaga produto sem referências', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(product)
      vi.mocked(client.orderItem.count).mockResolvedValue(0)
      vi.mocked(client.cartItem.count).mockResolvedValue(0)
      vi.mocked(client.product.delete).mockResolvedValue(product)

      const result = await deleteProduct(
        'product-test',
        client,
      )

      expect(client.product.delete).toHaveBeenCalledWith({
        where: { id: 'product-test' },
      })
      expect(result).toEqual(product)
    })
  })
})