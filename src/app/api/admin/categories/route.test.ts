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

vi.mock('@/server/categories', () => {
  class ValidationError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    ConflictError,
    listCategories: vi.fn(),
    createCategory: vi.fn(),
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
  createCategory,
  listCategories,
} from '@/server/categories'
import { GET, POST } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockListCategories = vi.mocked(listCategories)
const mockCreateCategory = vi.mocked(createCategory)

describe('Admin Categories API', () => {
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
    test('devolve categorias com status 200', async () => {
      const categories = [
        {
          id: 'cat-1',
          name: 'Categoria Teste',
          slug: 'categoria-teste',
          description: null,
          parentId: null,
        },
      ]

      mockListCategories.mockResolvedValue(categories)

      const response = await GET()

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(categories)
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
    test('cria categoria com status 201', async () => {
      const category = {
        id: 'cat-1',
        name: 'Categoria Teste',
        slug: 'categoria-teste',
        description: null,
        parentId: null,
      }

      mockCreateCategory.mockResolvedValue(category)

      const request = new Request('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Categoria Teste',
          slug: 'categoria-teste',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual(category)
    })

    test('devolve 400 para ZodError', async () => {
      mockCreateCategory.mockRejectedValue(new ZodError([]))

      const request = new Request('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          slug: '',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 400 para ValidationError', async () => {
      mockCreateCategory.mockRejectedValue(
        new ValidationError('Dados inválidos'),
      )

      const request = new Request('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Categoria Teste',
          slug: 'categoria-teste',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    test('devolve 409 para slug duplicado', async () => {
      mockCreateCategory.mockRejectedValue(
        new ConflictError('Já existe uma categoria com este slug'),
      )

      const request = new Request('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Categoria Teste',
          slug: 'categoria-teste',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Já existe uma categoria com este slug',
      })
    })
  })
})