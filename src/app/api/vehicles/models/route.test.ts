import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/vehicles', () => {
  class NotFoundError extends Error {}
  class ValidationError extends Error {}

  return {
    NotFoundError,
    ValidationError,
    getVehicleModels: vi.fn(),
  }
})

import {
  NotFoundError,
  ValidationError,
  getVehicleModels,
} from '@/server/vehicles'

import {
  GET,
} from './route'

function createRequest(makeId?: string) {
  const query =
    makeId === undefined
      ? ''
      : `?makeId=${encodeURIComponent(makeId)}`

  return new NextRequest(
    `http://localhost/api/vehicles/models${query}`,
  )
}

const models = [
  {
    id: 'model-serie-1',
    name: 'Série 1',
    slug: 'serie-1',
  },
  {
    id: 'model-serie-3',
    name: 'Série 3',
    slug: 'serie-3',
  },
]

describe(
  'GET /api/vehicles/models',
  () => {
    beforeEach(() => {
      vi.mocked(getVehicleModels).mockReset()
    })

    test(
      'devolve os modelos da marca indicada',
      async () => {
        vi.mocked(getVehicleModels).mockResolvedValue(
          models,
        )

        const response = await GET(
          createRequest('make-bmw'),
        )

        expect(response.status).toBe(200)
        await expect(
          response.json(),
        ).resolves.toEqual({ models })
        expect(
          getVehicleModels,
        ).toHaveBeenCalledWith('make-bmw')
      },
    )

    test(
      '400 quando o makeId não é fornecido',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(getVehicleModels).mockRejectedValue(
          new ValidationError(
            'ID da marca de veículo é obrigatório',
          ),
        )

        const response = await GET(
          createRequest(),
        )

        expect(response.status).toBe(400)
        expect(consoleError).not.toHaveBeenCalled()
      },
    )

    test(
      '404 quando a marca não existe',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(getVehicleModels).mockRejectedValue(
          new NotFoundError(
            'Marca de veículo não encontrada',
          ),
        )

        const response = await GET(
          createRequest('make-x'),
        )

        expect(response.status).toBe(404)
        await expect(
          response.json(),
        ).resolves.toEqual({
          error: 'Marca de veículo não encontrada',
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
        vi.mocked(getVehicleModels).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET(
          createRequest('make-bmw'),
        )

        expect(response.status).toBe(500)
        expect(consoleError).toHaveBeenCalled()
      },
    )
  },
)
