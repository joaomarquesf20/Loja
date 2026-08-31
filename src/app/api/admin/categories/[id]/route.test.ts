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

vi.mock('@/server/categories', () => {
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class ConflictError extends Error {}
  class ForbiddenError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    ForbiddenError,
    getCategoryById: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  }
})

import { requireAdmin } from '@/server/admin-auth'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  deleteCategory,
  getCategoryById,
  updateCategory,
} from '@/server/categories'
import { DELETE, GET, PATCH } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetCategoryById = vi.mocked(getCategoryById)
const mockUpdateCategory = vi.mocked(updateCategory)
const mockDeleteCategory = vi.mocked(deleteCategory)

const category = {
  id: 'cat-1',
  name: 'Categoria Teste',
  slug: 'categoria-teste',
  description: null,
  parentId: null,
}

function context() {
  return {
    params: Promise.resolve({ id: 'cat-1' }),
  }
}

function patchRequest(body: unknown) {
  return new Request(
    'http://localhost/api/admin/categories/cat-1',
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

describe('/api/admin/categories/[id]', () => {
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
    it('devolve categoria com status 200', async () => {
      mockGetCategoryById.mockResolvedValue(category)

      const response = await GET(
        new Request(
          'http://localhost/api/admin/categories/cat-1',
        ),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(category)

      expect(mockGetCategoryById).toHaveBeenCalledWith('cat-1')
    })

    it('devolve 404 quando categoria não existe', async () => {
      mockGetCategoryById.mockRejectedValue(
        new NotFoundError('Categoria não encontrada'),
      )

      const response = await GET(
        new Request(
          'http://localhost/api/admin/categories/cat-1',
        ),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Categoria não encontrada',
      })
    })
  })

  describe('PATCH', () => {
    it('atualiza categoria com status 200', async () => {
      const updatedCategory = {
        ...category,
        name: 'Categoria Atualizada',
      }

      mockUpdateCategory.mockResolvedValue(updatedCategory)

      const response = await PATCH(
        patchRequest({
          name: 'Categoria Atualizada',
        }),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(updatedCategory)

      expect(mockUpdateCategory).toHaveBeenCalledWith(
        'cat-1',
        {
          name: 'Categoria Atualizada',
        },
      )
    })

    it('devolve 400 para ValidationError', async () => {
      mockUpdateCategory.mockRejectedValue(
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

    it('devolve 400 para self-parent', async () => {
      mockUpdateCategory.mockRejectedValue(
        new ForbiddenError(
          'Uma categoria não pode ser pai de si própria',
        ),
      )

      const response = await PATCH(
        patchRequest({
          parentId: 'cat-1',
        }),
        context(),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Uma categoria não pode ser pai de si própria',
      })
    })

    it('devolve 409 para conflito', async () => {
      mockUpdateCategory.mockRejectedValue(
        new ConflictError(
          'Já existe uma categoria com este slug',
        ),
      )

      const response = await PATCH(
        patchRequest({
          slug: 'slug-existente',
        }),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Já existe uma categoria com este slug',
      })
    })
  })

  describe('DELETE', () => {
    it('apaga categoria com status 200', async () => {
      mockDeleteCategory.mockResolvedValue(category)

      const response = await DELETE(
        new Request(
          'http://localhost/api/admin/categories/cat-1',
          { method: 'DELETE' },
        ),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(category)

      expect(mockDeleteCategory).toHaveBeenCalledWith('cat-1')
    })

    it('devolve 404 quando categoria não existe', async () => {
      mockDeleteCategory.mockRejectedValue(
        new NotFoundError('Categoria não encontrada'),
      )

      const response = await DELETE(
        new Request(
          'http://localhost/api/admin/categories/cat-1',
          { method: 'DELETE' },
        ),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Categoria não encontrada',
      })
    })

    it('devolve 409 quando categoria está em uso', async () => {
      mockDeleteCategory.mockRejectedValue(
        new ConflictError(
          'Não é possível apagar uma categoria com produtos associados',
        ),
      )

      const response = await DELETE(
        new Request(
          'http://localhost/api/admin/categories/cat-1',
          { method: 'DELETE' },
        ),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error:
          'Não é possível apagar uma categoria com produtos associados',
      })
    })
  })
})