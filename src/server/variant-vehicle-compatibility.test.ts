import {
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import type {
  Prisma,
  PrismaClient,
} from '@prisma/client'

/**
 * Epico 2 (Vehicle Search) — doubles do novo modelo
 * ProductVariantVehicleCompatibility.
 *
 * A casa tipa os fakes com `Pick<PrismaClient, ...>` (§13):
 * se o cliente gerado deixar de expor o accessor
 * `productVariantVehicleCompatibility`, o próprio
 * `Pick` abaixo passa a falhar em `tsc --noEmit`.
 */

type VariantVehicleCompatibilityClient =
  Pick<
    PrismaClient,
    | 'productVariant'
    | 'productVariantVehicleCompatibility'
  >

const fakeConfiguration = {
  id: 'configuration-116d',
  generationId: 'generation-f20',
  name: '116d',
  engineCode: 'N47D20C1',
  engineType: 'Diesel',
  displacementCc: 1995,
  powerKw: 85,
  bodyType: '5-door hatchback',
  yearFrom: 2011,
  yearTo: 2015,
  generation: {
    id: 'generation-f20',
    modelId: 'model-serie-1',
    name: 'F20',
    model: {
      id: 'model-serie-1',
      brandId: 'brand-bmw',
      name: 'Série 1',
      brand: {
        id: 'brand-bmw',
        name: 'BMW',
        slug: 'dev-bmw',
      },
    },
  },
}

const fakeCompatibilityRow = {
  id: 'compat-1',
  productVariantId: 'variant-1',
  vehicleConfigurationId: fakeConfiguration.id,
  variant: {
    id: 'variant-1',
    sku: 'BM-2-44-MPACK-SD1G',
    product: {
      id: 'product-1',
      name: 'Difusores de Saias Laterais V.1 BMW Série 2 Gran Coupé F44',
    },
  },
  vehicleConfiguration: fakeConfiguration,
}

function createFakeClient(
  findManyResult: unknown[],
) {
  return {
    productVariant: {
      findUnique: vi.fn(),
    },
    productVariantVehicleCompatibility:
      {
        findMany: vi
          .fn()
          .mockResolvedValue(
            findManyResult,
          ),
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      },
  } as unknown as VariantVehicleCompatibilityClient
}

/**
 * Leitura equivalente à que o seed/implementação de
 * pesquisa usa: ligações variante↔configuração com a
 * árvore veicular incluída.
 */
type VariantCompatibilityWithTree =
  Prisma.ProductVariantVehicleCompatibilityGetPayload<{
    include: {
      variant: {
        include: {
          product: true
        }
      }
      vehicleConfiguration: {
        include: {
          generation: {
            include: {
              model: {
                include: {
                  brand: true
                }
              }
            }
          }
        }
      }
    }
  }>

describe(
  'variant vehicle compatibility doubles',
  () => {
    test(
      'findMany devolve o shape variante → configuração → geração → modelo → marca',
      async () => {
        const client =
          createFakeClient([
            fakeCompatibilityRow,
          ])

        const rows =
          await client.productVariantVehicleCompatibility.findMany(
            {
              where: {
                variant: {
                  sku: 'BM-2-44-MPACK-SD1G',
                },
              },
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
                vehicleConfiguration: {
                  include: {
                    generation: {
                      include: {
                        model: {
                          include: {
                            brand: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          )

        expect(rows).toHaveLength(1)

        const [row] =
          rows as unknown as Array<VariantCompatibilityWithTree>

        expect(row.variant.sku).toBe(
          'BM-2-44-MPACK-SD1G',
        )
        expect(
          row.variant.product.name,
        ).toContain('BMW')
        expect(
          row.vehicleConfiguration.name,
        ).toBe('116d')
        expect(
          row.vehicleConfiguration
            .generation.name,
        ).toBe('F20')
        expect(
          row.vehicleConfiguration
            .generation.model.name,
        ).toBe('Série 1')
        expect(
          row.vehicleConfiguration
            .generation.model.brand.name,
        ).toBe('BMW')
      },
    )

    test(
      'o accessor do modelo novo existe no cliente gerado',
      async () => {
        const client =
          createFakeClient([])

        await expect(
          client.productVariantVehicleCompatibility.findMany(),
        ).resolves.toEqual([])

        expect(
          client
            .productVariantVehicleCompatibility
            .findMany,
        ).toHaveBeenCalledTimes(1)
      },
    )
  },
)
