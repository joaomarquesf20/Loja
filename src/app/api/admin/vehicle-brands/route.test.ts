import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock('@/server/vehicle-brands', () => {
  class ValidationError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    ConflictError,
    listVehicleBrands: vi.fn(),
    createVehicleBrand: vi.fn(),
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
  createVehicleBrand,
  listVehicleBrands,
} from '@/server/vehicle-brands'
import { GET, POST } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockListVehicleBrands =
  vi.mocked(listVehicleBrands)
const mockCreateVehicleBrand =
  vi.mocked(createVehicleBrand)

describe('Admin Vehicle Brands API', () => {
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
      const vehicleBrands = [
        {
          id: 'brand-1',
          name: 'Marca Teste',
          slug: 'marca-teste',
        },
      ]

      mockListVehicleBrands.mockResolvedValue(
        vehicleBrands,
      )

      const response = await GET()

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(
        vehicleBrands,
      )
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await GET()

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Não autenticado',
      })

      expect(
        mockListVehicleBrands,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AdminForbiddenError(),
      )

      const response = await GET()

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Sem autorização',
      })

      expect(
        mockListVehicleBrands,
      ).not.toHaveBeenCalled()
    })

    test('devolve 500 em erro inesperado', async () => {
      mockListVehicleBrands.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await GET()

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
    })
  })

  describe('POST', () => {
    test('cria marca com status 201', async () => {
      const vehicleBrand = {
        id: 'brand-1',
        name: 'Marca Teste',
        slug: 'marca-teste',
      }

      mockCreateVehicleBrand.mockResolvedValue(
        vehicleBrand,
      )

      const body = {
        name: 'Marca Teste',
        slug: 'Marca Teste',
      }

      const request = new Request(
        'http://localhost/api/admin/vehicle-brands',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      )

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual(
        vehicleBrand,
      )

      expect(
        mockCreateVehicleBrand,
      ).toHaveBeenCalledWith(body)
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(
        new UnauthorizedError(),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-brands',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Marca Teste',
            slug: 'marca-teste',
          }),
        },
      )

      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Não autenticado',
      })

      expect(
        mockCreateVehicleBrand,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AdminForbiddenError(),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-brands',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Marca Teste',
            slug: 'marca-teste',
          }),
        },
      )

      const response = await POST(request)

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Sem autorização',
      })

      expect(
        mockCreateVehicleBrand,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para JSON inválido', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-brands',
        {
          method: 'POST',
          body: '{"name":',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })

      expect(
        mockCreateVehicleBrand,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para ValidationError', async () => {
      mockCreateVehicleBrand.mockRejectedValue(
        new ValidationError('Dados inválidos'),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-brands',
        {
          method: 'POST',
          body: JSON.stringify({
            name: '',
            slug: '',
          }),
        },
      )

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 409 para conflito', async () => {
      mockCreateVehicleBrand.mockRejectedValue(
        new ConflictError(
          'Já existe uma marca de veículo com este nome',
        ),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-brands',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Marca Teste',
            slug: 'marca-teste',
          }),
        },
      )

      const response = await POST(request)

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error:
          'Já existe uma marca de veículo com este nome',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      mockCreateVehicleBrand.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-brands',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Marca Teste',
            slug: 'marca-teste',
          }),
        },
      )

      const response = await POST(request)

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
    })
  })
})