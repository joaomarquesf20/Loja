import type {
  Prisma,
  PrismaClient,
} from '@prisma/client'

import { prisma } from './db'

const vehicleCompatibilityTreeSelect = {
  id: true,
  name: true,
  slug: true,
  models: {
    orderBy: {
      name: 'asc' as const,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      generations: {
        orderBy: {
          name: 'asc' as const,
        },
        select: {
          id: true,
          name: true,
          platform: true,
          description: true,
          configurations: {
            orderBy: {
              name: 'asc' as const,
            },
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
      },
    },
  },
} satisfies Prisma.VehicleBrandSelect

export type VehicleCompatibilityTree = Array<{
  id: string
  name: string
  slug: string
  models: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    generations: Array<{
      id: string
      name: string
      platform: string | null
      description: string | null
      configurations: Array<{
        id: string
        name: string
        engineCode: string | null
        engineType: string | null
        displacementCc: number | null
        powerKw: number | null
        bodyType: string | null
        yearFrom: number | null
        yearTo: number | null
      }>
    }>
  }>
}>

export type VehicleCompatibilityTreeClient =
  Pick<PrismaClient, 'vehicleBrand'>

function getClient(
  client?: VehicleCompatibilityTreeClient,
): VehicleCompatibilityTreeClient {
  return client ?? prisma
}

function normalizePowerKw(
  value:
    | number
    | string
    | { toString(): string }
    | null,
) {
  if (value === null) {
    return null
  }

  return Number(value.toString())
}

export async function listVehicleCompatibilityTree(
  client?: VehicleCompatibilityTreeClient,
): Promise<VehicleCompatibilityTree> {
  const db = getClient(client)
  const brands =
    await db.vehicleBrand.findMany({
      orderBy: { name: 'asc' },
      select:
        vehicleCompatibilityTreeSelect,
    })

  return brands.map((brand) => ({
    ...brand,
    models: brand.models.map(
      (model) => ({
        ...model,
        generations:
          model.generations.map(
            (generation) => ({
              ...generation,
              configurations:
                generation.configurations.map(
                  (configuration) => ({
                    ...configuration,
                    powerKw: normalizePowerKw(
                      configuration.powerKw,
                    ),
                  }),
                ),
            }),
          ),
      }),
    ),
  }))
}
