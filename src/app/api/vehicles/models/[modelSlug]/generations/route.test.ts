import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/vehicle-search', () => {
  class NotFoundError extends Error {}
  class ValidationError extends Error {}

  return {
    NotFoundError,
    ValidationError,
    listVehicleGenerationOptions: vi.fn(),
  }
})

import {
  NotFoundError,
  ValidationError,
  listVehicleGenerationOptions,
  type VehicleGenerationWithConfigurations,
} from '@/server/vehicle-search'

import { GET } from './route'

const generations = [
  {
    id: 'generation-f20',
    name: 'F20',
    platform: null,
    description: null,
    configurations: [
      {
        id: 'configuration-116d',
        name: '116d',
        engineCode: 'N47D20C1',
        engineType: 'Diesel',
        displacementCc: 1995,
        powerKw: 85,
        bodyType: '5-door hatchback',
        yearFrom: 2011,
        yearTo: 2015,
      },
    ],
  },
] as unknown as VehicleGenerationWithConfigurations[]

type RouteContext = {
  params: Promise<{ modelSlug: string }>
}

function createContext(
  modelSlug: string,
): RouteContext {
  return {
    params: Promise.resolve({
      modelSlug,
    }),
  }
}

function createRequest(
  modelSlug: string,
) {
  return new NextRequest(
    `http://localhost/api/vehicles/models/${modelSlug}/generations`,
  )
}

describe(
  'GET /api/vehicles/models/[modelSlug]/generations',
  () => {
    beforeEach(() => {
      vi.mocked(
        listVehicleGenerationOptions,
      ).mockReset()
    })

    test(
      'devolve as gerações com configurações',
      async () => {
        vi.mocked(
          listVehicleGenerationOptions,
        ).mockResolvedValue(
          generations,
        )

        const response = await GET(
          createRequest('serie-1'),
          createContext('serie-1'),
        )

        expect(response.status).toBe(
          200,
        )
        await expect(
          response.json(),
        ).resolves.toEqual(generations)
        expect(
          listVehicleGenerationOptions,
        ).toHaveBeenCalledWith('serie-1')
      },
    )

    test(
      '400 com modelo inválido',
      async () => {
        vi.mocked(
          listVehicleGenerationOptions,
        ).mockRejectedValue(
          new ValidationError(
            'Modelo de veículo é obrigatório',
          ),
        )

        const response = await GET(
          createRequest(''),
          createContext(''),
        )

        expect(response.status).toBe(
          400,
        )
        await expect(
          response.json(),
        ).resolves.toEqual({
          error: 'Dados inválidos',
        })
      },
    )

    test(
      '404 com modelo inexistente',
      async () => {
        vi.mocked(
          listVehicleGenerationOptions,
        ).mockRejectedValue(
          new NotFoundError(
            'Modelo de veículo não encontrado',
          ),
        )

        const response = await GET(
          createRequest('f40'),
          createContext('f40'),
        )

        expect(response.status).toBe(
          404,
        )
        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Modelo de veículo não encontrado',
        })
      },
    )

    test(
      '500 com erro inesperado da base de dados',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(
          listVehicleGenerationOptions,
        ).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET(
          createRequest('serie-1'),
          createContext('serie-1'),
        )

        expect(response.status).toBe(
          500,
        )
        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Erro interno do servidor',
        })
        consoleError.mockRestore()
      },
    )
  },
)
