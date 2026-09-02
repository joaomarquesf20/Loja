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

vi.mock('@/server/vehicle-models', () => {
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    getVehicleModelById: vi.fn(),
    updateVehicleModel: vi.fn(),
    deleteVehicleModel: vi.fn(),
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
  deleteVehicleModel,
  getVehicleModelById,
  updateVehicleModel,
} from '@/server/vehicle-models'

import {
  DELETE,
  GET,
  PATCH,
} from './route'

const vehicleModel = {
  id: 'model-1',
  brandId: 'brand-1',
  name: 'Modelo Técnico',
  slug: 'modelo-tecnico',
  description: null,
}

function createContext(id = 'model-1') {
  return {
    params: Promise.resolve({ id }),
  }
}

function createPatchRequest(body: unknown) {
  return new Request(
    'http://localhost/api/admin/vehicle-models/model-1',
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
    'http://localhost/api/admin/vehicle-models/model-1',
    {
      method,
    },
  )
}

describe('/api/admin/vehicle-models/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(
      requireAdmin,
    ).mockResolvedValue(undefined as never)
  })

  describe('GET', () => {
    test('devolve 200 com o modelo', async () => {
      vi.mocked(
        getVehicleModelById,
      ).mockResolvedValue(vehicleModel)

      const response = await GET(
        createRequest(),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(vehicleModel)
    })

    test('passa o id correto para getVehicleModelById', async () => {
      vi.mocked(
        getVehicleModelById,
      ).mockResolvedValue(vehicleModel)

      await GET(
        createRequest(),
        createContext('model-technical'),
      )

      expect(
        getVehicleModelById,
      ).toHaveBeenCalledWith(
        'model-technical',
      )
    })

    test('devolve 400 para id vazio', async () => {
      vi.mocked(
        getVehicleModelById,
      ).mockRejectedValue(
        new ValidationError(
          'ID do modelo de veículo é obrigatório',
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

    test('devolve 404 para modelo inexistente', async () => {
      vi.mocked(
        getVehicleModelById,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
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
          'Modelo de veículo não encontrado',
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
        getVehicleModelById,
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
        getVehicleModelById,
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
    test('devolve 200 com modelo atualizado', async () => {
      const updatedModel = {
        ...vehicleModel,
        name: 'Modelo Atualizado',
      }

      vi.mocked(
        updateVehicleModel,
      ).mockResolvedValue(updatedModel)

      const response = await PATCH(
        createPatchRequest({
          name: 'Modelo Atualizado',
        }),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(updatedModel)
    })

    test('passa id e body corretos para updateVehicleModel', async () => {
      vi.mocked(
        updateVehicleModel,
      ).mockResolvedValue(vehicleModel)

      const body = {
        name: 'Modelo Atualizado',
        slug: 'modelo-atualizado',
        description:
          'Descrição técnica atualizada',
      }

      await PATCH(
        createPatchRequest(body),
        createContext('model-technical'),
      )

      expect(
        updateVehicleModel,
      ).toHaveBeenCalledWith(
        'model-technical',
        body,
      )
    })

    test('devolve 400 para JSON malformado', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-models/model-1',
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
        updateVehicleModel,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para ValidationError', async () => {
      vi.mocked(
        updateVehicleModel,
      ).mockRejectedValue(
        new ValidationError(
          'Dados do modelo de veículo inválidos',
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

    test('devolve 404 para modelo inexistente', async () => {
      vi.mocked(
        updateVehicleModel,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          name: 'Modelo Atualizado',
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

    test('devolve 404 para marca inexistente', async () => {
      vi.mocked(
        updateVehicleModel,
      ).mockRejectedValue(
        new NotFoundError(
          'Marca de veículo não encontrada',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          brandId: 'brand-inexistente',
        }),
        createContext(),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Marca de veículo não encontrada',
      })
    })

    test('devolve 409 para ConflictError', async () => {
      vi.mocked(
        updateVehicleModel,
      ).mockRejectedValue(
        new ConflictError(
          'Já existe um modelo de veículo com este slug nessa marca',
        ),
      )

      const response = await PATCH(
        createPatchRequest({
          slug: 'slug-ocupado',
        }),
        createContext(),
      )

      expect(response.status).toBe(409)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Já existe um modelo de veículo com este slug nessa marca',
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
          name: 'Modelo Atualizado',
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
        updateVehicleModel,
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
          name: 'Modelo Atualizado',
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
        updateVehicleModel,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await PATCH(
        createPatchRequest({
          name: 'Modelo Atualizado',
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
    test('devolve 200 com modelo apagado', async () => {
      vi.mocked(
        deleteVehicleModel,
      ).mockResolvedValue(vehicleModel)

      const response = await DELETE(
        createRequest('DELETE'),
        createContext(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual(vehicleModel)
    })

    test('passa id correto para deleteVehicleModel', async () => {
      vi.mocked(
        deleteVehicleModel,
      ).mockResolvedValue(vehicleModel)

      await DELETE(
        createRequest('DELETE'),
        createContext('model-technical'),
      )

      expect(
        deleteVehicleModel,
      ).toHaveBeenCalledWith(
        'model-technical',
      )
    })

    test('devolve 400 para id vazio', async () => {
      vi.mocked(
        deleteVehicleModel,
      ).mockRejectedValue(
        new ValidationError(
          'ID do modelo de veículo é obrigatório',
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

    test('devolve 404 para modelo inexistente', async () => {
      vi.mocked(
        deleteVehicleModel,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
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
          'Modelo de veículo não encontrado',
      })
    })

    test('devolve 409 quando existem gerações associadas', async () => {
      vi.mocked(
        deleteVehicleModel,
      ).mockRejectedValue(
        new ConflictError(
          'Não é possível apagar um modelo de veículo com gerações associadas',
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
          'Não é possível apagar um modelo de veículo com gerações associadas',
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
        deleteVehicleModel,
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
        deleteVehicleModel,
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