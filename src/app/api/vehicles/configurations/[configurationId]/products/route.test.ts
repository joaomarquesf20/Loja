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
    findCompatibleProductsForVehicleConfiguration:
      vi.fn(),
  }
})

import {
  NotFoundError,
  ValidationError,
  findCompatibleProductsForVehicleConfiguration,
  type VehicleCompatibleProductSummary,
} from '@/server/vehicle-search'

import { GET } from './route'

const compatibleProducts = [
  {
    id: 'product-bicos',
    slug: 'bicos-injetores-opel',
  },
  {
    id: 'product-difusores-bm',
    slug: 'difusores-bm',
  },
] as unknown as VehicleCompatibleProductSummary[]

type RouteContext = {
  params: Promise<{
    configurationId: string
  }>
}

function createContext(
  configurationId: string,
): RouteContext {
  return {
    params: Promise.resolve({
      configurationId,
    }),
  }
}

function createRequest(
  configurationId: string,
) {
  return new NextRequest(
    `http://localhost/api/vehicles/configurations/${configurationId}/products`,
  )
}

describe(
  'GET /api/vehicles/configurations/[configurationId]/products',
  () => {
    beforeEach(() => {
      vi.mocked(
        findCompatibleProductsForVehicleConfiguration,
      ).mockReset()
    })

    test(
      'devolve produtos compatíveis com a configuração',
      async () => {
        vi.mocked(
          findCompatibleProductsForVehicleConfiguration,
        ).mockResolvedValue(
          compatibleProducts,
        )

        const response = await GET(
          createRequest(
            'configuration-116d',
          ),
          createContext(
            'configuration-116d',
          ),
        )

        expect(response.status).toBe(
          200,
        )
        await expect(
          response.json(),
        ).resolves.toEqual({
          products: compatibleProducts,
        })
        expect(
          findCompatibleProductsForVehicleConfiguration,
        ).toHaveBeenCalledWith(
          'configuration-116d',
        )
      },
    )

    test(
      '400 com ID inválido',
      async () => {
        vi.mocked(
          findCompatibleProductsForVehicleConfiguration,
        ).mockRejectedValue(
          new ValidationError(
            'ID da configuração do veículo é obrigatório',
          ),
        )

        const response = await GET(
          createRequest('  '),
          createContext('  '),
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
      '404 com configuração inexistente',
      async () => {
        vi.mocked(
          findCompatibleProductsForVehicleConfiguration,
        ).mockRejectedValue(
          new NotFoundError(
            'Configuração do veículo não encontrada',
          ),
        )

        const response = await GET(
          createRequest('missing'),
          createContext('missing'),
        )

        expect(response.status).toBe(
          404,
        )
        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            'Configuração do veículo não encontrada',
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
          findCompatibleProductsForVehicleConfiguration,
        ).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET(
          createRequest(
            'configuration-116d',
          ),
          createContext(
            'configuration-116d',
          ),
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
