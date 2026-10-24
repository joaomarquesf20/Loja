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
  findCompatibleProductsForVehicleConfiguration,
  findCompatibleVariantsForVehicleConfiguration,
  getProductVehicleCompatibility,
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
    findFirst: ReturnType<typeof vi.fn>
  }
  productCompatibility: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
  }
  product: {
    findUnique: ReturnType<typeof vi.fn>
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
    findFirst: vi.fn(),
  }

  const productCompatibility = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  }

  const product = {
    findUnique: vi.fn(),
  }

  const client = {
    vehicleBrand,
    vehicleModel,
    vehicleGeneration,
    vehicleConfiguration,
    productVariantVehicleCompatibility:
      vehicleVariantCompatibility,
    productVehicleCompatibility:
      productCompatibility,
    product,
  } as unknown as VehicleSearchClient

  return {
    client,
    vehicleBrand,
    vehicleModel,
    vehicleGeneration,
    vehicleConfiguration,
    vehicleVariantCompatibility,
    productCompatibility,
    product,
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

describe(
  'compatible products for vehicle configuration',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'rejeita ID vazio de configuração',
      async () => {
        await expect(
          findCompatibleProductsForVehicleConfiguration(
            '  ',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          ValidationError,
        )

        expect(
          fake.vehicleConfiguration
            .findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'configuração inexistente devolve NotFoundError',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          null,
        )

        await expect(
          findCompatibleProductsForVehicleConfiguration(
            'config-missing',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          NotFoundError,
        )

        expect(
          fake.vehicleVariantCompatibility
            .findMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'une as duas fontes de compatibilidade, deduplicando produto e ordenando por slug',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          {
            id: 'configuration-116d',
          },
        )
        fake.vehicleVariantCompatibility.findMany.mockResolvedValue(
          [
            {
              variant: {
                product: {
                  id: 'product-difusores',
                  slug: 'difusores-bm',
                },
              },
            },
            {
              variant: {
                product: {
                  id: 'product-bicos',
                  slug: 'bicos-injetores',
                },
              },
            },
            {
              variant: {
                product: {
                  id: 'product-difusores',
                  slug: 'difusores-bm',
                },
              },
            },
          ],
        )
        fake.productCompatibility.findMany.mockResolvedValue(
          [
            {
              product: {
                id: 'product-difusores',
                slug: 'difusores-bm',
              },
            },
            {
              product: {
                id: 'product-suspensao',
                slug: 'suspensao-coilover',
              },
            },
          ],
        )

        const products =
          await findCompatibleProductsForVehicleConfiguration(
            'configuration-116d',
            fake.client,
          )

        expect(products).toEqual([
          {
            id: 'product-bicos',
            slug: 'bicos-injetores',
          },
          {
            id: 'product-difusores',
            slug: 'difusores-bm',
          },
          {
            id: 'product-suspensao',
            slug: 'suspensao-coilover',
          },
        ])
      },
    )

    test(
      'preserva o filtro de ativos nas duas fontes',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          {
            id: 'configuration-116d',
          },
        )
        fake.vehicleVariantCompatibility.findMany.mockResolvedValue(
          [],
        )
        fake.productCompatibility.findMany.mockResolvedValue(
          [],
        )

        await findCompatibleProductsForVehicleConfiguration(
          'configuration-116d',
          fake.client,
        )

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
          select: {
            variant: {
              select: {
                product: {
                  select: {
                    id: true,
                    slug: true,
                  },
                },
              },
            },
          },
        })

        expect(
          fake.productCompatibility.findMany,
        ).toHaveBeenCalledWith({
          where: {
            vehicleConfigurationId:
              'configuration-116d',
            product: {
              isActive: true,
            },
          },
          select: {
            product: {
              select: {
                id: true,
                slug: true,
              },
            },
          },
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
        fake.productCompatibility.findMany.mockResolvedValue(
          [],
        )

        await expect(
          findCompatibleProductsForVehicleConfiguration(
            'configuration-1',
            fake.client,
          ),
        ).resolves.toEqual([])
      },
    )
  },
)

