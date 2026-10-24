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
  NotFoundError,
  ValidationError,
  findCompatibleVariantsForVehicleConfiguration,
  listVehicleGenerationOptions,
  listVehicleMakes,
  listVehicleModelOptions,
  type VehicleSearchClient,
} from './vehicle-search'

const vehicleMake = {
  id: 'brand-bmw',
  name: 'BMW',
  slug: 'dev-bmw',
}

const vehicleModelOption = {
  id: 'model-serie-1',
  name: 'Série 1',
  slug: 'serie-1',
  description: null,
}

const vehicleGenerationOption = {
  id: 'generation-f20',
  name: 'F20',
  platform: null,
  description: null,
  configurations: [
    {
      id: 'configuration-116d',
      name: '116d',
      engineCode: 'N47D20C1',
      engineType: 'Diesel',
      displacementCc: 1995,
      powerKw: 85,
      bodyType: '5-door hatchback',
      yearFrom: 2011,
      yearTo: 2015,
    },
  ],
}

const compatibleVariantSummary = {
  id: 'variant-1',
  sku: 'BM-2-44-MPACK-SD1G',
  price: '129.90',
  stockQuantity: 9,
  images: [],
  position: 0,
  optionKey: 'default',
  product: {
    id: 'product-1',
    name: 'Difusores de Saias Laterais V.1 BMW Série 2 Gran Coupé F44',
    slug: 'difusores-bm',
    images: [],
    defaultFinish: null,
  },
}

const compatibilityLink = {
  id: 'compat-1',
  variant: compatibleVariantSummary,
}

type FakeClient = {
  client: VehicleSearchClient
  vehicleBrand: {
    findUnique: ReturnType<typeof vi.fn>
  }
  vehicleModel: {
    findFirst: ReturnType<typeof vi.fn>
  }
  vehicleGeneration: {
    findMany: ReturnType<typeof vi.fn>
  }
  vehicleConfiguration: {
    findUnique: ReturnType<typeof vi.fn>
  }
  vehicleVariantCompatibility: {
    findMany: ReturnType<typeof vi.fn>
  }
}

function createFakeClient(): FakeClient {
  const vehicleBrand = {
    findUnique: vi.fn(),
  }

  const vehicleModel = {
    findFirst: vi.fn(),
  }

  const vehicleGeneration = {
    findMany: vi.fn(),
  }

  const vehicleConfiguration = {
    findUnique: vi.fn(),
  }

  const vehicleVariantCompatibility = {
    findMany: vi.fn(),
  }

  const client = {
    vehicleBrand,
    vehicleModel,
    vehicleGeneration,
    vehicleConfiguration,
    productVariantVehicleCompatibility:
      vehicleVariantCompatibility,
  } as unknown as VehicleSearchClient

  return {
    client,
    vehicleBrand,
    vehicleModel,
    vehicleGeneration,
    vehicleConfiguration,
    vehicleVariantCompatibility,
  }
}

describe(
  'vehicle search service',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    describe(
      'listVehicleMakes',
      () => {
        test(
          'devolve as marcas ordenadas por nome',
          async () => {
            const vehicleBrandFindMany =
              vi.fn().mockResolvedValue([
                vehicleMake,
              ])
            ;(
              fake.client as unknown as {
                vehicleBrand: {
                  findMany: ReturnType<
                    typeof vi.fn
                  >
                }
              }
            ).vehicleBrand.findMany =
              vehicleBrandFindMany

            const makes =
              await listVehicleMakes(
                fake.client,
              )

            expect(makes).toEqual([
              vehicleMake,
            ])
            expect(
              vehicleBrandFindMany,
            ).toHaveBeenCalledWith({
              orderBy: {
                name: 'asc',
              },
              select: {
                id: true,
                name: true,
                slug: true,
              },
            })
          },
        )
      },
    )
  },
)

