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
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    getVehicleBrandById: vi.fn(),
    updateVehicleBrand: vi.fn(),
    deleteVehicleBrand: vi.fn(),
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
  deleteVehicleBrand,
  getVehicleBrandById,
  updateVehicleBrand,
} from '@/server/vehicle-brands'
import { DELETE, GET, PATCH } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetVehicleBrandById =
  vi.mocked(getVehicleBrandById)
const mockUpdateVehicleBrand =
  vi.mocked(updateVehicleBrand)
const mockDeleteVehicleBrand =
  vi.mocked(deleteVehicleBrand)

const vehicleBrand = {
  id: 'brand-1',
  name: 'Marca Teste',
  slug: 'marca-teste',
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
    'http://localhost/api/admin/vehicle-brands/brand-1',
  )
}

function patchRequest(body: unknown) {
  return new Request(
    'http://localhost/api/admin/vehicle-brands/brand-1',
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
    'http://localhost/api/admin/vehicle-brands/brand-1',
    {
      method: 'DELETE',
    },
  )
}

describe('/api/admin/vehicle-brands/[id]', () => {
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
      mockGetVehicleBrandById.mockResolvedValue(
        vehicleBrand,
      )

      const response = await GET(
        getRequest(),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(
        vehicleBrand,
      )
      expect(
        mockGetVehicleBrandById,
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
        mockGetVehicleBrandById,
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
        mockGetVehicleBrandById,
      ).not.toHaveBeenCalled()
    })

    test('devolve 404 quando marca não existe', async () => {
      mockGetVehicleBrandById.mockRejectedValue(
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
      mockGetVehicleBrandById.mockRejectedValue(
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
      const updatedVehicleBrand = {
        ...vehicleBrand,
        name: 'Marca Atualizada',
      }

      mockUpdateVehicleBrand.mockResolvedValue(
        updatedVehicleBrand,
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
        updatedVehicleBrand,
      )

      expect(
        mockUpdateVehicleBrand,
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
        mockUpdateVehicleBrand,
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
        mockUpdateVehicleBrand,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para JSON inválido', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-brands/brand-1',
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
        mockUpdateVehicleBrand,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para ValidationError', async () => {
      mockUpdateVehicleBrand.mockRejectedValue(
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
      mockUpdateVehicleBrand.mockRejectedValue(
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
      mockUpdateVehicleBrand.mockRejectedValue(
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
      mockUpdateVehicleBrand.mockRejectedValue(
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
      mockDeleteVehicleBrand.mockResolvedValue(
        vehicleBrand,
      )

      const response = await DELETE(
        deleteRequest(),
        context(),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(
        vehicleBrand,
      )

      expect(
        mockDeleteVehicleBrand,
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
        mockDeleteVehicleBrand,
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
        mockDeleteVehicleBrand,
      ).not.toHaveBeenCalled()
    })

    test('devolve 404 quando marca não existe', async () => {
      mockDeleteVehicleBrand.mockRejectedValue(
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
      mockDeleteVehicleBrand.mockRejectedValue(
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
      mockDeleteVehicleBrand.mockRejectedValue(
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