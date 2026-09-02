import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { NextRequest } from 'next/server'

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
    listVehicleModels: vi.fn(),
    createVehicleModel: vi.fn(),
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
  createVehicleModel,
  listVehicleModels,
} from '@/server/vehicle-models'

import { GET, POST } from './route'

const vehicleModel = {
  id: 'model-1',
  brandId: 'brand-1',
  name: 'Modelo Técnico',
  slug: 'modelo-tecnico',
  description: null,
}

function createGetRequest(
  query = '?brandId=brand-1',
) {
  return new NextRequest(
    `http://localhost/api/admin/vehicle-models${query}`,
  )
}

function createPostRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/vehicle-models',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

describe('Admin Vehicle Models API', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(
      requireAdmin,
    ).mockResolvedValue(undefined as never)
  })

  describe('GET', () => {
    test('devolve 200 com a lista de modelos', async () => {
      vi.mocked(
        listVehicleModels,
      ).mockResolvedValue([
        vehicleModel,
      ])

      const response = await GET(
        createGetRequest(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual([
        vehicleModel,
      ])
    })

    test('passa o brandId correto para listVehicleModels', async () => {
      vi.mocked(
        listVehicleModels,
      ).mockResolvedValue([])

      await GET(
        createGetRequest(
          '?brandId=brand-technical',
        ),
      )

      expect(
        listVehicleModels,
      ).toHaveBeenCalledWith(
        'brand-technical',
      )
    })

    test('devolve 400 quando brandId está ausente', async () => {
      vi.mocked(
        listVehicleModels,
      ).mockRejectedValue(
        new ValidationError(
          'ID da marca de veículo é obrigatório',
        ),
      )

      const response = await GET(
        createGetRequest(''),
      )

      expect(
        listVehicleModels,
      ).toHaveBeenCalledWith('')

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 400 quando brandId está vazio', async () => {
      vi.mocked(
        listVehicleModels,
      ).mockRejectedValue(
        new ValidationError(
          'ID da marca de veículo é obrigatório',
        ),
      )

      const response = await GET(
        createGetRequest('?brandId='),
      )

      expect(
        listVehicleModels,
      ).toHaveBeenCalledWith('')

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 quando a marca não existe', async () => {
      vi.mocked(
        listVehicleModels,
      ).mockRejectedValue(
        new NotFoundError(
          'Marca de veículo não encontrada',
        ),
      )

      const response = await GET(
        createGetRequest(),
      )

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Marca de veículo não encontrada',
      })
    })

    test('devolve 401 quando não está autenticado', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await GET(
        createGetRequest(),
      )

      expect(response.status).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        listVehicleModels,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 quando não tem autorização', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new ForbiddenError(),
      )

      const response = await GET(
        createGetRequest(),
      )

      expect(response.status).toBe(403)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Sem autorização',
      })

      expect(
        listVehicleModels,
      ).not.toHaveBeenCalled()
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)

      vi.mocked(
        listVehicleModels,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await GET(
        createGetRequest(),
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

  describe('POST', () => {
    test('cria modelo e devolve 201', async () => {
      vi.mocked(
        createVehicleModel,
      ).mockResolvedValue(
        vehicleModel,
      )

      const response = await POST(
        createPostRequest({
          brandId: 'brand-1',
          name: 'Modelo Técnico',
          slug: 'modelo-tecnico',
        }),
      )

      expect(response.status).toBe(201)

      await expect(
        response.json(),
      ).resolves.toEqual(
        vehicleModel,
      )
    })

    test('passa o body correto para createVehicleModel', async () => {
      vi.mocked(
        createVehicleModel,
      ).mockResolvedValue(
        vehicleModel,
      )

      const body = {
        brandId: 'brand-1',
        name: 'Modelo Técnico',
        slug: 'modelo-tecnico',
        description:
          'Descrição técnica',
      }

      await POST(
        createPostRequest(body),
      )

      expect(
        createVehicleModel,
      ).toHaveBeenCalledWith(body)
    })

    test('devolve 400 para JSON malformado', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-models',
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body: '{',
        },
      )

      const response = await POST(request)

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })

      expect(
        createVehicleModel,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para ValidationError', async () => {
      vi.mocked(
        createVehicleModel,
      ).mockRejectedValue(
        new ValidationError(
          'Dados do modelo de veículo inválidos',
        ),
      )

      const response = await POST(
        createPostRequest({
          brandId: '',
          name: '',
          slug: '',
        }),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 quando a marca não existe', async () => {
      vi.mocked(
        createVehicleModel,
      ).mockRejectedValue(
        new NotFoundError(
          'Marca de veículo não encontrada',
        ),
      )

      const response = await POST(
        createPostRequest({
          brandId: 'brand-inexistente',
          name: 'Modelo Técnico',
          slug: 'modelo-tecnico',
        }),
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
        createVehicleModel,
      ).mockRejectedValue(
        new ConflictError(
          'Já existe um modelo de veículo com este slug nessa marca',
        ),
      )

      const response = await POST(
        createPostRequest({
          brandId: 'brand-1',
          name: 'Modelo Técnico',
          slug: 'modelo-tecnico',
        }),
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

      const response = await POST(
        createPostRequest({
          brandId: 'brand-1',
          name: 'Modelo Técnico',
          slug: 'modelo-tecnico',
        }),
      )

      expect(response.status).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        createVehicleModel,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 quando não tem autorização', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new ForbiddenError(),
      )

      const response = await POST(
        createPostRequest({
          brandId: 'brand-1',
          name: 'Modelo Técnico',
          slug: 'modelo-tecnico',
        }),
      )

      expect(response.status).toBe(403)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Sem autorização',
      })

      expect(
        createVehicleModel,
      ).not.toHaveBeenCalled()
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)

      vi.mocked(
        createVehicleModel,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await POST(
        createPostRequest({
          brandId: 'brand-1',
          name: 'Modelo Técnico',
          slug: 'modelo-tecnico',
        }),
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