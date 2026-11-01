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

vi.mock('@/server/vehicle-specs', () => {
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class ConflictError extends Error {}

  return {
    ValidationError,
    NotFoundError,
    ConflictError,
    listVehicleSpecs: vi.fn(),
    createVehicleSpec: vi.fn(),
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
  createVehicleSpec,
  listVehicleSpecs,
} from '@/server/vehicle-specs'

import { GET, POST } from './route'

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

function createGetRequest(
  query = '?modelId=model-1',
) {
  return new NextRequest(
    `http://localhost/api/admin/vehicle-specs${query}`,
  )
}

function createPostRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/vehicle-specs',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

describe('Admin Vehicle Specs API', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(
      requireAdmin,
    ).mockResolvedValue(undefined as never)
  })

  describe('GET', () => {
    test('devolve 200 com a lista de especificações', async () => {
      vi.mocked(
        listVehicleSpecs,
      ).mockResolvedValue([
        VehicleSpec,
      ])

      const response = await GET(
        createGetRequest(),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual([
        VehicleSpec,
      ])
    })

    test('passa o modelId correto para listVehicleSpecs', async () => {
      vi.mocked(
        listVehicleSpecs,
      ).mockResolvedValue([])

      await GET(
        createGetRequest(
          '?modelId=model-serie-1',
        ),
      )

      expect(
        listVehicleSpecs,
      ).toHaveBeenCalledWith(
        'model-serie-1',
      )
    })

    test('devolve 400 quando modelId está ausente', async () => {
      vi.mocked(
        listVehicleSpecs,
      ).mockRejectedValue(
        new ValidationError(
          'ID do modelo de veículo é obrigatório',
        ),
      )

      const response = await GET(
        createGetRequest(''),
      )

      expect(
        listVehicleSpecs,
      ).toHaveBeenCalledWith('')

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 400 quando modelId está vazio', async () => {
      vi.mocked(
        listVehicleSpecs,
      ).mockRejectedValue(
        new ValidationError(
          'ID do modelo de veículo é obrigatório',
        ),
      )

      const response = await GET(
        createGetRequest('?modelId='),
      )

      expect(
        listVehicleSpecs,
      ).toHaveBeenCalledWith('')

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 quando o modelo não existe', async () => {
      vi.mocked(
        listVehicleSpecs,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
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
        createGetRequest(),
      )

      expect(response.status).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        listVehicleSpecs,
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
        listVehicleSpecs,
      ).not.toHaveBeenCalled()
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)

      vi.mocked(
        listVehicleSpecs,
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
    test('cria especificação e devolve 201', async () => {
      vi.mocked(
        createVehicleSpec,
      ).mockResolvedValue(
        VehicleSpec,
      )

      const response = await POST(
        createPostRequest({
          modelId: 'model-1',
          engine: '1.5 TD',
          engineCode: '4EC1-T',
          yearStart: 1993,
          yearEnd: 2000,
          fuelType: 'DIESEL',
          powerHp: 68,
        }),
      )

      expect(response.status).toBe(201)

      await expect(
        response.json(),
      ).resolves.toEqual(
        VehicleSpec,
      )
    })

    test('passa o body correto para createVehicleSpec', async () => {
      vi.mocked(
        createVehicleSpec,
      ).mockResolvedValue(
        VehicleSpec,
      )

      const body = {
        modelId: 'model-1',
        engine: '1.5 TD',
        engineCode: null,
        yearStart: 1993,
        yearEnd: null,
        fuelType: 'DIESEL',
        powerHp: null,
      }

      await POST(
        createPostRequest(body),
      )

      expect(
        createVehicleSpec,
      ).toHaveBeenCalledWith(body)
    })

    test('devolve 400 para JSON malformado', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-specs',
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
        createVehicleSpec,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 para ValidationError', async () => {
      vi.mocked(
        createVehicleSpec,
      ).mockRejectedValue(
        new ValidationError(
          'Dados da especificação de veículo inválidos',
        ),
      )

      const response = await POST(
        createPostRequest({
          modelId: '',
          engine: '',
          yearStart: 0,
        }),
      )

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Dados inválidos',
      })
    })

    test('devolve 404 quando o modelo não existe', async () => {
      vi.mocked(
        createVehicleSpec,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
        ),
      )

      const response = await POST(
        createPostRequest({
          modelId: 'model-inexistente',
          engine: '1.5 TD',
          yearStart: 1993,
        }),
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
        createVehicleSpec,
      ).mockRejectedValue(
        new ConflictError(
          'Já existe uma especificação com este motor e ano inicial nesse modelo',
        ),
      )

      const response = await POST(
        createPostRequest({
          modelId: 'model-1',
          engine: '1.5 TD',
          yearStart: 1993,
        }),
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

      const response = await POST(
        createPostRequest({
          modelId: 'model-1',
          engine: '1.5 TD',
          yearStart: 1993,
        }),
      )

      expect(response.status).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Não autenticado',
      })

      expect(
        createVehicleSpec,
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
          modelId: 'model-1',
          engine: '1.5 TD',
          yearStart: 1993,
        }),
      )

      expect(response.status).toBe(403)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'Sem autorização',
      })

      expect(
        createVehicleSpec,
      ).not.toHaveBeenCalled()
    })

    test('devolve 500 em erro inesperado', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)

      vi.mocked(
        createVehicleSpec,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await POST(
        createPostRequest({
          modelId: 'model-1',
          engine: '1.5 TD',
          yearStart: 1993,
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