describe(
  'product vehicle compatibility status',
  () => {
    let fake: FakeClient

    beforeEach(() => {
      fake = createFakeClient()
    })

    test(
      'rejeita slug vazio de produto',
      async () => {
        await expect(
          getProductVehicleCompatibility(
            '  ',
            'configuration-116d',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          ValidationError,
        )

        expect(
          fake.product.findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita ID vazio de configuração',
      async () => {
        await expect(
          getProductVehicleCompatibility(
            'difusores-bm',
            '   ',
            fake.client,
          ),
        ).rejects.toBeInstanceOf(
          ValidationError,
        )

        expect(
          fake.product.findUnique,
        ).not.toHaveBeenCalled()
        expect(
          fake.vehicleConfiguration
            .findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'produto inexistente devolve NotFoundError',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          {
            id: 'configuration-116d',
          },
        )
        fake.product.findUnique.mockResolvedValue(
          null,
        )

        await expect(
          getProductVehicleCompatibility(
            'missing-product',
            'configuration-116d',
            fake.client,
          ),
        ).rejects.toThrow(
          'Produto não encontrado',
        )
      },
    )

    test(
      'configuração inexistente devolve NotFoundError',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          null,
        )
        fake.product.findUnique.mockResolvedValue(
          {
            id: 'product-difusores',
          },
        )

        await expect(
          getProductVehicleCompatibility(
            'difusores-bm',
            'config-missing',
            fake.client,
          ),
        ).rejects.toThrow(
          'Configuração do veículo não encontrada',
        )
      },
    )

    test(
      'compatível via ligação de variante',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          {
            id: 'configuration-116d',
          },
        )
        fake.product.findUnique.mockResolvedValue(
          {
            id: 'product-difusores',
          },
        )
        fake.vehicleVariantCompatibility.findFirst.mockResolvedValue(
          { id: 'compat-1' },
        )
        fake.productCompatibility.findFirst.mockResolvedValue(
          null,
        )

        await expect(
          getProductVehicleCompatibility(
            'difusores-bm',
            'configuration-116d',
            fake.client,
          ),
        ).resolves.toEqual({
          configurationId:
            'configuration-116d',
          compatible: true,
        })

        expect(
          fake.vehicleVariantCompatibility
            .findFirst,
        ).toHaveBeenCalledWith({
          where: {
            vehicleConfigurationId:
              'configuration-116d',
            variant: {
              productId:
                'product-difusores',
              isActive: true,
            },
          },
          select: { id: true },
        })
      },
    )

    test(
      'compatível via linha de compatibilidade de produto',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          {
            id: 'configuration-116d',
          },
        )
        fake.product.findUnique.mockResolvedValue(
          {
            id: 'product-difusores',
          },
        )
        fake.vehicleVariantCompatibility.findFirst.mockResolvedValue(
          null,
        )
        fake.productCompatibility.findFirst.mockResolvedValue(
          { id: 'product-compat-1' },
        )

        await expect(
          getProductVehicleCompatibility(
            'difusores-bm',
            'configuration-116d',
            fake.client,
          ),
        ).resolves.toEqual({
          configurationId:
            'configuration-116d',
          compatible: true,
        })

        expect(
          fake.productCompatibility.findFirst,
        ).toHaveBeenCalledWith({
          where: {
            productId:
              'product-difusores',
            vehicleConfigurationId:
              'configuration-116d',
          },
          select: { id: true },
        })
      },
    )

    test(
      'sem ligações devolve compatível false',
      async () => {
        fake.vehicleConfiguration.findUnique.mockResolvedValue(
          {
            id: 'configuration-116d',
          },
        )
        fake.product.findUnique.mockResolvedValue(
          {
            id: 'product-difusores',
          },
        )
        fake.vehicleVariantCompatibility.findFirst.mockResolvedValue(
          null,
        )
        fake.productCompatibility.findFirst.mockResolvedValue(
          null,
        )

        await expect(
          getProductVehicleCompatibility(
            'difusores-bm',
            'configuration-116d',
            fake.client,
          ),
        ).resolves.toEqual({
          configurationId:
            'configuration-116d',
          compatible: false,
        })
      },
    )
  },
)
