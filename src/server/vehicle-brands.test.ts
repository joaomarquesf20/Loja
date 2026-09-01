import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createVehicleBrand,
  deleteVehicleBrand,
  getVehicleBrandById,
  listVehicleBrands,
  updateVehicleBrand,
  type VehicleBrandClient,
} from './vehicle-brands'

const vehicleBrandRecord = {
  id: 'brand-1',
  name: 'Marca Teste',
  slug: 'marca-teste',
}

describe('vehicle brands service', () => {
  let client: VehicleBrandClient

  beforeEach(() => {
    client = {
      vehicleBrand: {
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

  test('listVehicleBrands ordena por nome ascendente', async () => {
    vi.mocked(client.vehicleBrand.findMany).mockResolvedValue([
      vehicleBrandRecord,
    ])

    const result = await listVehicleBrands(client)

    expect(client.vehicleBrand.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    })
    expect(result).toEqual([vehicleBrandRecord])
  })

  test('getVehicleBrandById rejeita id vazio', async () => {
    await expect(
      getVehicleBrandById('', client),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('getVehicleBrandById rejeita marca inexistente', async () => {
    vi.mocked(client.vehicleBrand.findUnique).mockResolvedValue(null)

    await expect(
      getVehicleBrandById('brand-1', client),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  test('getVehicleBrandById devolve marca existente', async () => {
    vi.mocked(client.vehicleBrand.findUnique).mockResolvedValue(
      vehicleBrandRecord,
    )

    await expect(
      getVehicleBrandById('brand-1', client),
    ).resolves.toEqual(vehicleBrandRecord)
  })

  test('createVehicleBrand rejeita input inválido', async () => {
    await expect(
      createVehicleBrand(
        {
          name: '',
          slug: '',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('createVehicleBrand rejeita slug vazio após normalização', async () => {
    await expect(
      createVehicleBrand(
        {
          name: 'Marca Teste',
          slug: '!!!',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(client.vehicleBrand.create).not.toHaveBeenCalled()
  })

  test('createVehicleBrand rejeita nome acima do limite', async () => {
    await expect(
      createVehicleBrand(
        {
          name: 'a'.repeat(121),
          slug: 'marca-teste',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(client.vehicleBrand.create).not.toHaveBeenCalled()
  })

  test('createVehicleBrand normaliza slug', async () => {
    vi.mocked(client.vehicleBrand.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    vi.mocked(client.vehicleBrand.create).mockResolvedValue(
      vehicleBrandRecord,
    )

    await createVehicleBrand(
      {
        name: 'Marca Teste',
        slug: 'Marca Teste',
      },
      client,
    )

    expect(client.vehicleBrand.create).toHaveBeenCalledWith({
      data: {
        name: 'Marca Teste',
        slug: 'marca-teste',
      },
    })
  })

  test('createVehicleBrand rejeita nome duplicado', async () => {
    vi.mocked(client.vehicleBrand.findUnique).mockResolvedValueOnce(
      vehicleBrandRecord,
    )

    await expect(
      createVehicleBrand(
        {
          name: 'Marca Teste',
          slug: 'outra-marca',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  test('createVehicleBrand rejeita slug duplicado', async () => {
    vi.mocked(client.vehicleBrand.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(vehicleBrandRecord)

    await expect(
      createVehicleBrand(
        {
          name: 'Outra Marca',
          slug: 'marca-teste',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  test('createVehicleBrand cria marca válida', async () => {
    vi.mocked(client.vehicleBrand.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    vi.mocked(client.vehicleBrand.create).mockResolvedValue(
      vehicleBrandRecord,
    )

    await expect(
      createVehicleBrand(
        {
          name: 'Marca Teste',
          slug: 'marca-teste',
        },
        client,
      ),
    ).resolves.toEqual(vehicleBrandRecord)
  })

  test('updateVehicleBrand rejeita id vazio', async () => {
    await expect(
      updateVehicleBrand(
        '',
        { name: 'Novo Nome' },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('updateVehicleBrand rejeita marca inexistente', async () => {
    vi.mocked(client.vehicleBrand.findUnique).mockResolvedValue(null)

    await expect(
      updateVehicleBrand(
        'brand-1',
        { name: 'Novo Nome' },
        client,
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  test('updateVehicleBrand rejeita nome duplicado', async () => {
    vi.mocked(client.vehicleBrand.findUnique)
      .mockResolvedValueOnce(vehicleBrandRecord)
      .mockResolvedValueOnce({
        ...vehicleBrandRecord,
        id: 'brand-2',
        name: 'Nome Ocupado',
      })

    await expect(
      updateVehicleBrand(
        'brand-1',
        { name: 'Nome Ocupado' },
        client,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  test('updateVehicleBrand rejeita slug duplicado', async () => {
    vi.mocked(client.vehicleBrand.findUnique)
      .mockResolvedValueOnce(vehicleBrandRecord)
      .mockResolvedValueOnce({
        ...vehicleBrandRecord,
        id: 'brand-2',
        slug: 'slug-ocupado',
      })

    await expect(
      updateVehicleBrand(
        'brand-1',
        { slug: 'slug-ocupado' },
        client,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  test('updateVehicleBrand normaliza slug antes de atualizar', async () => {
    vi.mocked(client.vehicleBrand.findUnique)
      .mockResolvedValueOnce(vehicleBrandRecord)
      .mockResolvedValueOnce(null)

    vi.mocked(client.vehicleBrand.update).mockResolvedValue({
      ...vehicleBrandRecord,
      slug: 'novo-slug',
    })

    await updateVehicleBrand(
      'brand-1',
      {
        slug: 'Novo Slug',
      },
      client,
    )

    expect(client.vehicleBrand.update).toHaveBeenCalledWith({
      where: { id: 'brand-1' },
      data: {
        slug: 'novo-slug',
      },
    })
  })

  test('updateVehicleBrand atualiza dados válidos', async () => {
    vi.mocked(client.vehicleBrand.findUnique)
      .mockResolvedValueOnce(vehicleBrandRecord)
      .mockResolvedValueOnce(null)

    vi.mocked(client.vehicleBrand.update).mockResolvedValue({
      ...vehicleBrandRecord,
      name: 'Novo Nome',
    })

    await updateVehicleBrand(
      'brand-1',
      {
        name: 'Novo Nome',
      },
      client,
    )

    expect(client.vehicleBrand.update).toHaveBeenCalledWith({
      where: { id: 'brand-1' },
      data: {
        name: 'Novo Nome',
      },
    })
  })

  test('updateVehicleBrand rejeita nome acima do limite', async () => {
    await expect(
      updateVehicleBrand(
        'brand-1',
        {
          name: 'a'.repeat(121),
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('deleteVehicleBrand rejeita id vazio', async () => {
    await expect(
      deleteVehicleBrand('', client),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  test('deleteVehicleBrand rejeita marca inexistente', async () => {
    vi.mocked(client.vehicleBrand.findUnique).mockResolvedValue(null)

    await expect(
      deleteVehicleBrand('brand-1', client),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  test('deleteVehicleBrand rejeita marca com modelos associados', async () => {
    vi.mocked(client.vehicleBrand.findUnique).mockResolvedValue(
      vehicleBrandRecord,
    )
    vi.mocked(client.vehicleModel.count).mockResolvedValue(1)

    await expect(
      deleteVehicleBrand('brand-1', client),
    ).rejects.toBeInstanceOf(ConflictError)

    expect(client.vehicleModel.count).toHaveBeenCalledWith({
      where: { brandId: 'brand-1' },
    })
  })

  test('deleteVehicleBrand apaga marca sem modelos', async () => {
    vi.mocked(client.vehicleBrand.findUnique).mockResolvedValue(
      vehicleBrandRecord,
    )
    vi.mocked(client.vehicleModel.count).mockResolvedValue(0)
    vi.mocked(client.vehicleBrand.delete).mockResolvedValue(
      vehicleBrandRecord,
    )

    await expect(
      deleteVehicleBrand('brand-1', client),
    ).resolves.toEqual(vehicleBrandRecord)

    expect(client.vehicleBrand.delete).toHaveBeenCalledWith({
      where: { id: 'brand-1' },
    })
  })
})