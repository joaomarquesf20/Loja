import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ZodError } from 'zod'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock('@/server/products', () => {
  class ValidationError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    ConflictError,
    listProducts: vi.fn(),
    createProduct: vi.fn(),
  }
})

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  ConflictError,
  ValidationError,
  createProduct,
  listProducts,
} from '@/server/products'
import { GET, POST } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockListProducts = vi.mocked(listProducts)
const mockCreateProduct = vi.mocked(createProduct)

describe('Admin Products API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({
      user: {
        id: 'admin-test',
        role: 'ADMIN',
      },
    } as Awaited<ReturnType<typeof requireAdmin>>)
  })

  describe('GET', () => {
    test('devolve produtos com status 200', async () => {
      const products = [
        {
          id: 'product-test',
          categoryId: 'category-test',
          productBrandId: null,
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          description: null,
          price: 19.99,
          stockQuantity: 10,
          active: true,
        },
      ]

      mockListProducts.mockResolvedValue(products)

      const response = await GET()

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(products)
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(new UnauthorizedError())

      const response = await GET()

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Não autenticado',
      })
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(new AdminForbiddenError())

      const response = await GET()

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Sem autorização',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Erro inesperado'))

      const response = await GET()

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
    })
  })

  describe('POST', () => {
    test('cria produto com status 201', async () => {
      const product = {
        id: 'product-test',
        categoryId: 'category-test',
        productBrandId: null,
        name: 'Produto Teste',
        slug: 'produto-teste',
        sku: 'SKU-TESTE-001',
        description: null,
        price: 19.99,
        stockQuantity: 10,
        active: true,
      }

      mockCreateProduct.mockResolvedValue(product)

      const request = new Request('http://localhost/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: 'category-test',
          productBrandId: null,
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          active: true,
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual(product)
    })

    test('devolve 400 para ZodError', async () => {
      mockCreateProduct.mockRejectedValue(new ZodError([]))

      const request = new Request('http://localhost/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: '',
          productBrandId: null,
          name: '',
          slug: '',
          sku: '',
          price: -1,
          stockQuantity: -1,
          active: true,
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 400 para ValidationError', async () => {
      mockCreateProduct.mockRejectedValue(
        new ValidationError('Dados inválidos'),
      )

      const request = new Request('http://localhost/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: 'category-test',
          productBrandId: null,
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          active: true,
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    test('devolve 409 para slug duplicado', async () => {
      mockCreateProduct.mockRejectedValue(
        new ConflictError('Já existe um produto com este slug'),
      )

      const request = new Request('http://localhost/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: 'category-test',
          productBrandId: null,
          name: 'Produto Teste',
          slug: 'produto-teste',
          sku: 'SKU-TESTE-001',
          price: 19.99,
          stockQuantity: 10,
          active: true,
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Já existe um produto com este slug',
      })
    })
  })
})