import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/vehicles', () => {
  class ValidationError extends Error {}

  return {
    ValidationError,
    getVehicleMakes: vi.fn(),
  }
})

import {
  ValidationError,
  getVehicleMakes,
} from '@/server/vehicles'

import {
  GET,
} from './route'

const makes = [
  {
    id: 'make-bmw',
    name: 'BMW',
    slug: 'bmw',
  },
  {
    id: 'make-opel',
    name: 'Opel',
    slug: 'opel',
  },
]

describe(
  'GET /api/vehicles/makes',
  () => {
    beforeEach(() => {
      vi.mocked(getVehicleMakes).mockReset()
    })

    test(
      'devolve a lista de marcas de veículos',
      async () => {
        vi.mocked(getVehicleMakes).mockResolvedValue(
          makes,
        )

        const response = await GET()

        expect(response.status).toBe(200)
        await expect(
          response.json(),
        ).resolves.toEqual({ makes })
        expect(getVehicleMakes).toHaveBeenCalled()
      },
    )

    test(
      '400 com erro de validação do serviço',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(getVehicleMakes).mockRejectedValue(
          new ValidationError('Dados inválidos'),
        )

        const response = await GET()

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
        vi.mocked(getVehicleMakes).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET()

        expect(response.status).toBe(500)
        await expect(
          response.json(),
        ).resolves.toEqual({
          error: 'Erro interno do servidor',
        })
        expect(consoleError).toHaveBeenCalled()
      },
    )
  },
)
