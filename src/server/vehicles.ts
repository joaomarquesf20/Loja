import type { PrismaClient } from '@prisma/client'

import { z } from 'zod'

import { prisma } from './db'

/**
 * Épico 8 — Vehicle Fitment & Compatibility Engine.
 *
 * Leituras públicas do motor de compatibilidade:
 * 1. Cascata de seleção make → model → spec (seletor da loja).
 * 2. Verificação de compatibilidade produto ↔ especificação
 *    (tabela ProductCompatibility) — badge da ficha de produto.
 * 3. Resolução de produtos compatíveis com uma especificação —
 *    alimenta a filtragem do catálogo.
 *
 * Convenções §13: cliente Prisma injetável (interface mínima via
 * Pick), erros de domínio exportados e validação Zod das entradas
 * antes das leituras. A compatibilidade é de NÍVEL DE PRODUTO: uma
 * linha em ProductCompatibility (par único produto/especificação).
 */

export type VehicleFitmentClient = Pick<
  PrismaClient,
  | 'vehicleMake'
  | 'vehicleModel'
  | 'vehicleSpec'
  | 'productCompatibility'
>

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

function getClient(
  client?: VehicleFitmentClient,
): VehicleFitmentClient {
  return client ??
    (prisma as unknown as VehicleFitmentClient)
}

export type VehicleMakeOption = {
  id: string
  name: string
  slug: string
}

export type VehicleModelOption = {
  id: string
  name: string
  slug: string
}

export type VehicleSpecOption = {
  id: string
  engine: string
  engineCode: string | null
  yearStart: number
  yearEnd: number | null
  fuelType: string
  powerHp: number | null
}

export type ProductCompatibilityStatus = {
  productId: string
  vehicleSpecId: string
  compatible: boolean
  notes: string | null
}

const VEHICLE_MAKE_ID_MESSAGE =
  'ID da marca de veículo é obrigatório'

const VEHICLE_MODEL_ID_MESSAGE =
  'ID do modelo de veículo é obrigatório'

const PRODUCT_ID_MESSAGE =
  'ID do produto é obrigatório'

const VEHICLE_SPEC_ID_MESSAGE =
  'ID da especificação de veículo é obrigatório'

const vehicleMakeIdSchema = z
  .string({ message: VEHICLE_MAKE_ID_MESSAGE })
  .trim()
  .min(1, { message: VEHICLE_MAKE_ID_MESSAGE })

const vehicleModelIdSchema = z
  .string({ message: VEHICLE_MODEL_ID_MESSAGE })
  .trim()
  .min(1, { message: VEHICLE_MODEL_ID_MESSAGE })

const productIdSchema = z
  .string({ message: PRODUCT_ID_MESSAGE })
  .trim()
  .min(1, { message: PRODUCT_ID_MESSAGE })

const vehicleSpecIdSchema = z
  .string({ message: VEHICLE_SPEC_ID_MESSAGE })
  .trim()
  .min(1, { message: VEHICLE_SPEC_ID_MESSAGE })

/**
 * Lista das marcas de veículos com dados de fitment, ordenada por
 * nome — primeiro nível do seletor da loja.
 */
export async function getVehicleMakes(
  client?: VehicleFitmentClient,
): Promise<VehicleMakeOption[]> {
  const db = getClient(client)

  return db.vehicleMake.findMany({
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })
}

/**
 * Modelos de uma marca, ordenados por nome — segundo nível do
 * seletor. Marca desconhecida → NotFoundError (404 na rota).
 */
export async function getVehicleModels(
  makeId: unknown,
  client?: VehicleFitmentClient,
): Promise<VehicleModelOption[]> {
  const parsedMakeId =
    vehicleMakeIdSchema.parse(makeId)

  const db = getClient(client)

  const make = await db.vehicleMake.findUnique({
    where: { id: parsedMakeId },
    select: { id: true },
  })

  if (!make) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  return db.vehicleModel.findMany({
    where: { makeId: parsedMakeId },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })
}

/**
 * Especificações (fitment) de um modelo, ordenadas por designação de
 * motor e ano inicial — terceiro nível do seletor. Modelo
 * desconhecido → NotFoundError (404 na rota).
 */
export async function getVehicleSpecs(
  modelId: unknown,
  client?: VehicleFitmentClient,
): Promise<VehicleSpecOption[]> {
  const parsedModelId =
    vehicleModelIdSchema.parse(modelId)

  const db = getClient(client)

  const model = await db.vehicleModel.findUnique({
    where: { id: parsedModelId },
    select: { id: true },
  })

  if (!model) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  return db.vehicleSpec.findMany({
    where: { modelId: parsedModelId },
    orderBy: [{ engine: 'asc' }, { yearStart: 'asc' }],
    select: {
      id: true,
      engine: true,
      engineCode: true,
      yearStart: true,
      yearEnd: true,
      fuelType: true,
      powerHp: true,
    },
  })
}

/**
 * Compatibilidade de um produto com uma especificação de veículo.
 * Par inexistente (produto ou especificação desconhecidos incluídos)
 * → `compatible: false` com `notes: null`; apenas entradas
 * malformadas lançam ZodError (400 na rota).
 */
export async function checkProductCompatibility(
  input: {
    productId?: unknown
    vehicleSpecId?: unknown
  },
  client?: VehicleFitmentClient,
): Promise<ProductCompatibilityStatus> {
  const parsed = z
    .object({
      productId: productIdSchema,
      vehicleSpecId: vehicleSpecIdSchema,
    })
    .parse(input)

  const db = getClient(client)

  const compatibility =
    await db.productCompatibility.findUnique({
      where: {
        productId_vehicleSpecId: {
          productId: parsed.productId,
          vehicleSpecId: parsed.vehicleSpecId,
        },
      },
      select: { notes: true },
    })

  return {
    productId: parsed.productId,
    vehicleSpecId: parsed.vehicleSpecId,
    compatible: compatibility !== null,
    notes: compatibility?.notes ?? null,
  }
}

/**
 * IDs dos produtos compatíveis com uma especificação de veículo —
 * alimenta a filtragem por veículo do catálogo. Especificação
 * desconhecida → lista vazia (nada é compatível).
 */
export async function getCompatibleProductIds(
  input: {
    vehicleSpecId?: unknown
  },
  client?: VehicleFitmentClient,
): Promise<string[]> {
  const parsed = z
    .object({
      vehicleSpecId: vehicleSpecIdSchema,
    })
    .parse(input)

  const db = getClient(client)

  const rows = await db.productCompatibility.findMany({
    where: { vehicleSpecId: parsed.vehicleSpecId },
    select: { productId: true },
    orderBy: [{ productId: 'asc' }],
  })

  return rows.map((row) => row.productId)
}
