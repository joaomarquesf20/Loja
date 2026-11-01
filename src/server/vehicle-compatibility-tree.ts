import type {
  Prisma,
  PrismaClient,
} from '@prisma/client'

import { prisma } from './db'

/**
 * Épico 8 — árvore completa de veículos (Make → Model → Spec) para a
 * consola admin de compatibilidade e para o editor de produtos.
 * Uma única query com aninhamento ordenado por nome.
 */
const vehicleCompatibilityTreeSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  models: {
    orderBy: {
      name: 'asc' as const,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      specs: {
        orderBy: [
          { engine: 'asc' as const },
          { yearStart: 'asc' as const },
        ],
        select: {
          id: true,
          engine: true,
          engineCode: true,
          yearStart: true,
          yearEnd: true,
          fuelType: true,
          powerHp: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.VehicleMakeSelect

export type VehicleCompatibilityTree = Array<{
  id: string
  name: string
  slug: string
  createdAt: Date
  models: Array<{
    id: string
    name: string
    slug: string
    createdAt: Date
    specs: Array<{
      id: string
      engine: string
      engineCode: string | null
      yearStart: number
      yearEnd: number | null
      fuelType: string
      powerHp: number | null
      createdAt: Date
    }>
  }>
}>

export type VehicleCompatibilityTreeClient =
  Pick<PrismaClient, 'vehicleMake'>

function getClient(
  client?: VehicleCompatibilityTreeClient,
): VehicleCompatibilityTreeClient {
  return client ?? prisma
}

export async function listVehicleCompatibilityTree(
  client?: VehicleCompatibilityTreeClient,
): Promise<VehicleCompatibilityTree> {
  const db = getClient(client)

  return db.vehicleMake.findMany({
    orderBy: { name: 'asc' },
    select: vehicleCompatibilityTreeSelect,
  })
}
