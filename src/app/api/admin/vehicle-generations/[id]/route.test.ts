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

vi.mock('@/server/vehicle-generations', () => {
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    getVehicleGenerationById: vi.fn(),
    updateVehicleGeneration: vi.fn(),
    deleteVehicleGeneration: vi.fn(),
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
  deleteVehicleGeneration,
  getVehicleGenerationById,
  updateVehicleGeneration,
} from '@/server/vehicle-generations'

import {
  DELETE,
  GET,
  PATCH,
} from './route'

const vehicleGeneration = {
  id: 'generation-1',
  modelId: 'model-1',
  name: 'Geração Técnica',
  platform: 'PLATAFORMA-X',
  description: null,
}

function createContext(
  id = 'generation-1',
) {
  return {
    params: Promise.resolve({ id }),
  }
}

function createPatchRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/vehicle-generations/generation-1',
    {
      method: 'PATCH',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

function createRequest(
  method = 'GET',
) {
  return new Request(
    'http://localhost/api/admin/vehicle-generations/generation-1',
    {
      method,
    },
  )
}

describe('/api/admin/vehicle-generations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(
      requireAdmin,
    ).mockResolvedValue(
      undefined as never,
    )
  })

  describe('GET', () => {
    test('devolve 200 com a geração', async () => {
      vi.mocked(
        getVehicleGenerationById,
      ).mockResolvedValue(
        vehicleGeneration,
      )

      const response = await GET(
        createRequest(),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(
        vehicleGeneration,
      )
    })

    test('passa o id correto para getVehicleGenerationById', async () => {
      vi.mocked(
        getVehicleGenerationById,
      ).mockResolvedValue(
        vehicleGeneration,
      )

      await GET(
        createRequest(),
        createContext(
          'generation-technical',
        ),
      )

      expect(
        getVehicleGenerationById,
      ).toHaveBeenCalledWith(
        'generation-technical',
      )
    })

    test('devolve 400 para id vazio', async () => {
      vi.mocked(
        getVehicleGenerationById,
      ).mockRejectedValue(
        new ValidationError(
          'ID da geração de veículo é obrigatório',
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

    test('devolve 404 para geração inexistente', async () => {
      vi.mocked(
        getVehicleGenerationById,
      ).mockRejectedValue(
        new NotFoundError(
          'Geração de veículo não encontrada',
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
          'Geração de veículo não encontrada',
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
        getVehicleGenerationById,
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
        .mockImplementation(
          () => undefined,
        )

      vi.mocked(
        getVehicleGenerationById,
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
    test('devolve 200 com geração atualizada', async () => {
      const updatedGeneration = {
        ...vehicleGeneration,
        name: 'Geração Atualizada',
      }

      vi.mocked(
        updateVehicleGeneration,
      ).mockResolvedValue(
        updatedGeneration,
      )

      const response = await PATCH(
        createPatchRequest({
          name: 'Geração Atualizada',
        }),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(
        updatedGeneration,
      )
    })

    test('passa id e body corretos para updateVehicleGeneration', async () => {
      vi.mocked(
        updateVehicleGeneration,
      ).mockResolvedValue(
        vehicleGeneration,
      )

      const body = {
        name: 'Geração Atualizada',
        platform:
          'PLATAFORMA-ATUALIZADA',
        description:
          'Descrição técnica atualizada',
      }

      await PATCH(
        createPatchRequest(body),
        createContext(
          'generation-technical',
        ),
      )

      expect(
        updateVehicleGeneration,
      ).toHaveBeenCalledWith(
        'generation-technical',
        body,
      )
    })

    test('devolve 400 para JSON malformado', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-generations/generation-1',
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
        updateVehicleGeneration,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para ValidationError', async () => {
      vi.mocked(
        updateVehicleGeneration,
      ).mockRejectedValue(
        new ValidationError(
          'Dados da geração de veículo inválidos',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          name: '',
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

    test('devolve 404 para geração inexistente', async () => {
      vi.mocked(
        updateVehicleGeneration,
      ).mockRejectedValue(
        new NotFoundError(
          'Geração de veículo não encontrada',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          name: 'Geração Atualizada',
        }),
        createContext(),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Geração de veículo não encontrada',
      })
    })

    test('devolve 404 para modelo inexistente', async () => {
      vi.mocked(
        updateVehicleGeneration,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          modelId:
            'model-inexistente',
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
        updateVehicleGeneration,
      ).mockRejectedValue(
        new ConflictError(
          'Já existe uma geração de veículo com este nome neste modelo',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          name: 'Nome Ocupado',
        }),
        createContext(),
      )

      expect(response.status).toBe(409)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Já existe uma geração de veículo com este nome neste modelo',
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
          name: 'Geração Atualizada',
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
        updateVehicleGeneration,
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
          name: 'Geração Atualizada',
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
        .mockImplementation(
          () => undefined,
        )

      vi.mocked(
        updateVehicleGeneration,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await PATCH(
        createPatchRequest({
          name: 'Geração Atualizada',
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
    test('devolve 200 com geração apagada', async () => {
      vi.mocked(
        deleteVehicleGeneration,
      ).mockResolvedValue(
        vehicleGeneration,
      )

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(
        vehicleGeneration,
      )
    })

    test('passa id correto para deleteVehicleGeneration', async () => {
      vi.mocked(
        deleteVehicleGeneration,
      ).mockResolvedValue(
        vehicleGeneration,
      )

      await DELETE(
        createRequest('DELETE'),
        createContext(
          'generation-technical',
        ),
      )

      expect(
        deleteVehicleGeneration,
      ).toHaveBeenCalledWith(
        'generation-technical',
      )
    })

    test('devolve 400 para id vazio', async () => {
      vi.mocked(
        deleteVehicleGeneration,
      ).mockRejectedValue(
        new ValidationError(
          'ID da geração de veículo é obrigatório',
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

    test('devolve 404 para geração inexistente', async () => {
      vi.mocked(
        deleteVehicleGeneration,
      ).mockRejectedValue(
        new NotFoundError(
          'Geração de veículo não encontrada',
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
          'Geração de veículo não encontrada',
      })
    })

    test('devolve 409 quando existem configurações associadas', async () => {
      vi.mocked(
        deleteVehicleGeneration,
      ).mockRejectedValue(
        new ConflictError(
          'Não é possível apagar uma geração de veículo com configurações associadas',
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
          'Não é possível apagar uma geração de veículo com configurações associadas',
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
        deleteVehicleGeneration,
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
        .mockImplementation(
          () => undefined,
        )

      vi.mocked(
        deleteVehicleGeneration,
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