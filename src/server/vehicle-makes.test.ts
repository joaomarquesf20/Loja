import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createVehicleMake,
  deleteVehicleMake,
  getVehicleMakeById,
  listVehicleMakes,
  updateVehicleMake,
  type VehicleMakeClient,
} from './vehicle-makes'

const vehicleMakeRecord = {
  id: 'make-1',
  name: 'Marca Teste',
  slug: 'marca-teste',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('vehicle makes service', () => {
  let client: VehicleMakeClient

  beforeEach(() => {
    client = {
      vehicleMake: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      vehicleModel: {
        count: vi.fn(),
      },
    }
  })

  test('listVehicleMakes ordena por nome ascendente', async () => {
    vi.mocked(client.vehicleMake.findMany).mockResolvedValue([
      vehicleMakeRecord,
    ])

    const result = await listVehicleMakes(client)

    expect(client.vehicleMake.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    })
    expect(result).toEqual([vehicleMakeRecord])
  })

  test('getVehicleMakeById rejeita id vazio', async () => {
    await expect(
      getVehicleMakeById('', client),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('getVehicleMakeById rejeita marca inexistente', async () => {
    vi.mocked(client.vehicleMake.findUnique).mockResolvedValue(null)

    await expect(
      getVehicleMakeById('make-1', client),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  test('getVehicleMakeById devolve marca existente', async () => {
    vi.mocked(client.vehicleMake.findUnique).mockResolvedValue(
      vehicleMakeRecord,
    )

    await expect(
      getVehicleMakeById('make-1', client),
    ).resolves.toEqual(vehicleMakeRecord)
  })

  test('createVehicleMake rejeita input inválido', async () => {
    await expect(
      createVehicleMake(
        {
          name: '',
          slug: '',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('createVehicleMake rejeita slug vazio após normalização', async () => {
    await expect(
      createVehicleMake(
        {
          name: 'Marca Teste',
          slug: '!!!',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(client.vehicleMake.create).not.toHaveBeenCalled()
  })

  test('createVehicleMake rejeita nome acima do limite', async () => {
    await expect(
      createVehicleMake(
        {
          name: 'a'.repeat(121),
          slug: 'marca-teste',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(client.vehicleMake.create).not.toHaveBeenCalled()
  })

  test('createVehicleMake normaliza slug', async () => {
    vi.mocked(client.vehicleMake.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    vi.mocked(client.vehicleMake.create).mockResolvedValue(
      vehicleMakeRecord,
    )

    await createVehicleMake(
      {
        name: 'Marca Teste',
        slug: 'Marca Teste',
      },
      client,
    )

    expect(client.vehicleMake.create).toHaveBeenCalledWith({
      data: {
        name: 'Marca Teste',
        slug: 'marca-teste',
      },
    })
  })

  test('createVehicleMake rejeita nome duplicado', async () => {
    vi.mocked(client.vehicleMake.findUnique).mockResolvedValueOnce(
      vehicleMakeRecord,
    )

    await expect(
      createVehicleMake(
        {
          name: 'Marca Teste',
          slug: 'outra-marca',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  test('createVehicleMake rejeita slug duplicado', async () => {
    vi.mocked(client.vehicleMake.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(vehicleMakeRecord)

    await expect(
      createVehicleMake(
        {
          name: 'Outra Marca',
          slug: 'marca-teste',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  test('createVehicleMake cria marca válida', async () => {
    vi.mocked(client.vehicleMake.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    vi.mocked(client.vehicleMake.create).mockResolvedValue(
      vehicleMakeRecord,
    )

    await expect(
      createVehicleMake(
        {
          name: 'Marca Teste',
          slug: 'marca-teste',
        },
        client,
      ),
    ).resolves.toEqual(vehicleMakeRecord)
  })

  test('updateVehicleMake rejeita id vazio', async () => {
    await expect(
      updateVehicleMake(
        '',
        { name: 'Novo Nome' },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('updateVehicleMake rejeita marca inexistente', async () => {
    vi.mocked(client.vehicleMake.findUnique).mockResolvedValue(null)

    await expect(
      updateVehicleMake(
        'make-1',
        { name: 'Novo Nome' },
        client,
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  test('updateVehicleMake rejeita nome duplicado', async () => {
    vi.mocked(client.vehicleMake.findUnique)
      .mockResolvedValueOnce(vehicleMakeRecord)
      .mockResolvedValueOnce({
        ...vehicleMakeRecord,
        id: 'make-2',
        name: 'Nome Ocupado',
      })

    await expect(
      updateVehicleMake(
        'make-1',
        { name: 'Nome Ocupado' },
        client,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  test('updateVehicleMake rejeita slug duplicado', async () => {
    vi.mocked(client.vehicleMake.findUnique)
      .mockResolvedValueOnce(vehicleMakeRecord)
      .mockResolvedValueOnce({
        ...vehicleMakeRecord,
        id: 'make-2',
        slug: 'slug-ocupado',
      })

    await expect(
      updateVehicleMake(
        'make-1',
        { slug: 'slug-ocupado' },
        client,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  test('updateVehicleMake normaliza slug antes de atualizar', async () => {
    vi.mocked(client.vehicleMake.findUnique)
      .mockResolvedValueOnce(vehicleMakeRecord)
      .mockResolvedValueOnce(null)

    vi.mocked(client.vehicleMake.update).mockResolvedValue({
      ...vehicleMakeRecord,
      slug: 'novo-slug',
    })

    await updateVehicleMake(
      'make-1',
      {
        slug: 'Novo Slug',
      },
      client,
    )

    expect(client.vehicleMake.update).toHaveBeenCalledWith({
      where: { id: 'make-1' },
      data: {
        slug: 'novo-slug',
      },
    })
  })

  test('updateVehicleMake atualiza dados válidos', async () => {
    vi.mocked(client.vehicleMake.findUnique)
      .mockResolvedValueOnce(vehicleMakeRecord)
      .mockResolvedValueOnce(null)

    vi.mocked(client.vehicleMake.update).mockResolvedValue({
      ...vehicleMakeRecord,
      name: 'Novo Nome',
    })

    await updateVehicleMake(
      'make-1',
      {
        name: 'Novo Nome',
      },
      client,
    )

    expect(client.vehicleMake.update).toHaveBeenCalledWith({
      where: { id: 'make-1' },
      data: {
        name: 'Novo Nome',
      },
    })
  })

  test('updateVehicleMake rejeita nome acima do limite', async () => {
    await expect(
      updateVehicleMake(
        'make-1',
        {
          name: 'a'.repeat(121),
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('deleteVehicleMake rejeita id vazio', async () => {
    await expect(
      deleteVehicleMake('', client),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('deleteVehicleMake rejeita marca inexistente', async () => {
    vi.mocked(client.vehicleMake.findUnique).mockResolvedValue(null)

    await expect(
      deleteVehicleMake('make-1', client),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  test('deleteVehicleMake rejeita marca com modelos associados', async () => {
    vi.mocked(client.vehicleMake.findUnique).mockResolvedValue(
      vehicleMakeRecord,
    )
    vi.mocked(client.vehicleModel.count).mockResolvedValue(1)

    await expect(
      deleteVehicleMake('make-1', client),
    ).rejects.toBeInstanceOf(ConflictError)

    expect(client.vehicleModel.count).toHaveBeenCalledWith({
      where: { makeId: 'make-1' },
    })
  })

  test('deleteVehicleMake apaga marca sem modelos', async () => {
    vi.mocked(client.vehicleMake.findUnique).mockResolvedValue(
      vehicleMakeRecord,
    )
    vi.mocked(client.vehicleModel.count).mockResolvedValue(0)
    vi.mocked(client.vehicleMake.delete).mockResolvedValue(
      vehicleMakeRecord,
    )

    await expect(
      deleteVehicleMake('make-1', client),
    ).resolves.toEqual(vehicleMakeRecord)

    expect(client.vehicleMake.delete).toHaveBeenCalledWith({
      where: { id: 'make-1' },
    })
  })
})
