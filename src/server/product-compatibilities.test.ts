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

function createClient(): ProductCompatibilityClient {
  return {
    productVehicleCompatibility: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
      })
    })

    test('devolve compatibilidades do produto', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.productVehicleCompatibility.findMany,
      ).mockResolvedValue([compatibilityRecord])

      const result = await listProductCompatibilities(
        'product-test',
        client,
      )

      expect(result).toEqual([compatibilityRecord])
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

    test('rejeita associação duplicada', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.vehicleConfiguration.findUnique,
      ).mockResolvedValue({
        id: 'vehicle-configuration-test',
      })
      vi.mocked(
        client.productVehicleCompatibility.findUnique,
      ).mockResolvedValue(compatibilityRecord)

      await expect(
        addProductCompatibility(
          'product-test',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    test('cria associação válida', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.vehicleConfiguration.findUnique,
      ).mockResolvedValue({
        id: 'vehicle-configuration-test',
      })
      vi.mocked(
        client.productVehicleCompatibility.findUnique,
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
        client.productVehicleCompatibility.findUnique,
      ).mockResolvedValue(null)

      await expect(
        removeProductCompatibility(
          'product-test',
          'vehicle-configuration-test',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('apaga associação existente', async () => {
      vi.mocked(
        client.productVehicleCompatibility.findUnique,
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
          productId_vehicleConfigurationId: {
            productId: 'product-test',
            vehicleConfigurationId:
              'vehicle-configuration-test',
          },
        },
      })

      expect(result).toEqual(compatibilityRecord)
    })
  })
})