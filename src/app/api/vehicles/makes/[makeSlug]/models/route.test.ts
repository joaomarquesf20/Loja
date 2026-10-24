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
    listVehicleModelOptions: vi.fn(),
  }
})

import {
  NotFoundError,
  ValidationError,
  listVehicleModelOptions,
} from '@/server/vehicle-search'

import { GET } from './route'

const vehicleModels = [
  {
    id: 'model-serie-1',
    name: 'Série 1',
    slug: 'serie-1',
    description: null,
  },
]

type RouteContext = {
  params: Promise<{ makeSlug: string }>
}

function createContext(
  makeSlug: string,
): RouteContext {
  return {
    params: Promise.resolve({
      makeSlug,
    }),
  }
}

function createRequest(
  makeSlug: string,
) {
  return new NextRequest(
    `http://localhost/api/vehicles/makes/${makeSlug}/models`,
  )
}

describe(
  'GET /api/vehicles/makes/[makeSlug]/models',
  () => {
    beforeEach(() => {
      vi.mocked(
        listVehicleModelOptions,
      ).mockReset()
    })

    test(
      'devolve os modelos da marca',
      async () => {
        vi.mocked(
          listVehicleModelOptions,
        ).mockResolvedValue(
          vehicleModels,
        )

        const response = await GET(
          createRequest('dev-bmw'),
          createContext('dev-bmw'),
        )

        expect(response.status).toBe(
          200,
        )
        await expect(
          response.json(),
        ).resolves.toEqual(
          vehicleModels,
        )
        expect(
          listVehicleModelOptions,
        ).toHaveBeenCalledWith(
          'dev-bmw',
        )
      },
    )

    test(
      '400 com make inválido',
      async () => {
        vi.mocked(
          listVehicleModelOptions,
        ).mockRejectedValue(
          new ValidationError(
            'Marca de veículo é obrigatória',
          ),
        )

        const response = await GET(
          createRequest('   '),
          createContext('   '),
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
      '404 com marca inexistente',
      async () => {
        vi.mocked(
          listVehicleModelOptions,
        ).mockRejectedValue(
          new NotFoundError(
            'Marca de veículo não encontrada',
          ),
        )

        const response = await GET(
          createRequest('dev-opel'),
          createContext('dev-opel'),
        )

        expect(response.status).toBe(
          404,
        )
        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Marca de veículo não encontrada',
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
          listVehicleModelOptions,
        ).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET(
          createRequest('dev-bmw'),
          createContext('dev-bmw'),
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
