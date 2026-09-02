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
  brandId: 'brand-1',
  name: 'Modelo Teste',
  slug: 'modelo-teste',
  description: 'Descrição técnica',
}

describe('vehicle models service', () => {
  let client: VehicleModelClient

  beforeEach(() => {
    client = {
      vehicleBrand: {
        findUnique: vi.fn(),
      },
      vehicleModel: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      vehicleGeneration: {
        count: vi.fn(),
      },
    }
  })

  describe('listVehicleModels', () => {
    test('rejeita brandId vazio', async () => {
      await expect(
        listVehicleModels('', client),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleBrand.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita marca inexistente', async () => {
      vi.mocked(
        client.vehicleBrand.findUnique,
      ).mockResolvedValue(null)

      await expect(
        listVehicleModels('brand-1', client),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.vehicleModel.findMany,
      ).not.toHaveBeenCalled()
    })

    test('filtra por brandId e ordena por nome ascendente', async () => {
      vi.mocked(
        client.vehicleBrand.findUnique,
      ).mockResolvedValue({
        id: 'brand-1',
      })

      vi.mocked(
        client.vehicleModel.findMany,
      ).mockResolvedValue([
        vehicleModelRecord,
      ])

      const result = await listVehicleModels(
        'brand-1',
        client,
      )

      expect(
        client.vehicleBrand.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'brand-1',
        },
      })

      expect(
        client.vehicleModel.findMany,
      ).toHaveBeenCalledWith({
        where: {
          brandId: 'brand-1',
        },
        orderBy: {
          name: 'asc',
        },
      })

      expect(result).toEqual([
        vehicleModelRecord,
      ])
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
        getVehicleModelById(
          'model-1',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('devolve modelo existente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(
        vehicleModelRecord,
      )

      await expect(
        getVehicleModelById(
          'model-1',
          client,
        ),
      ).resolves.toEqual(
        vehicleModelRecord,
      )

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'model-1',
        },
      })
    })
  })

  describe('createVehicleModel', () => {
    test('rejeita input inválido', async () => {
      await expect(
        createVehicleModel(
          {
            brandId: '',
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

    test('rejeita slug vazio após normalização', async () => {
      await expect(
        createVehicleModel(
          {
            brandId: 'brand-1',
            name: 'Modelo Teste',
            slug: '!!!',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleModel.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita nome acima do limite', async () => {
      await expect(
        createVehicleModel(
          {
            brandId: 'brand-1',
            name: 'a'.repeat(121),
            slug: 'modelo-teste',
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
        client.vehicleBrand.findUnique,
      ).mockResolvedValue(null)

      await expect(
        createVehicleModel(
          {
            brandId: 'brand-1',
            name: 'Modelo Teste',
            slug: 'modelo-teste',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.vehicleModel.findUnique,
      ).not.toHaveBeenCalled()

      expect(
        client.vehicleModel.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita conflito de brandId e slug', async () => {
      vi.mocked(
        client.vehicleBrand.findUnique,
      ).mockResolvedValue({
        id: 'brand-1',
      })

      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(
        vehicleModelRecord,
      )

      await expect(
        createVehicleModel(
          {
            brandId: 'brand-1',
            name: 'Outro Modelo',
            slug: 'Modelo Teste',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          brandId_slug: {
            brandId: 'brand-1',
            slug: 'modelo-teste',
          },
        },
      })

      expect(
        client.vehicleModel.create,
      ).not.toHaveBeenCalled()
    })

    test('cria modelo válido com trim e normalização', async () => {
      vi.mocked(
        client.vehicleBrand.findUnique,
      ).mockResolvedValue({
        id: 'brand-1',
      })

      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.vehicleModel.create,
      ).mockResolvedValue(
        vehicleModelRecord,
      )

      const result = await createVehicleModel(
        {
          brandId: ' brand-1 ',
          name: ' Modelo Teste ',
          slug: ' Modelo Téstê ',
          description:
            ' Descrição técnica ',
        },
        client,
      )

      expect(
        client.vehicleModel.create,
      ).toHaveBeenCalledWith({
        data: {
          brandId: 'brand-1',
          name: 'Modelo Teste',
          slug: 'modelo-teste',
          description:
            'Descrição técnica',
        },
      })

      expect(result).toEqual(
        vehicleModelRecord,
      )
    })

    test('usa null quando description não é fornecida', async () => {
      vi.mocked(
        client.vehicleBrand.findUnique,
      ).mockResolvedValue({
        id: 'brand-1',
      })

      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.vehicleModel.create,
      ).mockResolvedValue({
        ...vehicleModelRecord,
        description: null,
      })

      await createVehicleModel(
        {
          brandId: 'brand-1',
          name: 'Modelo Teste',
          slug: 'modelo-teste',
        },
        client,
      )

      expect(
        client.vehicleModel.create,
      ).toHaveBeenCalledWith({
        data: {
          brandId: 'brand-1',
          name: 'Modelo Teste',
          slug: 'modelo-teste',
          description: null,
        },
      })
    })
  })

  describe('updateVehicleModel', () => {
    test('rejeita id vazio', async () => {
      await expect(
        updateVehicleModel(
          '',
          {
            name: 'Novo Nome',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita input inválido', async () => {
      await expect(
        updateVehicleModel(
          'model-1',
          {
            name: '',
          },
          client,
        ),
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
        updateVehicleModel(
          'model-1',
          {
            name: 'Novo Nome',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita marca inexistente ao mudar brandId', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValueOnce(
        vehicleModelRecord,
      )

      vi.mocked(
        client.vehicleBrand.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateVehicleModel(
          'model-1',
          {
            brandId: 'brand-2',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.vehicleBrand.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'brand-2',
        },
      })

      expect(
        client.vehicleModel.update,
      ).not.toHaveBeenCalled()
    })

    test('normaliza slug antes de atualizar', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      )
        .mockResolvedValueOnce(
          vehicleModelRecord,
        )
        .mockResolvedValueOnce(null)

      vi.mocked(
        client.vehicleModel.update,
      ).mockResolvedValue({
        ...vehicleModelRecord,
        slug: 'novo-slug',
      })

      await updateVehicleModel(
        'model-1',
        {
          slug: ' Novo Slúg ',
        },
        client,
      )

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          brandId_slug: {
            brandId: 'brand-1',
            slug: 'novo-slug',
          },
        },
      })

      expect(
        client.vehicleModel.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'model-1',
        },
        data: {
          slug: 'novo-slug',
        },
      })
    })

    test('rejeita conflito na combinação final ao mudar brandId', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      )
        .mockResolvedValueOnce(
          vehicleModelRecord,
        )
        .mockResolvedValueOnce({
          ...vehicleModelRecord,
          id: 'model-2',
          brandId: 'brand-2',
        })

      vi.mocked(
        client.vehicleBrand.findUnique,
      ).mockResolvedValue({
        id: 'brand-2',
      })

      await expect(
        updateVehicleModel(
          'model-1',
          {
            brandId: 'brand-2',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          brandId_slug: {
            brandId: 'brand-2',
            slug: 'modelo-teste',
          },
        },
      })

      expect(
        client.vehicleModel.update,
      ).not.toHaveBeenCalled()
    })

    test('rejeita conflito na combinação final ao mudar slug', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      )
        .mockResolvedValueOnce(
          vehicleModelRecord,
        )
        .mockResolvedValueOnce({
          ...vehicleModelRecord,
          id: 'model-2',
          slug: 'slug-ocupado',
        })

      await expect(
        updateVehicleModel(
          'model-1',
          {
            slug: 'slug-ocupado',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          brandId_slug: {
            brandId: 'brand-1',
            slug: 'slug-ocupado',
          },
        },
      })
    })

    test('atualiza dados válidos', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      )
        .mockResolvedValueOnce(
          vehicleModelRecord,
        )
        .mockResolvedValueOnce(
          vehicleModelRecord,
        )

      vi.mocked(
        client.vehicleModel.update,
      ).mockResolvedValue({
        ...vehicleModelRecord,
        name: 'Novo Nome',
        description:
          'Nova descrição',
      })

      const result =
        await updateVehicleModel(
          'model-1',
          {
            name: ' Novo Nome ',
            description:
              ' Nova descrição ',
          },
          client,
        )

      expect(
        client.vehicleModel.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'model-1',
        },
        data: {
          name: 'Novo Nome',
          description:
            'Nova descrição',
        },
      })

      expect(result).toEqual({
        ...vehicleModelRecord,
        name: 'Novo Nome',
        description:
          'Nova descrição',
      })
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
        deleteVehicleModel(
          'model-1',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita modelo com gerações associadas', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(
        vehicleModelRecord,
      )

      vi.mocked(
        client.vehicleGeneration.count,
      ).mockResolvedValue(1)

      await expect(
        deleteVehicleModel(
          'model-1',
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.vehicleGeneration.count,
      ).toHaveBeenCalledWith({
        where: {
          modelId: 'model-1',
        },
      })

      expect(
        client.vehicleModel.delete,
      ).not.toHaveBeenCalled()
    })

    test('apaga modelo sem gerações associadas', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(
        vehicleModelRecord,
      )

      vi.mocked(
        client.vehicleGeneration.count,
      ).mockResolvedValue(0)

      vi.mocked(
        client.vehicleModel.delete,
      ).mockResolvedValue(
        vehicleModelRecord,
      )

      await expect(
        deleteVehicleModel(
          'model-1',
          client,
        ),
      ).resolves.toEqual(
        vehicleModelRecord,
      )

      expect(
        client.vehicleModel.delete,
      ).toHaveBeenCalledWith({
        where: {
          id: 'model-1',
        },
      })
    })
  })
})