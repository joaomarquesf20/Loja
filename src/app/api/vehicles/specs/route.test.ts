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
    getVehicleSpecs: vi.fn(),
  }
})

import {
  NotFoundError,
  ValidationError,
  getVehicleSpecs,
} from '@/server/vehicles'

import {
  GET,
} from './route'

function createRequest(modelId?: string) {
  const query =
    modelId === undefined
      ? ''
      : `?modelId=${encodeURIComponent(modelId)}`

  return new NextRequest(
    `http://localhost/api/vehicles/specs${query}`,
  )
}

const specs = [
  {
    id: 'spec-116d',
    engine: '116d',
    engineCode: 'N47D20C1',
    yearStart: 2011,
    yearEnd: 2015,
    fuelType: 'DIESEL',
    powerHp: 116,
  },
  {
    id: 'spec-15td',
    engine: '1.5 TD',
    engineCode: '4EC1-T',
    yearStart: 1993,
    yearEnd: 2000,
    fuelType: 'DIESEL',
    powerHp: 68,
  },
]

describe(
  'GET /api/vehicles/specs',
  () => {
    beforeEach(() => {
      vi.mocked(getVehicleSpecs).mockReset()
    })

    test(
      'devolve as especificações do modelo indicado',
      async () => {
        vi.mocked(getVehicleSpecs).mockResolvedValue(
          specs,
        )

        const response = await GET(
          createRequest('model-serie-1'),
        )

        expect(response.status).toBe(200)
        await expect(
          response.json(),
        ).resolves.toEqual({ specs })
        expect(
          getVehicleSpecs,
        ).toHaveBeenCalledWith('model-serie-1')
      },
    )

    test(
      '400 quando o modelId não é fornecido',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(getVehicleSpecs).mockRejectedValue(
          new ValidationError(
            'ID do modelo de veículo é obrigatório',
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
      '404 quando o modelo não existe',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(getVehicleSpecs).mockRejectedValue(
          new NotFoundError(
            'Modelo de veículo não encontrado',
          ),
        )

        const response = await GET(
          createRequest('model-x'),
        )

        expect(response.status).toBe(404)
        await expect(
          response.json(),
        ).resolves.toEqual({
          error: 'Modelo de veículo não encontrado',
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
        vi.mocked(getVehicleSpecs).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET(
          createRequest('model-serie-1'),
        )

        expect(response.status).toBe(500)
        expect(consoleError).toHaveBeenCalled()
      },
    )
  },
)
