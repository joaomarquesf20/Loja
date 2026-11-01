import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createVehicleSpec,
  deleteVehicleSpec,
  getVehicleSpecById,
  listVehicleSpecs,
  updateVehicleSpec,
  type VehicleSpecClient,
} from './vehicle-specs'

const vehicleSpecRecord = {
  id: 'spec-1',
  modelId: 'model-1',
  engine: '1.5 TD',
  engineCode: '4EC1-T',
  yearStart: 1993,
  yearEnd: 2000,
  fuelType: 'DIESEL',
  powerHp: 68,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('vehicle specs service', () => {
  let client: VehicleSpecClient

  beforeEach(() => {
    client = {
      vehicleModel: {
        findUnique: vi.fn(),
      },
      vehicleSpec: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      productCompatibility: {
        count: vi.fn(),
      },
    }
  })

  describe('listVehicleSpecs', () => {
    test('rejeita modelId vazio', async () => {
      await expect(
        listVehicleSpecs('', client),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleModel.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita modelo inexistente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        listVehicleSpecs('model-1', client),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('filtra por modelId e ordena por motor e ano', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({ id: 'model-1' })
      vi.mocked(
        client.vehicleSpec.findMany,
      ).mockResolvedValue([vehicleSpecRecord])

      const result = await listVehicleSpecs(
        'model-1',
        client,
      )

      expect(
        client.vehicleSpec.findMany,
      ).toHaveBeenCalledWith({
        where: { modelId: 'model-1' },
        orderBy: [{ engine: 'asc' }, { yearStart: 'asc' }],
      })
      expect(result).toEqual([vehicleSpecRecord])
    })
  })

  describe('getVehicleSpecById', () => {
    test('rejeita id vazio', async () => {
      await expect(
        getVehicleSpecById('', client),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita especificação inexistente', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(null)

      await expect(
        getVehicleSpecById('spec-1', client),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('devolve especificação existente', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(vehicleSpecRecord)

      await expect(
        getVehicleSpecById('spec-1', client),
      ).resolves.toEqual(vehicleSpecRecord)
    })
  })

  describe('createVehicleSpec', () => {
    test('rejeita input inválido', async () => {
      await expect(
        createVehicleSpec(
          {
            modelId: '',
            engine: '',
            yearStart: 0,
            fuelType: '',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleSpec.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita yearStart fora do intervalo', async () => {
      await expect(
        createVehicleSpec(
          {
            modelId: 'model-1',
            engine: '1.5 TD',
            yearStart: 1899,
            fuelType: 'DIESEL',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)

      await expect(
        createVehicleSpec(
          {
            modelId: 'model-1',
            engine: '1.5 TD',
            yearStart: 2101,
            fuelType: 'DIESEL',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita ano final anterior ao inicial', async () => {
      await expect(
        createVehicleSpec(
          {
            modelId: 'model-1',
            engine: '1.5 TD',
            yearStart: 1995,
            yearEnd: 1993,
            fuelType: 'DIESEL',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleSpec.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita modelo inexistente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        createVehicleSpec(
          {
            modelId: 'model-1',
            engine: '1.5 TD',
            yearStart: 1993,
            fuelType: 'DIESEL',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita conflito de motor e ano inicial', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({ id: 'model-1' })
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(vehicleSpecRecord)

      await expect(
        createVehicleSpec(
          {
            modelId: 'model-1',
            engine: '1.5 TD',
            yearStart: 1993,
            fuelType: 'DIESEL',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.vehicleSpec.create,
      ).not.toHaveBeenCalled()
    })

    test('normaliza fuelType em maiúsculas e limpa engineCode vazio', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({ id: 'model-1' })
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(null)
      vi.mocked(
        client.vehicleSpec.create,
      ).mockResolvedValue(vehicleSpecRecord)

      await createVehicleSpec(
        {
          modelId: 'model-1',
          engine: '1.5 TD',
          engineCode: '  ',
          yearStart: 1993,
          yearEnd: 2000,
          fuelType: 'diesel',
          powerHp: 68,
        },
        client,
      )

      expect(
        client.vehicleSpec.create,
      ).toHaveBeenCalledWith({
        data: {
          modelId: 'model-1',
          engine: '1.5 TD',
          engineCode: null,
          yearStart: 1993,
          yearEnd: 2000,
          fuelType: 'DIESEL',
          powerHp: 68,
        },
      })
    })

    test('cria especificação válida', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({ id: 'model-1' })
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(null)
      vi.mocked(
        client.vehicleSpec.create,
      ).mockResolvedValue(vehicleSpecRecord)

      await expect(
        createVehicleSpec(
          {
            modelId: 'model-1',
            engine: '1.5 TD',
            engineCode: '4EC1-T',
            yearStart: 1993,
            yearEnd: 2000,
            fuelType: 'DIESEL',
            powerHp: 68,
          },
          client,
        ),
      ).resolves.toEqual(vehicleSpecRecord)
    })
  })

  describe('updateVehicleSpec', () => {
    test('rejeita id vazio', async () => {
      await expect(
        updateVehicleSpec(
          '',
          { engine: '1.6 TD' },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita especificação inexistente', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateVehicleSpec(
          'spec-1',
          { engine: '1.6 TD' },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita modelo inexistente ao mudar modelId', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(vehicleSpecRecord)
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateVehicleSpec(
          'spec-1',
          { modelId: 'model-2' },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita ano final anterior ao inicial com valores finais', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValueOnce(vehicleSpecRecord)
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValueOnce(null)

      await expect(
        updateVehicleSpec(
          'spec-1',
          { yearStart: 2005 },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleSpec.update,
      ).not.toHaveBeenCalled()
    })

    test('aceita limpar yearEnd com null', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValueOnce(vehicleSpecRecord)
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValueOnce(null)

      vi.mocked(
        client.vehicleSpec.update,
      ).mockResolvedValue({
        ...vehicleSpecRecord,
        yearEnd: null,
      })

      await updateVehicleSpec(
        'spec-1',
        { yearEnd: null },
        client,
      )

      expect(
        client.vehicleSpec.update,
      ).toHaveBeenCalledWith({
        where: { id: 'spec-1' },
        data: {
          yearEnd: null,
        },
      })
    })

    test('rejeita conflito de motor e ano inicial', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValueOnce(vehicleSpecRecord)
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValueOnce({
        ...vehicleSpecRecord,
        id: 'spec-2',
        engine: '1.6 TD',
      })

      await expect(
        updateVehicleSpec(
          'spec-1',
          { engine: '1.6 TD' },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    test('atualiza dados válidos', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValueOnce(vehicleSpecRecord)
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValueOnce(null)

      vi.mocked(
        client.vehicleSpec.update,
      ).mockResolvedValue({
        ...vehicleSpecRecord,
        engine: '1.6 TD',
      })

      await updateVehicleSpec(
        'spec-1',
        {
          engine: '1.6 TD',
        },
        client,
      )

      expect(
        client.vehicleSpec.update,
      ).toHaveBeenCalledWith({
        where: { id: 'spec-1' },
        data: {
          engine: '1.6 TD',
        },
      })
    })
  })

  describe('deleteVehicleSpec', () => {
    test('rejeita id vazio', async () => {
      await expect(
        deleteVehicleSpec('', client),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita especificação inexistente', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(null)

      await expect(
        deleteVehicleSpec('spec-1', client),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita especificação com compatibilidades associadas', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(vehicleSpecRecord)
      vi.mocked(
        client.productCompatibility.count,
      ).mockResolvedValue(2)

      await expect(
        deleteVehicleSpec('spec-1', client),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.productCompatibility.count,
      ).toHaveBeenCalledWith({
        where: { vehicleSpecId: 'spec-1' },
      })
    })

    test('apaga especificação sem compatibilidades', async () => {
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(vehicleSpecRecord)
      vi.mocked(
        client.productCompatibility.count,
      ).mockResolvedValue(0)
      vi.mocked(
        client.vehicleSpec.delete,
      ).mockResolvedValue(vehicleSpecRecord)

      await expect(
        deleteVehicleSpec('spec-1', client),
      ).resolves.toEqual(vehicleSpecRecord)

      expect(
        client.vehicleSpec.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'spec-1' },
      })
    })
  })
})
