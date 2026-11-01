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
    checkProductCompatibility:
      vi.fn(),
  }
})

import {
  ValidationError,
  checkProductCompatibility,
} from '@/server/vehicles'

import {
  GET,
} from './route'

function createRequest({
  productId,
  specId,
}: {
  productId?: string
  specId?: string
}) {
  const params = new URLSearchParams()
  if (productId !== undefined) {
    params.set('productId', productId)
  }
  if (specId !== undefined) {
    params.set('specId', specId)
  }
  const query = params.toString()

  return new NextRequest(
    `http://localhost/api/vehicles/compatibility${query ? `?${query}` : ''}`,
  )
}

describe(
  'GET /api/vehicles/compatibility',
  () => {
    beforeEach(() => {
      vi.mocked(
        checkProductCompatibility,
      ).mockReset()
    })

    test(
      'devolve compatível com notas quando há ligação',
      async () => {
        const status = {
          productId: 'product-difusores',
          vehicleSpecId: 'spec-116d',
          compatible: true,
          notes: 'requer apoios originais',
        }

        vi.mocked(
          checkProductCompatibility,
        ).mockResolvedValue(status)

        const response = await GET(
          createRequest({
            productId: 'product-difusores',
            specId: 'spec-116d',
          }),
        )

        expect(response.status).toBe(200)
        await expect(
          response.json(),
        ).resolves.toEqual(status)
        expect(
          checkProductCompatibility,
        ).toHaveBeenCalledWith({
          productId: 'product-difusores',
          vehicleSpecId: 'spec-116d',
        })
      },
    )

    test(
      'devolve incompatível quando não há ligação',
      async () => {
        const status = {
          productId: 'product-x',
          vehicleSpecId: 'spec-y',
          compatible: false,
          notes: null,
        }

        vi.mocked(
          checkProductCompatibility,
        ).mockResolvedValue(status)

        const response = await GET(
          createRequest({
            productId: 'product-x',
            specId: 'spec-y',
          }),
        )

        expect(response.status).toBe(200)
        await expect(
          response.json(),
        ).resolves.toEqual(status)
      },
    )

    test(
      '400 quando os IDs não são fornecidos',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(
          checkProductCompatibility,
        ).mockRejectedValue(
          new ValidationError(
            'ID do produto é obrigatório',
          ),
        )

        const response = await GET(
          createRequest({}),
        )

        expect(response.status).toBe(400)
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
          checkProductCompatibility,
        ).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET(
          createRequest({
            productId: 'product-x',
            specId: 'spec-y',
          }),
        )

        expect(response.status).toBe(500)
        expect(consoleError).toHaveBeenCalled()
      },
    )
  },
)
