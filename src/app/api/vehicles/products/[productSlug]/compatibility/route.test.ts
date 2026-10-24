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
    getProductVehicleCompatibility:
      vi.fn(),
  }
})

import {
  NotFoundError,
  ValidationError,
  getProductVehicleCompatibility,
  type VehicleCompatibilityStatus,
} from '@/server/vehicle-search'

import { GET } from './route'

type RouteContext = {
  params: Promise<{
    productSlug: string
  }>
}

function createContext(
  productSlug: string,
): RouteContext {
  return {
    params: Promise.resolve({
      productSlug,
    }),
  }
}

function createRequest({
  productSlug,
  configurationId,
}: {
  productSlug: string
  configurationId?: string
}) {
  const query =
    configurationId === undefined
      ? ''
      : `?configurationId=${encodeURIComponent(
          configurationId,
        )}`

  return new NextRequest(
    `http://localhost/api/vehicles/products/${productSlug}/compatibility${query}`,
  )
}

describe(
  'GET /api/vehicles/products/[productSlug]/compatibility',
  () => {
    beforeEach(() => {
      vi.mocked(
        getProductVehicleCompatibility,
      ).mockReset()
    })

    test(
      'devolve compatível quando existe ligação registada',
      async () => {
        const status = {
          configurationId: 'configuration-116d',
          compatible: true,
        } as unknown as VehicleCompatibilityStatus

        vi.mocked(
          getProductVehicleCompatibility,
        ).mockResolvedValue(status)

        const response = await GET(
          createRequest({
            productSlug: 'difusores-bm',
            configurationId:
              'configuration-116d',
          }),
          createContext('difusores-bm'),
        )

        expect(response.status).toBe(
          200,
        )
        await expect(
          response.json(),
        ).resolves.toEqual(status)
        expect(
          getProductVehicleCompatibility,
        ).toHaveBeenCalledWith(
          'difusores-bm',
          'configuration-116d',
        )
      },
    )

    test(
      'devolve não compatível quando não existe ligação',
      async () => {
        const status = {
          configurationId: 'configuration-116d',
          compatible: false,
        } as unknown as VehicleCompatibilityStatus

        vi.mocked(
          getProductVehicleCompatibility,
        ).mockResolvedValue(status)

        const response = await GET(
          createRequest({
            productSlug: 'difusores-bm',
            configurationId:
              'configuration-116d',
          }),
          createContext('difusores-bm'),
        )

        expect(response.status).toBe(
          200,
        )
        await expect(
          response.json(),
        ).resolves.toEqual(status)
      },
    )

    test(
      '400 sem configurationId no pedido',
      async () => {
        vi.mocked(
          getProductVehicleCompatibility,
        ).mockRejectedValue(
          new ValidationError(
            'ID da configuração do veículo é obrigatório',
          ),
        )

        const response = await GET(
          createRequest({
            productSlug: 'difusores-bm',
          }),
          createContext('difusores-bm'),
        )

        expect(response.status).toBe(
          400,
        )
        await expect(
          response.json(),
        ).resolves.toEqual({
          error: 'Dados inválidos',
        })
        expect(
          getProductVehicleCompatibility,
        ).toHaveBeenCalledWith(
          'difusores-bm',
          '',
        )
      },
    )

    test(
      '404 com produto inexistente',
      async () => {
        vi.mocked(
          getProductVehicleCompatibility,
        ).mockRejectedValue(
          new NotFoundError(
            'Produto não encontrado',
          ),
        )

        const response = await GET(
          createRequest({
            productSlug: 'missing',
            configurationId:
              'configuration-116d',
          }),
          createContext('missing'),
        )

        expect(response.status).toBe(
          404,
        )
        await expect(
          response.json(),
        ).resolves.toEqual({
          error: 'Produto não encontrado',
        })
      },
    )

    test(
      '404 com configuração inexistente',
      async () => {
        vi.mocked(
          getProductVehicleCompatibility,
        ).mockRejectedValue(
          new NotFoundError(
            'Configuração do veículo não encontrada',
          ),
        )

        const response = await GET(
          createRequest({
            productSlug: 'difusores-bm',
            configurationId: 'missing',
          }),
          createContext('difusores-bm'),
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
          getProductVehicleCompatibility,
        ).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET(
          createRequest({
            productSlug: 'difusores-bm',
            configurationId:
              'configuration-116d',
          }),
          createContext('difusores-bm'),
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
