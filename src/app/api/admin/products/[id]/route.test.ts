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
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    getProductById: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
  }
})

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  deleteProduct,
  getProductById,
  updateProduct,
} from '@/server/products'
import { DELETE, GET, PATCH } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetProductById = vi.mocked(getProductById)
const mockUpdateProduct = vi.mocked(updateProduct)
const mockDeleteProduct = vi.mocked(deleteProduct)

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

function context() {
  return {
    params: Promise.resolve({ id: 'product-test' }),
  }
}

function patchRequest(body: unknown) {
  return new Request(
    'http://localhost/api/admin/products/product-test',
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

function deleteRequest() {
  return new Request(
    'http://localhost/api/admin/products/product-test',
    {
      method: 'DELETE',
    },
  )
}

describe('Admin Product API', () => {
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
    test('devolve produto com status 200', async () => {
      mockGetProductById.mockResolvedValue(product)

      const response = await GET(
        new Request('http://localhost/api/admin/products/product-test'),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(product)
      expect(mockGetProductById).toHaveBeenCalledWith('product-test')
    })

    test('devolve 404 quando produto não existe', async () => {
      mockGetProductById.mockRejectedValue(
        new NotFoundError('Produto não encontrado'),
      )

      const response = await GET(
        new Request('http://localhost/api/admin/products/product-test'),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Produto não encontrado',
      })
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(new UnauthorizedError())

      const response = await GET(
        new Request('http://localhost/api/admin/products/product-test'),
        context(),
      )

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Não autenticado',
      })
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(new AdminForbiddenError())

      const response = await GET(
        new Request('http://localhost/api/admin/products/product-test'),
        context(),
      )

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Sem autorização',
      })
    })
  })

  describe('PATCH', () => {
    test('atualiza produto com status 200', async () => {
      const updatedProduct = {
        ...product,
        name: 'Produto Atualizado',
      }

      mockUpdateProduct.mockResolvedValue(updatedProduct)

      const response = await PATCH(
        patchRequest({
          name: 'Produto Atualizado',
        }),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(updatedProduct)
      expect(mockUpdateProduct).toHaveBeenCalledWith(
        'product-test',
        {
          name: 'Produto Atualizado',
        },
      )
    })

    test('devolve 400 para ZodError', async () => {
      mockUpdateProduct.mockRejectedValue(new ZodError([]))

      const response = await PATCH(
        patchRequest({
          price: -1,
        }),
        context(),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 400 para ValidationError', async () => {
      mockUpdateProduct.mockRejectedValue(
        new ValidationError('Categoria inválida'),
      )

      const response = await PATCH(
        patchRequest({
          categoryId: 'category-missing',
        }),
        context(),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 quando produto não existe', async () => {
      mockUpdateProduct.mockRejectedValue(
        new NotFoundError('Produto não encontrado'),
      )

      const response = await PATCH(
        patchRequest({
          name: 'Produto Atualizado',
        }),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Produto não encontrado',
      })
    })

    test('devolve 409 para conflito', async () => {
      mockUpdateProduct.mockRejectedValue(
        new ConflictError('Já existe um produto com este slug'),
      )

      const response = await PATCH(
        patchRequest({
          slug: 'slug-existente',
        }),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Já existe um produto com este slug',
      })
    })
  })

  describe('DELETE', () => {
    test('apaga produto com status 200', async () => {
      mockDeleteProduct.mockResolvedValue(product)

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(product)
      expect(mockDeleteProduct).toHaveBeenCalledWith('product-test')
    })

    test('devolve 404 quando produto não existe', async () => {
      mockDeleteProduct.mockRejectedValue(
        new NotFoundError('Produto não encontrado'),
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Produto não encontrado',
      })
    })

    test('devolve 409 quando produto tem referências', async () => {
      mockDeleteProduct.mockRejectedValue(
        new ConflictError(
          'Não é possível apagar um produto com encomendas associadas',
        ),
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error:
          'Não é possível apagar um produto com encomendas associadas',
      })
    })
  })
})