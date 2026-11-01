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
  createVehicleModel,
  deleteVehicleModel,
  getVehicleModelById,
  listVehicleModels,
  updateVehicleModel,
  type VehicleModelClient,
} from './vehicle-models'

const vehicleModelRecord = {
  id: 'model-1',
  makeId: 'make-1',
  name: 'Modelo Teste',
  slug: 'modelo-teste',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('vehicle models service', () => {
  let client: VehicleModelClient

  beforeEach(() => {
    client = {
      vehicleMake: {
        findUnique: vi.fn(),
      },
      vehicleModel: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      vehicleSpec: {
        count: vi.fn(),
      },
    }
  })

  describe('listVehicleModels', () => {
    test('rejeita makeId vazio', async () => {
      await expect(
        listVehicleModels('', client),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleMake.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita marca inexistente', async () => {
      vi.mocked(
        client.vehicleMake.findUnique,
      ).mockResolvedValue(null)

      await expect(
        listVehicleModels('make-1', client),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('filtra por makeId e ordena por nome ascendente', async () => {
      vi.mocked(
        client.vehicleMake.findUnique,
      ).mockResolvedValue({ id: 'make-1' })

      vi.mocked(
        client.vehicleModel.findMany,
      ).mockResolvedValue([vehicleModelRecord])

      const result = await listVehicleModels(
        'make-1',
        client,
      )

      expect(
        client.vehicleModel.findMany,
      ).toHaveBeenCalledWith({
        where: { makeId: 'make-1' },
        orderBy: { name: 'asc' },
      })
      expect(result).toEqual([vehicleModelRecord])
    })
  })

  describe('getVehicleModelById', () => {
    test('rejeita id vazio', async () => {
      await expect(
        getVehicleModelById('', client),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita modelo inexistente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        getVehicleModelById('model-1', client),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('devolve modelo existente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(vehicleModelRecord)

      await expect(
        getVehicleModelById('model-1', client),
      ).resolves.toEqual(vehicleModelRecord)
    })
  })

  describe('createVehicleModel', () => {
    test('rejeita input inválido', async () => {
      await expect(
        createVehicleModel(
          {
            makeId: '',
            name: '',
            slug: '',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleModel.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita marca inexistente', async () => {
      vi.mocked(
        client.vehicleMake.findUnique,
      ).mockResolvedValue(null)

      await expect(
        createVehicleModel(
          {
            makeId: 'make-1',
            name: 'Modelo Teste',
            slug: 'modelo-teste',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.vehicleModel.create,
      ).not.toHaveBeenCalled()
    })

    test('normaliza slug', async () => {
      vi.mocked(
        client.vehicleMake.findUnique,
      ).mockResolvedValue({ id: 'make-1' })
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.vehicleModel.create,
      ).mockResolvedValue(vehicleModelRecord)

      await createVehicleModel(
        {
          makeId: 'make-1',
          name: 'Modelo Teste',
          slug: 'Modelo Teste',
        },
        client,
      )

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          makeId_slug: {
            makeId: 'make-1',
            slug: 'modelo-teste',
          },
        },
      })
      expect(
        client.vehicleModel.create,
      ).toHaveBeenCalledWith({
        data: {
          makeId: 'make-1',
          name: 'Modelo Teste',
          slug: 'modelo-teste',
        },
      })
    })

    test('rejeita conflito de makeId e slug', async () => {
      vi.mocked(
        client.vehicleMake.findUnique,
      ).mockResolvedValue({ id: 'make-1' })
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(vehicleModelRecord)

      await expect(
        createVehicleModel(
          {
            makeId: 'make-1',
            name: 'Outro Modelo',
            slug: 'modelo-teste',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.vehicleModel.create,
      ).not.toHaveBeenCalled()
    })

    test('faz trim ao makeId', async () => {
      vi.mocked(
        client.vehicleMake.findUnique,
      ).mockResolvedValue({ id: 'make-1' })
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)
      vi.mocked(
        client.vehicleModel.create,
      ).mockResolvedValue(vehicleModelRecord)

      await createVehicleModel(
        {
          makeId: ' make-1 ',
          name: ' Modelar ',
          slug: ' Modelo Teste ',
        },
        client,
      )

      expect(
        client.vehicleModel.create,
      ).toHaveBeenCalledWith({
        data: {
          makeId: 'make-1',
          name: 'Modelar',
          slug: 'modelo-teste',
        },
      })
    })

    test('cria modelo válido', async () => {
      vi.mocked(
        client.vehicleMake.findUnique,
      ).mockResolvedValue({ id: 'make-1' })
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)
      vi.mocked(
        client.vehicleModel.create,
      ).mockResolvedValue(vehicleModelRecord)

      await expect(
        createVehicleModel(
          {
            makeId: 'make-1',
            name: 'Modelo Teste',
            slug: 'modelo-teste',
          },
          client,
        ),
      ).resolves.toEqual(vehicleModelRecord)
    })
  })

  describe('updateVehicleModel', () => {
    test('rejeita id vazio', async () => {
      await expect(
        updateVehicleModel(
          '',
          { name: 'Novo Nome' },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita modelo inexistente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateVehicleModel(
          'model-1',
          { name: 'Novo Nome' },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita marca inexistente ao mudar makeId', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(vehicleModelRecord)
      vi.mocked(
        client.vehicleMake.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateVehicleModel(
          'model-1',
          { makeId: 'make-2' },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita conflito de makeId e slug', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(vehicleModelRecord)
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValueOnce(vehicleModelRecord)
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValueOnce({
        ...vehicleModelRecord,
        id: 'model-2',
        slug: 'modelo-ocupado',
      })

      await expect(
        updateVehicleModel(
          'model-1',
          { slug: 'modelo-ocupado' },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    test('normaliza slug antes de atualizar', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValueOnce(vehicleModelRecord)
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValueOnce(null)

      vi.mocked(
        client.vehicleModel.update,
      ).mockResolvedValue({
        ...vehicleModelRecord,
        slug: 'novo-slug',
      })

      await updateVehicleModel(
        'model-1',
        {
          slug: 'Novo Slug',
        },
        client,
      )

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenLastCalledWith({
        where: {
          makeId_slug: {
            makeId: 'make-1',
            slug: 'novo-slug',
          },
        },
      })
      expect(
        client.vehicleModel.update,
      ).toHaveBeenCalledWith({
        where: { id: 'model-1' },
        data: {
          slug: 'novo-slug',
        },
      })
    })

    test('atualiza dados válidos', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValueOnce(vehicleModelRecord)
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValueOnce(null)

      vi.mocked(
        client.vehicleModel.update,
      ).mockResolvedValue({
        ...vehicleModelRecord,
        name: 'Novo Nome',
      })

      await updateVehicleModel(
        'model-1',
        {
          name: 'Novo Nome',
        },
        client,
      )

      expect(
        client.vehicleModel.update,
      ).toHaveBeenCalledWith({
        where: { id: 'model-1' },
        data: {
          name: 'Novo Nome',
        },
      })
    })

    test('rejeita nome acima do limite', async () => {
      await expect(
        updateVehicleModel(
          'model-1',
          {
            name: 'a'.repeat(121),
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('deleteVehicleModel', () => {
    test('rejeita id vazio', async () => {
      await expect(
        deleteVehicleModel('', client),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita modelo inexistente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        deleteVehicleModel('model-1', client),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita modelo com especificações associadas', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(vehicleModelRecord)
      vi.mocked(
        client.vehicleSpec.count,
      ).mockResolvedValue(1)

      await expect(
        deleteVehicleModel('model-1', client),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(client.vehicleSpec.count).toHaveBeenCalledWith({
        where: { modelId: 'model-1' },
      })
    })

    test('apaga modelo sem especificações', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(vehicleModelRecord)
      vi.mocked(
        client.vehicleSpec.count,
      ).mockResolvedValue(0)
      vi.mocked(
        client.vehicleModel.delete,
      ).mockResolvedValue(vehicleModelRecord)

      await expect(
        deleteVehicleModel('model-1', client),
      ).resolves.toEqual(vehicleModelRecord)

      expect(
        client.vehicleModel.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'model-1' },
      })
    })
  })
})
