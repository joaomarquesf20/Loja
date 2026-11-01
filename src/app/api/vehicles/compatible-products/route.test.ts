import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/vehicles', () => {
  class ValidationError extends Error {}

  return {
    ValidationError,
    getCompatibleProductIds: vi.fn(),
  }
})

import {
  ValidationError,
  getCompatibleProductIds,
} from '@/server/vehicles'

import {
  GET,
} from './route'

function createRequest(specId?: string) {
  const query =
    specId === undefined
      ? ''
      : `?specId=${encodeURIComponent(specId)}`

  return new NextRequest(
    `http://localhost/api/vehicles/compatible-products${query}`,
  )
}

describe(
  'GET /api/vehicles/compatible-products',
  () => {
    beforeEach(() => {
      vi.mocked(
        getCompatibleProductIds,
      ).mockReset()
    })

    test(
      'devolve os ids de produtos compatíveis',
      async () => {
        vi.mocked(
          getCompatibleProductIds,
        ).mockResolvedValue([
          'product-1',
          'product-2',
        ])

        const response = await GET(
          createRequest('spec-116d'),
        )

        expect(response.status).toBe(200)
        await expect(
          response.json(),
        ).resolves.toEqual({
          productIds: [
            'product-1',
            'product-2',
          ],
        })
        expect(
          getCompatibleProductIds,
        ).toHaveBeenCalledWith({
          vehicleSpecId: 'spec-116d',
        })
      },
    )

    test(
      '400 quando o specId não é fornecido',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(
          getCompatibleProductIds,
        ).mockRejectedValue(
          new ValidationError(
            'ID da especificação de veículo é obrigatório',
          ),
        )

        const response = await GET(
          createRequest(),
        )

        expect(response.status).toBe(400)
        await expect(
          response.json(),
        ).resolves.toEqual({
          error: 'Dados inválidos',
        })
        expect(consoleError).not.toHaveBeenCalled()
      },
    )

    test(
      '500 com erro inesperado da base de dados',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(
          getCompatibleProductIds,
        ).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET(
          createRequest('spec-116d'),
        )

        expect(response.status).toBe(500)
        expect(consoleError).toHaveBeenCalled()
      },
    )
  },
)
