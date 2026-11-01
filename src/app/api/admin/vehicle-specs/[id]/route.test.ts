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

vi.mock('@/server/vehicle-specs', () => {
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    getVehicleSpecById: vi.fn(),
    updateVehicleSpec: vi.fn(),
    deleteVehicleSpec: vi.fn(),
  }
})

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  deleteVehicleSpec,
  getVehicleSpecById,
  updateVehicleSpec,
} from '@/server/vehicle-specs'

import {
  DELETE,
  GET,
  PATCH,
} from './route'

const VehicleSpec = {
  id: 'spec-1',
  modelId: 'model-1',
  engine: '1.5 TD',
  engineCode: '4EC1-T',
  yearStart: 1993,
  yearEnd: 2000,
  fuelType: 'DIESEL',
  powerHp: 68,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function createContext(id = 'spec-1') {
  return {
    params: Promise.resolve({ id }),
  }
}

function createPatchRequest(body: unknown) {
  return new Request(
    'http://localhost/api/admin/vehicle-specs/spec-1',
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

function createRequest(method = 'GET') {
  return new Request(
    'http://localhost/api/admin/vehicle-specs/spec-1',
    {
      method,
    },
  )
}

describe('/api/admin/vehicle-specs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(
      requireAdmin,
    ).mockResolvedValue(undefined as never)
  })

  describe('GET', () => {
    test('devolve 200 com a especificação', async () => {
      vi.mocked(
        getVehicleSpecById,
      ).mockResolvedValue(VehicleSpec)

      const response = await GET(
        createRequest(),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(VehicleSpec)
    })

    test('passa o id correto para getVehicleSpecById', async () => {
      vi.mocked(
        getVehicleSpecById,
      ).mockResolvedValue(VehicleSpec)

      await GET(
        createRequest(),
        createContext('spec-technical'),
      )

      expect(
        getVehicleSpecById,
      ).toHaveBeenCalledWith(
        'spec-technical',
      )
    })

    test('devolve 400 para id vazio', async () => {
      vi.mocked(
        getVehicleSpecById,
      ).mockRejectedValue(
        new ValidationError(
          'ID da especificação de veículo é obrigatório',
        ),
      )

      const response = await GET(
        createRequest(),
        createContext(''),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 para especificação inexistente', async () => {
      vi.mocked(
        getVehicleSpecById,
      ).mockRejectedValue(
        new NotFoundError(
          'Especificação de veículo não encontrada',
        ),
      )

      const response = await GET(
        createRequest(),
        createContext(),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Especificação de veículo não encontrada',
      })
    })

    test('devolve 401 quando não está autenticado', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await GET(
        createRequest(),
        createContext(),
      )

      expect(response.status).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        getVehicleSpecById,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 quando não tem autorização', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new ForbiddenError(),
      )

      const response = await GET(
        createRequest(),
        createContext(),
      )

      expect(response.status).toBe(403)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Sem autorização',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)

      vi.mocked(
        getVehicleSpecById,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await GET(
        createRequest(),
        createContext(),
      )

      expect(response.status).toBe(500)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Erro interno do servidor',
      })

      expect(
        consoleError,
      ).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  describe('PATCH', () => {
    test('devolve 200 com especificação atualizada', async () => {
      const updatedSpec = {
        ...VehicleSpec,
        engine: '1.6 TD',
      }

      vi.mocked(
        updateVehicleSpec,
      ).mockResolvedValue(updatedSpec)

      const response = await PATCH(
        createPatchRequest({
          engine: '1.6 TD',
        }),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(updatedSpec)
    })

    test('passa id e body corretos para updateVehicleSpec', async () => {
      vi.mocked(
        updateVehicleSpec,
      ).mockResolvedValue(VehicleSpec)

      const body = {
        engine: '1.6 TD',
        engineCode: null,
        powerHp: 74,
      }

      await PATCH(
        createPatchRequest(body),
        createContext('spec-technical'),
      )

      expect(
        updateVehicleSpec,
      ).toHaveBeenCalledWith(
        'spec-technical',
        body,
      )
    })

    test('devolve 400 para JSON malformado', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-specs/spec-1',
        {
          method: 'PATCH',
          headers: {
            'content-type':
              'application/json',
          },
          body: '{',
        },
      )

      const response = await PATCH(
        request,
        createContext(),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })

      expect(
        updateVehicleSpec,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para ValidationError', async () => {
      vi.mocked(
        updateVehicleSpec,
      ).mockRejectedValue(
        new ValidationError(
          'Dados da especificação de veículo inválidos',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          engine: '',
        }),
        createContext(),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 para especificação inexistente', async () => {
      vi.mocked(
        updateVehicleSpec,
      ).mockRejectedValue(
        new NotFoundError(
          'Especificação de veículo não encontrada',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          engine: '1.6 TD',
        }),
        createContext(),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Especificação de veículo não encontrada',
      })
    })

    test('devolve 404 para modelo inexistente', async () => {
      vi.mocked(
        updateVehicleSpec,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          modelId: 'model-inexistente',
        }),
        createContext(),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Modelo de veículo não encontrado',
      })
    })

    test('devolve 409 para ConflictError', async () => {
      vi.mocked(
        updateVehicleSpec,
      ).mockRejectedValue(
        new ConflictError(
          'Já existe uma especificação com este motor e ano inicial nesse modelo',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          yearStart: 1993,
        }),
        createContext(),
      )

      expect(response.status).toBe(409)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Já existe uma especificação com este motor e ano inicial nesse modelo',
      })
    })

    test('devolve 401 quando não está autenticado', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await PATCH(
        createPatchRequest({
          engine: '1.6 TD',
        }),
        createContext(),
      )

      expect(response.status).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        updateVehicleSpec,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 quando não tem autorização', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new ForbiddenError(),
      )

      const response = await PATCH(
        createPatchRequest({
          engine: '1.6 TD',
        }),
        createContext(),
      )

      expect(response.status).toBe(403)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Sem autorização',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)

      vi.mocked(
        updateVehicleSpec,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await PATCH(
        createPatchRequest({
          engine: '1.6 TD',
        }),
        createContext(),
      )

      expect(response.status).toBe(500)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Erro interno do servidor',
      })

      expect(
        consoleError,
      ).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })

  describe('DELETE', () => {
    test('devolve 200 com a especificação apagada', async () => {
      vi.mocked(
        deleteVehicleSpec,
      ).mockResolvedValue(VehicleSpec)

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(VehicleSpec)
    })

    test('passa id correto para deleteVehicleSpec', async () => {
      vi.mocked(
        deleteVehicleSpec,
      ).mockResolvedValue(VehicleSpec)

      await DELETE(
        createRequest('DELETE'),
        createContext('spec-technical'),
      )

      expect(
        deleteVehicleSpec,
      ).toHaveBeenCalledWith(
        'spec-technical',
      )
    })

    test('devolve 400 para id vazio', async () => {
      vi.mocked(
        deleteVehicleSpec,
      ).mockRejectedValue(
        new ValidationError(
          'ID da especificação de veículo é obrigatório',
        ),
      )

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(''),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 para especificação inexistente', async () => {
      vi.mocked(
        deleteVehicleSpec,
      ).mockRejectedValue(
        new NotFoundError(
          'Especificação de veículo não encontrada',
        ),
      )

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Especificação de veículo não encontrada',
      })
    })

    test('devolve 409 quando existem compatibilidades associadas', async () => {
      vi.mocked(
        deleteVehicleSpec,
      ).mockRejectedValue(
        new ConflictError(
          'Não é possível apagar uma especificação de veículo com compatibilidades associadas',
        ),
      )

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(),
      )

      expect(response.status).toBe(409)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Não é possível apagar uma especificação de veículo com compatibilidades associadas',
      })
    })

    test('devolve 401 quando não está autenticado', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(),
      )

      expect(response.status).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        deleteVehicleSpec,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 quando não tem autorização', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new ForbiddenError(),
      )

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(),
      )

      expect(response.status).toBe(403)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Sem autorização',
      })
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)

      vi.mocked(
        deleteVehicleSpec,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(),
      )

      expect(response.status).toBe(500)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Erro interno do servidor',
      })

      expect(
        consoleError,
      ).toHaveBeenCalled()

      consoleError.mockRestore()
    })
  })
})
