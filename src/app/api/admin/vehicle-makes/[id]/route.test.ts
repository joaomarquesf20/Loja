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

vi.mock('@/server/vehicle-makes', () => {
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    getVehicleMakeById: vi.fn(),
    updateVehicleMake: vi.fn(),
    deleteVehicleMake: vi.fn(),
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
  deleteVehicleMake,
  getVehicleMakeById,
  updateVehicleMake,
} from '@/server/vehicle-makes'
import { DELETE, GET, PATCH } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetVehicleMakeById =
  vi.mocked(getVehicleMakeById)
const mockUpdateVehicleMake =
  vi.mocked(updateVehicleMake)
const mockDeleteVehicleMake =
  vi.mocked(deleteVehicleMake)

const VehicleMake = {
  id: 'brand-1',
  name: 'Marca Teste',
  slug: 'marca-teste',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function context() {
  return {
    params: Promise.resolve({
      id: 'brand-1',
    }),
  }
}

function getRequest() {
  return new Request(
    'http://localhost/api/admin/vehicle-makes/brand-1',
  )
}

function patchRequest(body: unknown) {
  return new Request(
    'http://localhost/api/admin/vehicle-makes/brand-1',
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
    'http://localhost/api/admin/vehicle-makes/brand-1',
    {
      method: 'DELETE',
    },
  )
}

describe('/api/admin/vehicle-makes/[id]', () => {
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
    test('devolve marca com status 200', async () => {
      mockGetVehicleMakeById.mockResolvedValue(
        VehicleMake,
      )

      const response = await GET(
        getRequest(),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(
        VehicleMake,
      )
      expect(
        mockGetVehicleMakeById,
      ).toHaveBeenCalledWith('brand-1')
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await GET(
        getRequest(),
        context(),
      )

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Não autenticado',
      })

      expect(
        mockGetVehicleMakeById,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AdminForbiddenError(),
      )

      const response = await GET(
        getRequest(),
        context(),
      )

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Sem autorização',
      })

      expect(
        mockGetVehicleMakeById,
      ).not.toHaveBeenCalled()
    })

    test('devolve 404 quando marca não existe', async () => {
      mockGetVehicleMakeById.mockRejectedValue(
        new NotFoundError(
          'Marca de veículo não encontrada',
        ),
      )

      const response = await GET(
        getRequest(),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Marca de veículo não encontrada',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      mockGetVehicleMakeById.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await GET(
        getRequest(),
        context(),
      )

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
    })
  })

  describe('PATCH', () => {
    test('atualiza marca com status 200', async () => {
      const updatedVehicleMake = {
        ...VehicleMake,
        name: 'Marca Atualizada',
      }

      mockUpdateVehicleMake.mockResolvedValue(
        updatedVehicleMake,
      )

      const body = {
        name: 'Marca Atualizada',
      }

      const response = await PATCH(
        patchRequest(body),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(
        updatedVehicleMake,
      )

      expect(
        mockUpdateVehicleMake,
      ).toHaveBeenCalledWith(
        'brand-1',
        body,
      )
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await PATCH(
        patchRequest({
          name: 'Marca Atualizada',
        }),
        context(),
      )

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Não autenticado',
      })

      expect(
        mockUpdateVehicleMake,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AdminForbiddenError(),
      )

      const response = await PATCH(
        patchRequest({
          name: 'Marca Atualizada',
        }),
        context(),
      )

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Sem autorização',
      })

      expect(
        mockUpdateVehicleMake,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para JSON inválido', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-makes/brand-1',
        {
          method: 'PATCH',
          body: '{"name":',
          headers: {
            'Content-Type':
              'application/json',
          },
        },
      )

      const response = await PATCH(
        request,
        context(),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })

      expect(
        mockUpdateVehicleMake,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para ValidationError', async () => {
      mockUpdateVehicleMake.mockRejectedValue(
        new ValidationError('Dados inválidos'),
      )

      const response = await PATCH(
        patchRequest({
          name: '',
        }),
        context(),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 quando marca não existe', async () => {
      mockUpdateVehicleMake.mockRejectedValue(
        new NotFoundError(
          'Marca de veículo não encontrada',
        ),
      )

      const response = await PATCH(
        patchRequest({
          name: 'Marca Atualizada',
        }),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Marca de veículo não encontrada',
      })
    })

    test('devolve 409 para conflito', async () => {
      mockUpdateVehicleMake.mockRejectedValue(
        new ConflictError(
          'Já existe uma marca de veículo com este nome',
        ),
      )

      const response = await PATCH(
        patchRequest({
          name: 'Marca Existente',
        }),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error:
          'Já existe uma marca de veículo com este nome',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      mockUpdateVehicleMake.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await PATCH(
        patchRequest({
          name: 'Marca Atualizada',
        }),
        context(),
      )

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
    })
  })

  describe('DELETE', () => {
    test('apaga marca com status 200', async () => {
      mockDeleteVehicleMake.mockResolvedValue(
        VehicleMake,
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(
        VehicleMake,
      )

      expect(
        mockDeleteVehicleMake,
      ).toHaveBeenCalledWith('brand-1')
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Não autenticado',
      })

      expect(
        mockDeleteVehicleMake,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(
        new AdminForbiddenError(),
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Sem autorização',
      })

      expect(
        mockDeleteVehicleMake,
      ).not.toHaveBeenCalled()
    })

    test('devolve 404 quando marca não existe', async () => {
      mockDeleteVehicleMake.mockRejectedValue(
        new NotFoundError(
          'Marca de veículo não encontrada',
        ),
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Marca de veículo não encontrada',
      })
    })

    test('devolve 409 quando marca está em uso', async () => {
      mockDeleteVehicleMake.mockRejectedValue(
        new ConflictError(
          'Não é possível apagar uma marca de veículo com modelos associados',
        ),
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error:
          'Não é possível apagar uma marca de veículo com modelos associados',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      mockDeleteVehicleMake.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
    })
  })
})