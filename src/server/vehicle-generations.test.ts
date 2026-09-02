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
  createVehicleGeneration,
  deleteVehicleGeneration,
  getVehicleGenerationById,
  listVehicleGenerations,
  updateVehicleGeneration,
  type VehicleGenerationClient,
} from './vehicle-generations'

const generationRecord = {
  id: 'generation-1',
  modelId: 'model-1',
  name: 'Geração Técnica',
  platform: 'PLATAFORMA-X',
  description: 'Descrição técnica',
}

describe('vehicle generations service', () => {
  let client: VehicleGenerationClient

  beforeEach(() => {
    client = {
      vehicleModel: {
        findUnique: vi.fn(),
      },
      vehicleGeneration: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      vehicleConfiguration: {
        count: vi.fn(),
      },
    }
  })

  describe('listVehicleGenerations', () => {
    test('rejeita modelId vazio', async () => {
      await expect(
        listVehicleGenerations('', client),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(
        client.vehicleModel.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita modelo inexistente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        listVehicleGenerations(
          'model-1',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.vehicleGeneration.findMany,
      ).not.toHaveBeenCalled()
    })

    test('filtra pelo modelId e ordena por nome ascendente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({
        id: 'model-1',
      })

      vi.mocked(
        client.vehicleGeneration.findMany,
      ).mockResolvedValue([
        generationRecord,
      ])

      const result =
        await listVehicleGenerations(
          'model-1',
          client,
        )

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'model-1',
        },
      })

      expect(
        client.vehicleGeneration.findMany,
      ).toHaveBeenCalledWith({
        where: {
          modelId: 'model-1',
        },
        orderBy: {
          name: 'asc',
        },
      })

      expect(result).toEqual([
        generationRecord,
      ])
    })
  })

  describe('getVehicleGenerationById', () => {
    test('rejeita id vazio', async () => {
      await expect(
        getVehicleGenerationById(
          '',
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('rejeita geração inexistente', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(null)

      await expect(
        getVehicleGenerationById(
          'generation-1',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('devolve geração existente', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(
        generationRecord,
      )

      await expect(
        getVehicleGenerationById(
          'generation-1',
          client,
        ),
      ).resolves.toEqual(generationRecord)

      expect(
        client.vehicleGeneration.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'generation-1',
        },
      })
    })
  })

  describe('createVehicleGeneration', () => {
    test('rejeita input inválido', async () => {
      await expect(
        createVehicleGeneration(
          {
            modelId: '',
            name: '',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(
        client.vehicleGeneration.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita nome acima do limite', async () => {
      await expect(
        createVehicleGeneration(
          {
            modelId: 'model-1',
            name: 'a'.repeat(121),
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(
        client.vehicleGeneration.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita modelo inexistente', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        createVehicleGeneration(
          {
            modelId: 'model-1',
            name: 'Geração Técnica',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.vehicleGeneration.findUnique,
      ).not.toHaveBeenCalled()

      expect(
        client.vehicleGeneration.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita conflito de modelId e name', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({
        id: 'model-1',
      })

      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(
        generationRecord,
      )

      await expect(
        createVehicleGeneration(
          {
            modelId: 'model-1',
            name: ' Geração Técnica ',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )

      expect(
        client.vehicleGeneration.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          modelId_name: {
            modelId: 'model-1',
            name: 'Geração Técnica',
          },
        },
      })

      expect(
        client.vehicleGeneration.create,
      ).not.toHaveBeenCalled()
    })

    test('cria geração válida com trim', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({
        id: 'model-1',
      })

      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.vehicleGeneration.create,
      ).mockResolvedValue(
        generationRecord,
      )

      const result =
        await createVehicleGeneration(
          {
            modelId: ' model-1 ',
            name: ' Geração Técnica ',
            platform: ' PLATAFORMA-X ',
            description:
              ' Descrição técnica ',
          },
          client,
        )

      expect(
        client.vehicleGeneration.create,
      ).toHaveBeenCalledWith({
        data: {
          modelId: 'model-1',
          name: 'Geração Técnica',
          platform: 'PLATAFORMA-X',
          description:
            'Descrição técnica',
        },
      })

      expect(result).toEqual(
        generationRecord,
      )
    })

    test('usa null para platform e description ausentes', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({
        id: 'model-1',
      })

      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.vehicleGeneration.create,
      ).mockResolvedValue({
        ...generationRecord,
        platform: null,
        description: null,
      })

      await createVehicleGeneration(
        {
          modelId: 'model-1',
          name: 'Geração Técnica',
        },
        client,
      )

      expect(
        client.vehicleGeneration.create,
      ).toHaveBeenCalledWith({
        data: {
          modelId: 'model-1',
          name: 'Geração Técnica',
          platform: null,
          description: null,
        },
      })
    })

    test('permite platform e description nulos', async () => {
      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({
        id: 'model-1',
      })

      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(null)

      vi.mocked(
        client.vehicleGeneration.create,
      ).mockResolvedValue({
        ...generationRecord,
        platform: null,
        description: null,
      })

      await expect(
        createVehicleGeneration(
          {
            modelId: 'model-1',
            name: 'Geração Técnica',
            platform: null,
            description: null,
          },
          client,
        ),
      ).resolves.toEqual({
        ...generationRecord,
        platform: null,
        description: null,
      })
    })
  })

  describe('updateVehicleGeneration', () => {
    test('rejeita id vazio', async () => {
      await expect(
        updateVehicleGeneration(
          '',
          {
            name: 'Novo Nome',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('rejeita input inválido', async () => {
      await expect(
        updateVehicleGeneration(
          'generation-1',
          {
            name: '',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )

      expect(
        client.vehicleGeneration.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita geração inexistente', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateVehicleGeneration(
          'generation-1',
          {
            name: 'Novo Nome',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita modelo inexistente ao mudar modelId', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValueOnce(
        generationRecord,
      )

      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue(null)

      await expect(
        updateVehicleGeneration(
          'generation-1',
          {
            modelId: 'model-2',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.vehicleModel.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'model-2',
        },
      })

      expect(
        client.vehicleGeneration.update,
      ).not.toHaveBeenCalled()
    })

    test('aplica trim ao nome antes de verificar conflito', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      )
        .mockResolvedValueOnce(
          generationRecord,
        )
        .mockResolvedValueOnce(null)

      vi.mocked(
        client.vehicleGeneration.update,
      ).mockResolvedValue({
        ...generationRecord,
        name: 'Novo Nome',
      })

      await updateVehicleGeneration(
        'generation-1',
        {
          name: ' Novo Nome ',
        },
        client,
      )

      expect(
        client.vehicleGeneration.findUnique,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          modelId_name: {
            modelId: 'model-1',
            name: 'Novo Nome',
          },
        },
      })

      expect(
        client.vehicleGeneration.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'generation-1',
        },
        data: {
          name: 'Novo Nome',
        },
      })
    })

    test('rejeita conflito na combinação final ao mudar modelId', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      )
        .mockResolvedValueOnce(
          generationRecord,
        )
        .mockResolvedValueOnce({
          ...generationRecord,
          id: 'generation-2',
          modelId: 'model-2',
        })

      vi.mocked(
        client.vehicleModel.findUnique,
      ).mockResolvedValue({
        id: 'model-2',
      })

      await expect(
        updateVehicleGeneration(
          'generation-1',
          {
            modelId: 'model-2',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )

      expect(
        client.vehicleGeneration.findUnique,
      ).toHaveBeenNthCalledWith(2, {
        where: {
          modelId_name: {
            modelId: 'model-2',
            name: 'Geração Técnica',
          },
        },
      })

      expect(
        client.vehicleGeneration.update,
      ).not.toHaveBeenCalled()
    })

    test('rejeita conflito na combinação final ao mudar nome', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      )
        .mockResolvedValueOnce(
          generationRecord,
        )
        .mockResolvedValueOnce({
          ...generationRecord,
          id: 'generation-2',
          name: 'Nome Ocupado',
        })

      await expect(
        updateVehicleGeneration(
          'generation-1',
          {
            name: 'Nome Ocupado',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )

      expect(
        client.vehicleGeneration.update,
      ).not.toHaveBeenCalled()
    })

    test('atualiza dados válidos com trim', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      )
        .mockResolvedValueOnce(
          generationRecord,
        )
        .mockResolvedValueOnce(
          generationRecord,
        )

      const updatedGeneration = {
        ...generationRecord,
        platform: 'PLATAFORMA-Y',
        description:
          'Descrição atualizada',
      }

      vi.mocked(
        client.vehicleGeneration.update,
      ).mockResolvedValue(
        updatedGeneration,
      )

      const result =
        await updateVehicleGeneration(
          'generation-1',
          {
            platform: ' PLATAFORMA-Y ',
            description:
              ' Descrição atualizada ',
          },
          client,
        )

      expect(
        client.vehicleGeneration.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'generation-1',
        },
        data: {
          platform: 'PLATAFORMA-Y',
          description:
            'Descrição atualizada',
        },
      })

      expect(result).toEqual(
        updatedGeneration,
      )
    })
  })

  describe('deleteVehicleGeneration', () => {
    test('rejeita id vazio', async () => {
      await expect(
        deleteVehicleGeneration(
          '',
          client,
        ),
      ).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    test('rejeita geração inexistente', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(null)

      await expect(
        deleteVehicleGeneration(
          'generation-1',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('bloqueia delete com configurações associadas', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(
        generationRecord,
      )

      vi.mocked(
        client.vehicleConfiguration.count,
      ).mockResolvedValue(1)

      await expect(
        deleteVehicleGeneration(
          'generation-1',
          client,
        ),
      ).rejects.toBeInstanceOf(
        ConflictError,
      )

      expect(
        client.vehicleConfiguration.count,
      ).toHaveBeenCalledWith({
        where: {
          generationId:
            'generation-1',
        },
      })

      expect(
        client.vehicleGeneration.delete,
      ).not.toHaveBeenCalled()
    })

    test('apaga geração sem configurações associadas', async () => {
      vi.mocked(
        client.vehicleGeneration.findUnique,
      ).mockResolvedValue(
        generationRecord,
      )

      vi.mocked(
        client.vehicleConfiguration.count,
      ).mockResolvedValue(0)

      vi.mocked(
        client.vehicleGeneration.delete,
      ).mockResolvedValue(
        generationRecord,
      )

      await expect(
        deleteVehicleGeneration(
          'generation-1',
          client,
        ),
      ).resolves.toEqual(
        generationRecord,
      )

      expect(
        client.vehicleGeneration.delete,
      ).toHaveBeenCalledWith({
        where: {
          id: 'generation-1',
        },
      })
    })
  })
})