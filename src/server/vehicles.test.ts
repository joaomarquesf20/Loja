import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { ZodError } from 'zod'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  NotFoundError,
  checkProductCompatibility,
  getCompatibleProductIds,
  getVehicleMakes,
  getVehicleModels,
  getVehicleSpecs,
  type VehicleFitmentClient,
} from './vehicles'

type FakeClient = {
  client: VehicleFitmentClient
  vehicleMake: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
  vehicleModel: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
  vehicleSpec: {
    findMany: ReturnType<typeof vi.fn>
  }
  productCompatibility: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
}

function createFakeClient(): FakeClient {
  const delegates = {
    vehicleMake: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    vehicleModel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    vehicleSpec: {
      findMany: vi.fn(),
    },
    productCompatibility: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  }

  return {
    client:
      delegates as unknown as VehicleFitmentClient,
    ...delegates,
  }
}

describe(
  'getVehicleMakes',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'lista as marcas ordenadas por nome',
      async () => {
        const rows = [
          {
            id: 'make-bmw',
            name: 'BMW',
            slug: 'bmw',
          },
          {
            id: 'make-opel',
            name: 'Opel',
            slug: 'opel',
          },
        ]
        fake.vehicleMake.findMany.mockResolvedValue(
          rows,
        )

        const result =
          await getVehicleMakes(fake.client)

        expect(result).toEqual(rows)
        expect(
          fake.vehicleMake.findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: [{ name: 'asc' }],
            select: {
              id: true,
              name: true,
              slug: true,
            },
          }),
        )
      },
    )

    test(
      'lista vazia quando não há marcas',
      async () => {
        fake.vehicleMake.findMany.mockResolvedValue(
          [],
        )

        const result =
          await getVehicleMakes(fake.client)

        expect(result).toEqual([])
      },
    )
  },
)

describe(
  'getVehicleModels',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'rejeita makeId vazio com ZodError',
      async () => {
        await expect(
          getVehicleModels('', fake.client),
        ).rejects.toBeInstanceOf(ZodError)

        expect(
          fake.vehicleMake.findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      '404 quando a marca não existe',
      async () => {
        fake.vehicleMake.findUnique.mockResolvedValue(
          null,
        )

        await expect(
          getVehicleModels('make-x', fake.client),
        ).rejects.toThrow(NotFoundError)

        await expect(
          getVehicleModels('make-x', fake.client),
        ).rejects.toThrow(
          'Marca de veículo não encontrada',
        )
      },
    )

    test(
      'devolve os modelos da marca ordenados por nome',
      async () => {
        fake.vehicleMake.findUnique.mockResolvedValue(
          { id: 'make-bmw' },
        )
        const rows = [
          {
            id: 'model-serie-1',
            name: 'Série 1',
            slug: 'serie-1',
          },
          {
            id: 'model-serie-3',
            name: 'Série 3',
            slug: 'serie-3',
          },
        ]
        fake.vehicleModel.findMany.mockResolvedValue(
          rows,
        )

        const result =
          await getVehicleModels('make-bmw', fake.client)

        expect(result).toEqual(rows)
        expect(
          fake.vehicleMake.findUnique,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'make-bmw' },
            select: { id: true },
          }),
        )
        expect(
          fake.vehicleModel.findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { makeId: 'make-bmw' },
            orderBy: [{ name: 'asc' }],
          }),
        )
      },
    )
  },
)

describe(
  'getVehicleSpecs',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'rejeita modelId vazio com ZodError',
      async () => {
        await expect(
          getVehicleSpecs('', fake.client),
        ).rejects.toBeInstanceOf(ZodError)

        expect(
          fake.vehicleModel.findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      '404 quando o modelo não existe',
      async () => {
        fake.vehicleModel.findUnique.mockResolvedValue(
          null,
        )

        await expect(
          getVehicleSpecs('model-x', fake.client),
        ).rejects.toThrow(
          'Modelo de veículo não encontrado',
        )
      },
    )

    test(
      'devolve as especificações do modelo ordenadas por motor e ano',
      async () => {
        fake.vehicleModel.findUnique.mockResolvedValue(
          { id: 'model-serie-1' },
        )
        const rows = [
          {
            id: 'spec-116d',
            engine: '116d',
            engineCode: 'N47D20C1',
            yearStart: 2011,
            yearEnd: 2015,
            fuelType: 'DIESEL',
            powerHp: 116,
          },
          {
            id: 'spec-118d-facelift',
            engine: '118d',
            engineCode: null,
            yearStart: 2015,
            yearEnd: null,
            fuelType: 'DIESEL',
            powerHp: 150,
          },
        ]
        fake.vehicleSpec.findMany.mockResolvedValue(
          rows,
        )

        const result =
          await getVehicleSpecs('model-serie-1', fake.client)

        expect(result).toEqual(rows)
        expect(
          fake.vehicleSpec.findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { modelId: 'model-serie-1' },
            orderBy: [
              { engine: 'asc' },
              { yearStart: 'asc' },
            ],
          }),
        )
      },
    )
  },
)

