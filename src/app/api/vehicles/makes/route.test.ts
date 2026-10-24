import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/vehicle-search', () => {
  class ValidationError extends Error {}

  return {
    ValidationError,
    listVehicleMakes: vi.fn(),
  }
})

import {
  listVehicleMakes,
} from '@/server/vehicle-search'

import {
  GET,
} from './route'

const vehicleMakes = [
  {
    id: 'brand-bmw',
    name: 'BMW',
    slug: 'dev-bmw',
  },
  {
    id: 'brand-opel',
    name: 'Opel',
    slug: 'opel',
  },
]

describe(
  'GET /api/vehicles/makes',
  () => {
    beforeEach(() => {
      vi.mocked(listVehicleMakes).mockReset()
    })

    test(
      'devolve as marcas disponíveis',
      async () => {
        vi.mocked(listVehicleMakes).mockResolvedValue(
          vehicleMakes,
        )

        const response = await GET()

        expect(response.status).toBe(200)
        await expect(
          response.json(),
        ).resolves.toEqual(vehicleMakes)
        expect(
          listVehicleMakes,
        ).toHaveBeenCalled()
      },
    )

    test(
      '500 com erro inesperado da base de dados',
      async () => {
        const consoleError = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        vi.mocked(listVehicleMakes).mockRejectedValue(
          new Error('liga a BD'),
        )

        const response = await GET()

        expect(response.status).toBe(500)
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
