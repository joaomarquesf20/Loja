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

vi.mock('@/server/product-brands', () => {
  class ValidationError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    ConflictError,
    listProductBrands: vi.fn(),
    createProductBrand: vi.fn(),
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
  createProductBrand,
  listProductBrands,
} from '@/server/product-brands'
import { GET, POST } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockListProductBrands = vi.mocked(listProductBrands)
const mockCreateProductBrand = vi.mocked(createProductBrand)

describe('Admin Product Brands API', () => {
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
    test('devolve marcas com status 200', async () => {
      const productBrands = [
        {
          id: 'brand-1',
          name: 'Marca Teste',
          slug: 'marca-teste',
        },
      ]

      mockListProductBrands.mockResolvedValue(productBrands)

      const response = await GET()

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(productBrands)
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
    test('cria marca com status 201', async () => {
      const productBrand = {
        id: 'brand-1',
        name: 'Marca Teste',
        slug: 'marca-teste',
      }

      mockCreateProductBrand.mockResolvedValue(productBrand)

      const request = new Request('http://localhost/api/admin/product-brands', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Marca Teste',
          slug: 'marca-teste',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual(productBrand)
    })

    test('devolve 400 para ZodError', async () => {
      mockCreateProductBrand.mockRejectedValue(new ZodError([]))

      const request = new Request('http://localhost/api/admin/product-brands', {
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
      mockCreateProductBrand.mockRejectedValue(
        new ValidationError('Dados inválidos'),
      )

      const request = new Request('http://localhost/api/admin/product-brands', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Marca Teste',
          slug: 'marca-teste',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    test('devolve 409 para slug duplicado', async () => {
      mockCreateProductBrand.mockRejectedValue(
        new ConflictError('Já existe uma marca com este slug'),
      )

      const request = new Request('http://localhost/api/admin/product-brands', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Marca Teste',
          slug: 'marca-teste',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Já existe uma marca com este slug',
      })
    })
  })
})