describe(
  'checkProductCompatibility',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'compatível com notas quando a ligação existe',
      async () => {
        fake.productCompatibility.findUnique.mockResolvedValue(
          { notes: 'requer apoios originais' },
        )

        const result =
          await checkProductCompatibility(
            {
              productId: 'product-difusores',
              vehicleSpecId: 'spec-116d',
            },
            fake.client,
          )

        expect(result).toEqual({
          productId: 'product-difusores',
          vehicleSpecId: 'spec-116d',
          compatible: true,
          notes: 'requer apoios originais',
        })
        expect(
          fake.productCompatibility.findUnique,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              productId_vehicleSpecId: {
                productId: 'product-difusores',
                vehicleSpecId: 'spec-116d',
              },
            },
            select: { notes: true },
          }),
        )
      },
    )

    test(
      'incompatível quando não há ligação registada',
      async () => {
        fake.productCompatibility.findUnique.mockResolvedValue(
          null,
        )

        const result =
          await checkProductCompatibility(
            {
              productId: 'product-x',
              vehicleSpecId: 'spec-y',
            },
            fake.client,
          )

        expect(result).toEqual({
          productId: 'product-x',
          vehicleSpecId: 'spec-y',
          compatible: false,
          notes: null,
        })
      },
    )

    test(
      'incompatível com notas null quando a ligação não tem notas',
      async () => {
        fake.productCompatibility.findUnique.mockResolvedValue(
          { notes: null },
        )

        const result =
          await checkProductCompatibility(
            {
              productId: 'product-x',
              vehicleSpecId: 'spec-y',
            },
            fake.client,
          )

        expect(result).toEqual({
          productId: 'product-x',
          vehicleSpecId: 'spec-y',
          compatible: true,
          notes: null,
        })
      },
    )

    test(
      'rejeita productId vazio com ZodError',
      async () => {
        await expect(
          checkProductCompatibility(
            {
              productId: '',
              vehicleSpecId: 'spec-116d',
            },
            fake.client,
          ),
        ).rejects.toBeInstanceOf(ZodError)

        await expect(
          checkProductCompatibility(
            {
              vehicleSpecId: 'spec-116d',
            },
            fake.client,
          ),
        ).rejects.toBeInstanceOf(ZodError)
      },
    )

    test(
      'rejeita vehicleSpecId vazio com ZodError',
      async () => {
        await expect(
          checkProductCompatibility(
            {
              productId: 'product-difusores',
              vehicleSpecId: '',
            },
            fake.client,
          ),
        ).rejects.toBeInstanceOf(ZodError)
      },
    )
  },
)

describe(
  'getCompatibleProductIds',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'devolve os IDs dos produtos compatíveis',
      async () => {
        fake.productCompatibility.findMany.mockResolvedValue(
          [
            { productId: 'product-difusores' },
            { productId: 'product-spoiler' },
          ],
        )

        const result =
          await getCompatibleProductIds(
            { vehicleSpecId: 'spec-116d' },
            fake.client,
          )

        expect(result).toEqual([
          'product-difusores',
          'product-spoiler',
        ])
        expect(
          fake.productCompatibility.findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { vehicleSpecId: 'spec-116d' },
            select: { productId: true },
          }),
        )
      },
    )

    test(
      'lista vazia quando a especificação não tem compatibilidades',
      async () => {
        fake.productCompatibility.findMany.mockResolvedValue(
          [],
        )

        const result =
          await getCompatibleProductIds(
            { vehicleSpecId: 'spec-unknown' },
            fake.client,
          )

        expect(result).toEqual([])
      },
    )

    test(
      'rejeita vehicleSpecId vazio com ZodError',
      async () => {
        await expect(
          getCompatibleProductIds(
            { vehicleSpecId: '' },
            fake.client,
          ),
        ).rejects.toBeInstanceOf(ZodError)
      },
    )
  },
)
