import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock('@/server/product-brands', () => {
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    getProductBrandById: vi.fn(),
    updateProductBrand: vi.fn(),
    deleteProductBrand: vi.fn(),
  }
})

import { requireAdmin } from '@/server/admin-auth'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  deleteProductBrand,
  getProductBrandById,
  updateProductBrand,
} from '@/server/product-brands'
import { DELETE, GET, PATCH } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetProductBrandById = vi.mocked(getProductBrandById)
const mockUpdateProductBrand = vi.mocked(updateProductBrand)
const mockDeleteProductBrand = vi.mocked(deleteProductBrand)

const productBrand = {
  id: 'brand-1',
  name: 'Marca Teste',
  slug: 'marca-teste',
}

function context() {
  return {
    params: Promise.resolve({ id: 'brand-1' }),
  }
}

function patchRequest(body: unknown) {
  return new Request(
    'http://localhost/api/admin/product-brands/brand-1',
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

describe('/api/admin/product-brands/[id]', () => {
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
    it('devolve marca com status 200', async () => {
      mockGetProductBrandById.mockResolvedValue(productBrand)

      const response = await GET(
        new Request('http://localhost/api/admin/product-brands/brand-1'),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(productBrand)

      expect(mockGetProductBrandById).toHaveBeenCalledWith('brand-1')
    })

    it('devolve 404 quando marca não existe', async () => {
      mockGetProductBrandById.mockRejectedValue(
        new NotFoundError('Marca não encontrada'),
      )

      const response = await GET(
        new Request('http://localhost/api/admin/product-brands/brand-1'),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Marca não encontrada',
      })
    })
  })

  describe('PATCH', () => {
    it('atualiza marca com status 200', async () => {
      const updatedProductBrand = {
        ...productBrand,
        name: 'Marca Atualizada',
      }

      mockUpdateProductBrand.mockResolvedValue(updatedProductBrand)

      const response = await PATCH(
        patchRequest({
          name: 'Marca Atualizada',
        }),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(updatedProductBrand)

      expect(mockUpdateProductBrand).toHaveBeenCalledWith(
        'brand-1',
        {
          name: 'Marca Atualizada',
        },
      )
    })

    it('devolve 400 para ValidationError', async () => {
      mockUpdateProductBrand.mockRejectedValue(
        new ValidationError('Dados inválidos'),
      )

      const response = await PATCH(
        patchRequest({ name: '' }),
        context(),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })
    })

    it('devolve 409 para slug duplicado', async () => {
      mockUpdateProductBrand.mockRejectedValue(
        new ConflictError('Já existe uma marca com este slug'),
      )

      const response = await PATCH(
        patchRequest({
          slug: 'slug-existente',
        }),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Já existe uma marca com este slug',
      })
    })
  })

  describe('DELETE', () => {
    it('apaga marca com status 200', async () => {
      mockDeleteProductBrand.mockResolvedValue(productBrand)

      const response = await DELETE(
        new Request('http://localhost/api/admin/product-brands/brand-1', {
          method: 'DELETE',
        }),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(productBrand)

      expect(mockDeleteProductBrand).toHaveBeenCalledWith('brand-1')
    })

    it('devolve 404 quando marca não existe', async () => {
      mockDeleteProductBrand.mockRejectedValue(
        new NotFoundError('Marca não encontrada'),
      )

      const response = await DELETE(
        new Request('http://localhost/api/admin/product-brands/brand-1', {
          method: 'DELETE',
        }),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Marca não encontrada',
      })
    })

    it('devolve 409 quando marca está em uso', async () => {
      mockDeleteProductBrand.mockRejectedValue(
        new ConflictError(
          'Não é possível apagar uma marca com produtos associados',
        ),
      )

      const response = await DELETE(
        new Request('http://localhost/api/admin/product-brands/brand-1', {
          method: 'DELETE',
        }),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Não é possível apagar uma marca com produtos associados',
      })
    })
  })
})