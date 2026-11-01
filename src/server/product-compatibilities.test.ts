import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ZodError } from 'zod'

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
  vehicleSpecId: 'vehicle-spec-test',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const compatibilityListRecord = {
  ...compatibilityRecord,
  vehicleSpec: {
    id: 'vehicle-spec-test',
    engine: '2.0 TDI 150',
    engineCode: 'EA288',
    yearStart: 2013,
    yearEnd: 2020,
    fuelType: 'DIESEL',
    powerHp: 150,
    model: {
      id: 'model-test',
      name: 'Golf',
      slug: 'golf',
      make: {
        id: 'make-test',
        name: 'Volkswagen',
        slug: 'volkswagen',
      },
    },
  },
}

function createClient(): ProductCompatibilityClient {
  return {
    productCompatibility: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    vehicleSpec: {
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
        client.productCompatibility.findMany,
      ).mockResolvedValue([])

      const result = await listProductCompatibilities(
        'product-test',
        client,
      )

      expect(result).toEqual([])
      expect(
        client.productCompatibility.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'product-test' },
        }),
      )
    })

    test('devolve compatibilidades com a hierarquia veicular incluída', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
      })
      vi.mocked(
        client.productCompatibility.findMany,
      ).mockResolvedValue([compatibilityListRecord])

      const result = await listProductCompatibilities(
        'product-test',
        client,
      )

      expect(result).toEqual([compatibilityListRecord])
    })
  })

  describe('addProductCompatibility', () => {
    test('rejeita input inválido', async () => {
      await expect(
        addProductCompatibility(
          {
            productId: '',
            vehicleSpecId: '',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(ZodError)

      expect(
        client.productCompatibility.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita produto inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue(null)

      await expect(
        addProductCompatibility({
          productId: 'product-test',
          vehicleSpecId: 'vehicle-spec-test',
        },
        client,
      ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.vehicleSpec.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita jantes: a compatibilidade vem das especificações da variante', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
        category: {
          name: 'Jantes',
          slug: 'jantes',
        },
      })

      await expect(
        addProductCompatibility({
          productId: 'product-test',
          vehicleSpecId: 'vehicle-spec-test',
        },
        client,
      ),
      ).rejects.toBeInstanceOf(ValidationError)

      expect(
        client.vehicleSpec.findUnique,
      ).not.toHaveBeenCalled()
    })

    test('rejeita especificação inexistente', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
        category: {
          name: 'Suspensões',
          slug: 'suspensoes',
        },
      })
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue(null)

      await expect(
        addProductCompatibility({
          productId: 'product-test',
          vehicleSpecId: 'vehicle-spec-missing',
        },
        client,
      ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.productCompatibility.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita associação duplicada', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
        category: {
          name: 'Suspensões',
          slug: 'suspensoes',
        },
      })
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue({ id: 'vehicle-spec-test' })
      vi.mocked(
        client.productCompatibility.findUnique,
      ).mockResolvedValue({ id: 'compatibility-test' })

      await expect(
        addProductCompatibility({
          productId: 'product-test',
          vehicleSpecId: 'vehicle-spec-test',
        },
        client,
      ),
      ).rejects.toBeInstanceOf(ConflictError)

      expect(
        client.productCompatibility.create,
      ).not.toHaveBeenCalled()
    })

    test('cria associação com notas', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
        category: {
          name: 'Suspensões',
          slug: 'suspensoes',
        },
      })
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue({ id: 'vehicle-spec-test' })
      vi.mocked(
        client.productCompatibility.findUnique,
      ).mockResolvedValue(null)
      vi.mocked(
        client.productCompatibility.create,
      ).mockResolvedValue({
        ...compatibilityRecord,
        notes: 'requer apoios originais',
      })

      const result = await addProductCompatibility(
        {
          productId: 'product-test',
          vehicleSpecId: 'vehicle-spec-test',
          notes: ' requer apoios originais ',
        },
        client,
      )

      expect(result).toEqual({
        ...compatibilityRecord,
        notes: 'requer apoios originais',
      })
      expect(
        client.productCompatibility.create,
      ).toHaveBeenCalledWith({
        data: {
          productId: 'product-test',
          vehicleSpecId: 'vehicle-spec-test',
          notes: 'requer apoios originais',
        },
      })
    })

    test('cria associação sem notas (null)', async () => {
      vi.mocked(client.product.findUnique).mockResolvedValue({
        id: 'product-test',
        category: {
          name: 'Suspensões',
          slug: 'suspensoes',
        },
      })
      vi.mocked(
        client.vehicleSpec.findUnique,
      ).mockResolvedValue({ id: 'vehicle-spec-test' })
      vi.mocked(
        client.productCompatibility.findUnique,
      ).mockResolvedValue(null)
      vi.mocked(
        client.productCompatibility.create,
      ).mockResolvedValue(compatibilityRecord)

      const result = await addProductCompatibility(
        {
          productId: 'product-test',
          vehicleSpecId: 'vehicle-spec-test',
        },
        client,
      )

      expect(result).toEqual(compatibilityRecord)
      expect(
        client.productCompatibility.create,
      ).toHaveBeenCalledWith({
        data: {
          productId: 'product-test',
          vehicleSpecId: 'vehicle-spec-test',
          notes: null,
        },
      })
    })
  })

  describe('removeProductCompatibility', () => {
    test('rejeita input inválido', async () => {
      await expect(
        removeProductCompatibility('', '', client),
      ).rejects.toBeInstanceOf(ZodError)

      expect(
        client.productCompatibility.delete,
      ).not.toHaveBeenCalled()
    })

    test('rejeita associação inexistente', async () => {
      vi.mocked(
        client.productCompatibility.findUnique,
      ).mockResolvedValue(null)

      await expect(
        removeProductCompatibility(
          'product-test',
          'vehicle-spec-missing',
          client,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(
        client.productCompatibility.delete,
      ).not.toHaveBeenCalled()
    })

    test('remove a associação existente', async () => {
      vi.mocked(
        client.productCompatibility.findUnique,
      ).mockResolvedValue({ id: 'compatibility-test' })
      vi.mocked(
        client.productCompatibility.delete,
      ).mockResolvedValue(compatibilityRecord)

      const result = await removeProductCompatibility(
        'product-test',
        'vehicle-spec-test',
        client,
      )

      expect(result).toEqual(compatibilityRecord)
      expect(
        client.productCompatibility.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'compatibility-test' },
      })
    })
  })
})
