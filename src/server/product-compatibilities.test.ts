import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  ProductCompatibilityClient,
  addProductCompatibility,
  listProductCompatibilities,
  removeProductCompatibility,
} from './product-compatibilities'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from './products'

const compatibilityRecord = {
  id: 'compatibility-test',
  productId: 'product-test',
  vehicleConfigurationId: 'vehicle-configuration-test',
}

const configurationHierarchy = {
  id: 'vehicle-configuration-test',
  generation: {
    id: 'generation-test',
    model: {
      id: 'model-test',
      brand: {
        id: 'brand-test',
      },
    },
  },
}

const compatibilityListRecord = {
  ...compatibilityRecord,
  vehicleBrand: {
    id: 'brand-test',
    name: 'Volkswagen',
  },
  vehicleModel: {
    id: 'model-test',
    name: 'Golf',
  },
  vehicleGeneration: {
    id: 'generation-test',
    name: 'Mk7',
  },
  vehicleConfiguration: {
    id: 'vehicle-configuration-test',
    name: '2.0 TDI 150',
    engineCode: 'EA288',
    engineType: 'Diesel',
    displacementCc: 1968,
    powerKw: {
      toString: () => '110.5',
    },
    bodyType: 'Hatchback',
    yearFrom: 2013,
    yearTo: 2020,
  },
}

function createClient(): ProductCompatibilityClient {
  return {
    productVehicleCompatibility: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    vehicleConfiguration: {
      findUnique: vi.fn(),
    },
  }
}

describe('product compatibilities service', () => {
  let client: ProductCompatibilityClient

  beforeEach(() => {
    client = createClient()
  })

  describe('listProductCompatibilities', () => {
    test('rejeita productId vazio', async () => {
      await expect(
        listProductCompatibilities('', client),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)

      await expect(
        listProductCompatibilities('product-test', client),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('devolve lista vazia quando não existem compatibilidades', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.productVehicleCompatibility.findMany,
      ).mockResolvedValue([])

      const result = await listProductCompatibilities(
        'product-test',
        client,
      )

      expect(result).toEqual([])
      expect(
        client.productVehicleCompatibility.findMany,
      ).toHaveBeenCalledWith({
        where: { productId: 'product-test' },
        include: {
          vehicleBrand: {
            select: {
              id: true,
              name: true,
            },
          },
          vehicleModel: {
            select: {
              id: true,
              name: true,
            },
          },
          vehicleGeneration: {
            select: {
              id: true,
              name: true,
            },
          },
          vehicleConfiguration: {
            select: {
              id: true,
              name: true,
              engineCode: true,
              engineType: true,
              displacementCc: true,
              powerKw: true,
              bodyType: true,
              yearFrom: true,
              yearTo: true,
            },
          },
        },
      })
    })

    test('devolve compatibilidades do produto', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.productVehicleCompatibility.findMany,
      ).mockResolvedValue([compatibilityListRecord])

      const result = await listProductCompatibilities(
        'product-test',
        client,
      )

      expect(result).toEqual([
        {
          ...compatibilityListRecord,
          vehicleConfiguration: {
            ...compatibilityListRecord.vehicleConfiguration,
            powerKw: 110.5,
          },
        },
      ])
    })
  })

  describe('addProductCompatibility', () => {
    test('rejeita productId vazio', async () => {
      await expect(
        addProductCompatibility(
          '',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toThrow()
    })

    test('rejeita vehicleConfigurationId vazio', async () => {
      await expect(
        addProductCompatibility(
          'product-test',
          '',
          client,
        ),
      ).rejects.toThrow()
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)

      await expect(
        addProductCompatibility(
          'product-test',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('rejeita configuração de veículo inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.vehicleConfiguration.findUnique,
      ).mockResolvedValue(null)

      await expect(
        addProductCompatibility(
          'product-test',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('procura configuração com a hierarquia necessária', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.vehicleConfiguration.findUnique,
      ).mockResolvedValue(configurationHierarchy)
      vi.mocked(
        client.productVehicleCompatibility.findFirst,
      ).mockResolvedValue(compatibilityRecord)

      await expect(
        addProductCompatibility(
          'product-test',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.vehicleConfiguration.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          id: 'vehicle-configuration-test',
        },
        select: {
          id: true,
          generation: {
            select: {
              id: true,
              model: {
                select: {
                  id: true,
                  brand: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    })

    test('rejeita associação duplicada usando findFirst', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.vehicleConfiguration.findUnique,
      ).mockResolvedValue(configurationHierarchy)
      vi.mocked(
        client.productVehicleCompatibility.findFirst,
      ).mockResolvedValue(compatibilityRecord)

      await expect(
        addProductCompatibility(
          'product-test',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.productVehicleCompatibility.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          productId: 'product-test',
          vehicleConfigurationId:
            'vehicle-configuration-test',
        },
      })
    })

    test('cria associação válida', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.vehicleConfiguration.findUnique,
      ).mockResolvedValue(configurationHierarchy)
      vi.mocked(
        client.productVehicleCompatibility.findFirst,
      ).mockResolvedValue(null)
      vi.mocked(
        client.productVehicleCompatibility.create,
      ).mockResolvedValue(compatibilityRecord)

      const result = await addProductCompatibility(
        'product-test',
        'vehicle-configuration-test',
        client,
      )

      expect(
        client.productVehicleCompatibility.create,
      ).toHaveBeenCalledWith({
        data: {
          productId: 'product-test',
          vehicleBrandId: 'brand-test',
          vehicleModelId: 'model-test',
          vehicleGenerationId: 'generation-test',
          vehicleConfigurationId:
            'vehicle-configuration-test',
        },
      })

      expect(result).toEqual(compatibilityRecord)
    })
  })

  describe('removeProductCompatibility', () => {
    test('rejeita productId vazio', async () => {
      await expect(
        removeProductCompatibility(
          '',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toThrow()
    })

    test('rejeita vehicleConfigurationId vazio', async () => {
      await expect(
        removeProductCompatibility(
          'product-test',
          '',
          client,
        ),
      ).rejects.toThrow()
    })

    test('rejeita associação inexistente', async () => {
      vi.mocked(
        client.productVehicleCompatibility.findFirst,
      ).mockResolvedValue(null)

      await expect(
        removeProductCompatibility(
          'product-test',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('procura associação por produto e configuração', async () => {
      vi.mocked(
        client.productVehicleCompatibility.findFirst,
      ).mockResolvedValue(compatibilityRecord)
      vi.mocked(
        client.productVehicleCompatibility.delete,
      ).mockResolvedValue(compatibilityRecord)

      await removeProductCompatibility(
        'product-test',
        'vehicle-configuration-test',
        client,
      )

      expect(
        client.productVehicleCompatibility.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          productId: 'product-test',
          vehicleConfigurationId:
            'vehicle-configuration-test',
        },
      })
    })

    test('apaga associação existente', async () => {
      vi.mocked(
        client.productVehicleCompatibility.findFirst,
      ).mockResolvedValue(compatibilityRecord)
      vi.mocked(
        client.productVehicleCompatibility.delete,
      ).mockResolvedValue(compatibilityRecord)

      const result = await removeProductCompatibility(
        'product-test',
        'vehicle-configuration-test',
        client,
      )

      expect(
        client.productVehicleCompatibility.delete,
      ).toHaveBeenCalledWith({
        where: {
          id: 'compatibility-test',
        },
      })

      expect(result).toEqual(compatibilityRecord)
    })
  })
})