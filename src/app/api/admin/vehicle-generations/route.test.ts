import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/db', () => ({
  prisma: {},
}))

vi.mock(
  '@/server/admin-auth',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/server/admin-auth')
      >()

    return {
      ...actual,
      requireAdmin: vi.fn(),
    }
  },
)

vi.mock(
  '@/server/vehicle-generations',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/server/vehicle-generations')
      >()

    return {
      ...actual,
      listVehicleGenerations: vi.fn(),
      createVehicleGeneration: vi.fn(),
    }
  },
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createVehicleGeneration,
  listVehicleGenerations,
} from '@/server/vehicle-generations'

import { GET, POST } from './route'

const generationRecord = {
  id: 'generation-1',
  modelId: 'model-1',
  name: 'Geração Técnica',
  platform: 'PLATAFORMA-X',
  description: 'Descrição técnica',
}

describe('Admin Vehicle Generations API', () => {
  beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockReset()
})

  describe('GET', () => {
    test('devolve 200 com a lista de gerações', async () => {
      vi.mocked(
        listVehicleGenerations,
      ).mockResolvedValue([
        generationRecord,
      ])

      const request = new NextRequest(
        'http://localhost/api/admin/vehicle-generations?modelId=model-1',
      )

      const response = await GET(request)

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual([
        generationRecord,
      ])
    })

    test('passa o modelId da query string ao service', async () => {
      vi.mocked(
        listVehicleGenerations,
      ).mockResolvedValue([])

      const request = new NextRequest(
        'http://localhost/api/admin/vehicle-generations?modelId=model-123',
      )

      await GET(request)

      expect(
        listVehicleGenerations,
      ).toHaveBeenCalledWith(
        'model-123',
      )
    })

    test('devolve 400 quando modelId está ausente', async () => {
      vi.mocked(
        listVehicleGenerations,
      ).mockRejectedValue(
        new ValidationError(
          'ID do modelo de veículo é obrigatório',
        ),
      )

      const request = new NextRequest(
        'http://localhost/api/admin/vehicle-generations',
      )

      const response = await GET(request)

      expect(
        listVehicleGenerations,
      ).toHaveBeenCalledWith('')

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'ID do modelo de veículo é obrigatório',
      })
    })

    test('devolve 400 quando modelId está vazio', async () => {
      vi.mocked(
        listVehicleGenerations,
      ).mockRejectedValue(
        new ValidationError(
          'ID do modelo de veículo é obrigatório',
        ),
      )

      const request = new NextRequest(
        'http://localhost/api/admin/vehicle-generations?modelId=',
      )

      const response = await GET(request)

      expect(
        listVehicleGenerations,
      ).toHaveBeenCalledWith('')

      expect(response.status).toBe(400)
    })

    test('devolve 404 quando o modelo não existe', async () => {
      vi.mocked(
        listVehicleGenerations,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
        ),
      )

      const request = new NextRequest(
        'http://localhost/api/admin/vehicle-generations?modelId=model-inexistente',
      )

      const response = await GET(request)

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Modelo de veículo não encontrado',
      })
    })

    test('devolve 401 sem autenticação', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new UnauthorizedError(
          'Não autenticado',
        ),
      )

      const request = new NextRequest(
        'http://localhost/api/admin/vehicle-generations?modelId=model-1',
      )

      const response = await GET(request)

      expect(response.status).toBe(401)

      expect(
        listVehicleGenerations,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem permissão de administrador', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new ForbiddenError(
          'Acesso negado',
        ),
      )

      const request = new NextRequest(
        'http://localhost/api/admin/vehicle-generations?modelId=model-1',
      )

      const response = await GET(request)

      expect(response.status).toBe(403)

      expect(
        listVehicleGenerations,
      ).not.toHaveBeenCalled()
    })

    test('devolve 500 em erro inesperado', async () => {
      vi.mocked(
        listVehicleGenerations,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const request = new NextRequest(
        'http://localhost/api/admin/vehicle-generations?modelId=model-1',
      )

      const response = await GET(request)

      expect(response.status).toBe(500)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Erro interno do servidor',
      })
    })
  })

  describe('POST', () => {
    test('devolve 201 ao criar uma geração', async () => {
      vi.mocked(
        createVehicleGeneration,
      ).mockResolvedValue(
        generationRecord,
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            modelId: 'model-1',
            name: 'Geração Técnica',
            platform:
              'PLATAFORMA-X',
            description:
              'Descrição técnica',
          }),
        },
      )

      const response =
        await POST(request)

      expect(response.status).toBe(201)

      await expect(
        response.json(),
      ).resolves.toEqual(
        generationRecord,
      )
    })

    test('passa o body ao service', async () => {
      vi.mocked(
        createVehicleGeneration,
      ).mockResolvedValue(
        generationRecord,
      )

      const body = {
        modelId: 'model-1',
        name: 'Geração Técnica',
        platform: 'PLATAFORMA-X',
        description:
          'Descrição técnica',
      }

      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(body),
        },
      )

      await POST(request)

      expect(
        createVehicleGeneration,
      ).toHaveBeenCalledWith(body)
    })

    test('devolve 400 com JSON malformado', async () => {
      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: '{',
        },
      )

      const response =
        await POST(request)

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error: 'JSON inválido',
      })

      expect(
        createVehicleGeneration,
      ).not.toHaveBeenCalled()
    })

    test('devolve 400 com dados inválidos', async () => {
      vi.mocked(
        createVehicleGeneration,
      ).mockRejectedValue(
        new ValidationError(
          'Dados da geração de veículo inválidos',
        ),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            modelId: '',
            name: '',
          }),
        },
      )

      const response =
        await POST(request)

      expect(response.status).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Dados da geração de veículo inválidos',
      })
    })

    test('devolve 404 quando o modelo não existe', async () => {
      vi.mocked(
        createVehicleGeneration,
      ).mockRejectedValue(
        new NotFoundError(
          'Modelo de veículo não encontrado',
        ),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            modelId:
              'model-inexistente',
            name: 'Geração Técnica',
          }),
        },
      )

      const response =
        await POST(request)

      expect(response.status).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Modelo de veículo não encontrado',
      })
    })

    test('devolve 409 quando existe conflito', async () => {
      vi.mocked(
        createVehicleGeneration,
      ).mockRejectedValue(
        new ConflictError(
          'Já existe uma geração de veículo com este nome neste modelo',
        ),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            modelId: 'model-1',
            name: 'Geração Técnica',
          }),
        },
      )

      const response =
        await POST(request)

      expect(response.status).toBe(409)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Já existe uma geração de veículo com este nome neste modelo',
      })
    })

    test('devolve 401 sem autenticação', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new UnauthorizedError(
          'Não autenticado',
        ),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            modelId: 'model-1',
            name: 'Geração Técnica',
          }),
        },
      )

      const response =
        await POST(request)

      expect(response.status).toBe(401)

      expect(
        createVehicleGeneration,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem permissão de administrador', async () => {
      vi.mocked(
        requireAdmin,
      ).mockRejectedValue(
        new ForbiddenError(
          'Acesso negado',
        ),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            modelId: 'model-1',
            name: 'Geração Técnica',
          }),
        },
      )

      const response =
        await POST(request)

      expect(response.status).toBe(403)

      expect(
        createVehicleGeneration,
      ).not.toHaveBeenCalled()
    })

    test('devolve 500 em erro inesperado', async () => {
      vi.mocked(
        createVehicleGeneration,
      ).mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const request = new Request(
        'http://localhost/api/admin/vehicle-generations',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            modelId: 'model-1',
            name: 'Geração Técnica',
          }),
        },
      )

      const response =
        await POST(request)

      expect(response.status).toBe(500)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Erro interno do servidor',
      })
    })
  })
})