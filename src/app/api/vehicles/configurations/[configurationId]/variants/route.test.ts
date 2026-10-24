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
    findCompatibleVariantsForVehicleConfiguration:
      vi.fn(),
  }
})

import {
  NotFoundError,
  ValidationError,
  findCompatibleVariantsForVehicleConfiguration,
  type CompatibleVehicleVariantSummary,
} from '@/server/vehicle-search'

import { GET } from './route'

const compatibleVariants = [
  {
    id: 'variant-1',
    sku: 'BM-2-44-MPACK-SD1G',
    price: '129.90',
    stockQuantity: 9,
    images: [],
    position: 0,
    optionKey: 'default',
    product: {
      id: 'product-1',
      name: 'Difusores de Saias Laterais V.1 BMW Série 2 Gran Coupé F44',
      slug: 'difusores-bm',
      images: [],
      defaultFinish: null,
    },
  },
] as unknown as CompatibleVehicleVariantSummary[]

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
    `http://localhost/api/vehicles/configurations/${configurationId}/variants`,
  )
}

describe(
  'GET /api/vehicles/configurations/[configurationId]/variants',
  () => {
    beforeEach(() => {
      vi.mocked(
        findCompatibleVariantsForVehicleConfiguration,
      ).mockReset()
    })

    test(
      'devolve variantes compatíveis com a configuração',
      async () => {
        vi.mocked(
          findCompatibleVariantsForVehicleConfiguration,
        ).mockResolvedValue(
          compatibleVariants,
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
        ).resolves.toEqual(
          compatibleVariants,
        )
        expect(
          findCompatibleVariantsForVehicleConfiguration,
        ).toHaveBeenCalledWith(
          'configuration-116d',
        )
      },
    )

    test(
      '400 com ID inválido',
      async () => {
        vi.mocked(
          findCompatibleVariantsForVehicleConfiguration,
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
          findCompatibleVariantsForVehicleConfiguration,
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
          findCompatibleVariantsForVehicleConfiguration,
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
