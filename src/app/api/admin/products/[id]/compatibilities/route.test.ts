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

vi.mock('@/server/product-compatibilities', () => ({
  listProductCompatibilities: vi.fn(),
  addProductCompatibility: vi.fn(),
  removeProductCompatibility: vi.fn(),
}))

vi.mock('@/server/products', () => {
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
  }
})

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  addProductCompatibility,
  listProductCompatibilities,
  removeProductCompatibility,
} from '@/server/product-compatibilities'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/server/products'
import { DELETE, GET, POST } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockListProductCompatibilities =
  vi.mocked(listProductCompatibilities)
const mockAddProductCompatibility =
  vi.mocked(addProductCompatibility)
const mockRemoveProductCompatibility =
  vi.mocked(removeProductCompatibility)

const compatibility = {
  id: 'compatibility-test',
  productId: 'product-test',
  vehicleConfigurationId: 'vehicle-configuration-test',
}

const compatibilityListRecord = {
  ...compatibility,
  vehicleBrand: {
    id: 'brand-test',
    name: 'Volkswagen',
  },
  vehicleModel: {
    id: 'model-test',
    name: 'Golf',
  },
  vehicleGeneration: {
    id: 'generation-test',
    name: 'Mk7',
  },
  vehicleConfiguration: {
    id: 'vehicle-configuration-test',
    name: '2.0 TDI 150',
    engineCode: 'EA288',
    engineType: 'Diesel',
    displacementCc: 1968,
    powerKw: 110.5,
    bodyType: 'Hatchback',
    yearFrom: 2013,
    yearTo: 2020,
  },
}

function context() {
  return {
    params: Promise.resolve({
      id: 'product-test',
    }),
  }
}

function requestWithBody(
  method: 'POST' | 'DELETE',
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/products/product-test/compatibilities',
    {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

describe('Admin Product Compatibilities API', () => {
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
    test('devolve compatibilidades com status 200', async () => {
      mockListProductCompatibilities.mockResolvedValue([
        compatibilityListRecord,
      ])

      const response = await GET(
        new Request(
          'http://localhost/api/admin/products/product-test/compatibilities',
        ),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual([
        compatibilityListRecord,
      ])
      expect(
        mockListProductCompatibilities,
      ).toHaveBeenCalledWith('product-test')
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await GET(
        new Request(
          'http://localhost/api/admin/products/product-test/compatibilities',
        ),
        context(),
      )

      expect(response.status).toBe(401)
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AdminForbiddenError(),
      )

      const response = await GET(
        new Request(
          'http://localhost/api/admin/products/product-test/compatibilities',
        ),
        context(),
      )

      expect(response.status).toBe(403)
    })

    test('devolve 404 quando produto não existe', async () => {
      mockListProductCompatibilities.mockRejectedValue(
        new NotFoundError('Produto não encontrado'),
      )

      const response = await GET(
        new Request(
          'http://localhost/api/admin/products/product-test/compatibilities',
        ),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Produto não encontrado',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      mockListProductCompatibilities.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await GET(
        new Request(
          'http://localhost/api/admin/products/product-test/compatibilities',
        ),
        context(),
      )

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
    })
  })

  describe('POST', () => {
    test('cria compatibilidade com status 201', async () => {
      mockAddProductCompatibility.mockResolvedValue(
        compatibility,
      )

      const response = await POST(
        requestWithBody('POST', {
          vehicleConfigurationId:
            'vehicle-configuration-test',
        }),
        context(),
      )

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual(
        compatibility,
      )
      expect(
        mockAddProductCompatibility,
      ).toHaveBeenCalledWith(
        'product-test',
        'vehicle-configuration-test',
      )
    })

    test('devolve 400 sem vehicleConfigurationId', async () => {
      const response = await POST(
        requestWithBody('POST', {}),
        context(),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 400 para ValidationError', async () => {
      mockAddProductCompatibility.mockRejectedValue(
        new ValidationError('Dados inválidos'),
      )

      const response = await POST(
        requestWithBody('POST', {
          vehicleConfigurationId:
            'vehicle-configuration-test',
        }),
        context(),
      )

      expect(response.status).toBe(400)
    })

    test('devolve 404 para NotFoundError', async () => {
      mockAddProductCompatibility.mockRejectedValue(
        new NotFoundError(
          'Configuração do veículo não encontrada',
        ),
      )

      const response = await POST(
        requestWithBody('POST', {
          vehicleConfigurationId:
            'vehicle-configuration-test',
        }),
        context(),
      )

      expect(response.status).toBe(404)
    })

    test('devolve 409 para associação duplicada', async () => {
      mockAddProductCompatibility.mockRejectedValue(
        new ConflictError(
          'Este produto já está associado a esta configuração de veículo',
        ),
      )

      const response = await POST(
        requestWithBody('POST', {
          vehicleConfigurationId:
            'vehicle-configuration-test',
        }),
        context(),
      )

      expect(response.status).toBe(409)
    })

    test('devolve 400 para ZodError', async () => {
      mockAddProductCompatibility.mockRejectedValue(
        new ZodError([]),
      )

      const response = await POST(
        requestWithBody('POST', {
          vehicleConfigurationId:
            'vehicle-configuration-test',
        }),
        context(),
      )

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE', () => {
    test('remove compatibilidade com status 200', async () => {
      mockRemoveProductCompatibility.mockResolvedValue(
        compatibility,
      )

      const response = await DELETE(
        requestWithBody('DELETE', {
          vehicleConfigurationId:
            'vehicle-configuration-test',
        }),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(
        compatibility,
      )
      expect(
        mockRemoveProductCompatibility,
      ).toHaveBeenCalledWith(
        'product-test',
        'vehicle-configuration-test',
      )
    })

    test('devolve 400 sem vehicleConfigurationId', async () => {
      const response = await DELETE(
        requestWithBody('DELETE', {}),
        context(),
      )

      expect(response.status).toBe(400)
    })

    test('devolve 400 para ValidationError', async () => {
      mockRemoveProductCompatibility.mockRejectedValue(
        new ValidationError('Dados inválidos'),
      )

      const response = await DELETE(
        requestWithBody('DELETE', {
          vehicleConfigurationId:
            'vehicle-configuration-test',
        }),
        context(),
      )

      expect(response.status).toBe(400)
    })

    test('devolve 404 quando associação não existe', async () => {
      mockRemoveProductCompatibility.mockRejectedValue(
        new NotFoundError(
          'Associação de compatibilidade não encontrada',
        ),
      )

      const response = await DELETE(
        requestWithBody('DELETE', {
          vehicleConfigurationId:
            'vehicle-configuration-test',
        }),
        context(),
      )

      expect(response.status).toBe(404)
    })
  })
})