describe(
  'vehicle model options',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'rejeita make vazio sem tocar na base de dados',
      async () => {
        fake.vehicleBrand.findUnique.mockResolvedValue(
          vehicleMake,
        )

        await expect(
          listVehicleModelOptions(
            '   ',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          ValidationError,
        )

        expect(
          fake.vehicleBrand.findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'marca inexistente devolve NotFoundError',
      async () => {
        fake.vehicleBrand.findUnique.mockResolvedValue(
          null,
        )

        await expect(
          listVehicleModelOptions(
            'dev-opel',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          NotFoundError,
        )

        expect(
          fake.vehicleBrand.findUnique,
        ).toHaveBeenCalledWith({
          where: { slug: 'dev-opel' },
          select: { id: true },
        })
      },
    )

    test(
      'pesquisa modelos da marca por slug',
      async () => {
        const vehicleModelFindMany =
          vi.fn().mockResolvedValue([
            vehicleModelOption,
          ])
        ;(
          fake.client as unknown as {
            vehicleModel: {
              findMany: ReturnType<
                typeof vi.fn
              >
            }
          }
        ).vehicleModel.findMany =
          vehicleModelFindMany
        fake.vehicleBrand.findUnique.mockResolvedValue(
          {
            id: 'brand-bmw',
          },
        )

        const models =
          await listVehicleModelOptions(
            'dev-bmw',
            fake.client,
          )

        expect(models).toEqual([
          vehicleModelOption,
        ])
        expect(
          vehicleModelFindMany,
        ).toHaveBeenCalledWith({
          where: { brandId: 'brand-bmw' },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
          },
        })
      },
    )

    test(
      'marca sem modelos devolve lista vazia',
      async () => {
        const vehicleModelFindMany =
          vi.fn().mockResolvedValue([])
        ;(
          fake.client as unknown as {
            vehicleModel: {
              findMany: ReturnType<
                typeof vi.fn
              >
            }
          }
        ).vehicleModel.findMany =
          vehicleModelFindMany
        fake.vehicleBrand.findUnique.mockResolvedValue(
          {
            id: 'brand-opel',
          },
        )

        await expect(
          listVehicleModelOptions(
            'opel',
            fake.client,
          ),
        ).resolves.toEqual([])
      },
    )
  },
)

describe(
  'vehicle generation options',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'rejeita modelo vazio sem tocar na base de dados',
      async () => {
        fake.vehicleModel.findFirst.mockResolvedValue(
          {
            id: 'model-serie-1',
          },
        )

        await expect(
          listVehicleGenerationOptions(
            '',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          ValidationError,
        )

        expect(
          fake.vehicleModel.findFirst,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'modelo inexistente devolve NotFoundError',
      async () => {
        fake.vehicleModel.findFirst.mockResolvedValue(
          null,
        )

        await expect(
          listVehicleGenerationOptions(
            'f40',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          NotFoundError,
        )
      },
    )

    test(
      'pesquisa gerações com configurações do modelo',
      async () => {
        const vehicleGenerationFindMany =
          vi.fn().mockResolvedValue([
            vehicleGenerationOption,
          ])
        ;(
          fake.client as unknown as {
            vehicleGeneration: {
              findMany: ReturnType<
                typeof vi.fn
              >
            }
          }
        ).vehicleGeneration.findMany =
          vehicleGenerationFindMany
        fake.vehicleModel.findFirst.mockResolvedValue(
          {
            id: 'model-serie-1',
          },
        )

        const generations =
          await listVehicleGenerationOptions(
            'serie-1',
            fake.client,
          )

        expect(generations).toEqual([
          vehicleGenerationOption,
        ])
        expect(
          fake.vehicleModel.findFirst,
        ).toHaveBeenCalledWith({
          where: { slug: 'serie-1' },
          orderBy: {
            brand: { name: 'asc' },
          },
          select: { id: true },
        })
        expect(
          vehicleGenerationFindMany,
        ).toHaveBeenCalledWith({
          where: {
            modelId: 'model-serie-1',
          },
          orderBy: { name: 'asc' },
          select: expect.objectContaining({
            configurations:
              expect.objectContaining({
                orderBy: {
                  name: 'asc',
                },
              }),
          }),
        })
      },
    )
  },
)

describe(
  'compatible variants for vehicle configuration',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'rejeita ID vazio de configuração',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          null,
        )

        await expect(
          findCompatibleVariantsForVehicleConfiguration(
            '  ',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          ValidationError,
        )
      },
    )

    test(
      'configuração inexistente devolve NotFoundError',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          null,
        )

        await expect(
          findCompatibleVariantsForVehicleConfiguration(
            'config-missing',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          NotFoundError,
        )
      },
    )

    test(
      'pesquisa ligações M2M só com variantes ativas de produtos ativos',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          {
            id: 'configuration-116d',
          },
        )
        fake.vehicleVariantCompatibility.findMany.mockResolvedValue(
          [compatibilityLink],
        )

        const variants =
          await findCompatibleVariantsForVehicleConfiguration(
            'configuration-116d',
            fake.client,
          )

        expect(variants).toEqual([
          compatibleVariantSummary,
        ])
        expect(
          fake.vehicleVariantCompatibility
            .findMany,
        ).toHaveBeenCalledWith({
          where: {
            vehicleConfigurationId:
              'configuration-116d',
            variant: {
              isActive: true,
              product: {
                isActive: true,
              },
            },
          },
          orderBy: [
            {
              variant: {
                product: {
                  name: 'asc',
                },
              },
            },
            {
              variant: {
                position: 'asc',
              },
            },
          ],
          select: expect.objectContaining({
            variant: expect.any(Object),
          }),
        })
      },
    )

    test(
      'configuração sem ligações devolve lista vazia',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          {
            id: 'configuration-1',
          },
        )
        fake.vehicleVariantCompatibility.findMany.mockResolvedValue(
          [],
        )

        await expect(
          findCompatibleVariantsForVehicleConfiguration(
            'configuration-1',
            fake.client,
          ),
        ).resolves.toEqual([])
      },
    )
  },
)
