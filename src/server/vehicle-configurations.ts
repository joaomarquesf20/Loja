import { z } from 'zod'

import { prisma } from './db'

type DecimalLike =
  | number
  | string
  | {
      toString(): string
    }

type VehicleConfigurationDbRecord = {
  id: string
  generationId: string
  name: string
  engineCode: string | null
  engineType: string | null
  displacementCc: number | null
  powerKw: DecimalLike | null
  bodyType: string | null
  yearFrom: number | null
  yearTo: number | null
}

export type VehicleConfigurationRecord = {
  id: string
  generationId: string
  name: string
  engineCode: string | null
  engineType: string | null
  displacementCc: number | null
  powerKw: number | null
  bodyType: string | null
  yearFrom: number | null
  yearTo: number | null
}

type VehicleConfigurationCreateData = {
  generationId: string
  name: string
  engineCode: string | null
  engineType: string | null
  displacementCc: number | null
  powerKw: number | null
  bodyType: string | null
  yearFrom: number | null
  yearTo: number | null
}

type VehicleConfigurationUpdateData =
  Partial<VehicleConfigurationCreateData>

const nullableString = z
  .string()
  .trim()
  .nullable()

const nullablePositiveInteger = z
  .number()
  .int()
  .positive()
  .nullable()

const nullablePositiveNumber = z
  .number()
  .finite()
  .positive()
  .nullable()

const vehicleConfigurationSchema = z.object({
  generationId: z
    .string()
    .trim()
    .min(1),

  name: z
    .string()
    .trim()
    .min(1)
    .max(120),

  engineCode: nullableString
    .optional()
    .transform(
      (value) => value ?? null,
    ),

  engineType: nullableString
    .optional()
    .transform(
      (value) => value ?? null,
    ),

  displacementCc:
    nullablePositiveInteger
      .optional()
      .transform(
        (value) => value ?? null,
      ),

  powerKw: nullablePositiveNumber
    .optional()
    .transform(
      (value) => value ?? null,
    ),

  bodyType: nullableString
    .optional()
    .transform(
      (value) => value ?? null,
    ),

  yearFrom: nullablePositiveInteger
    .optional()
    .transform(
      (value) => value ?? null,
    ),

  yearTo: nullablePositiveInteger
    .optional()
    .transform(
      (value) => value ?? null,
    ),
})

const vehicleConfigurationUpdateSchema =
  z.object({
    generationId: z
      .string()
      .trim()
      .min(1)
      .optional(),

    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional(),

    engineCode:
      nullableString.optional(),

    engineType:
      nullableString.optional(),

    displacementCc:
      nullablePositiveInteger.optional(),

    powerKw:
      nullablePositiveNumber.optional(),

    bodyType:
      nullableString.optional(),

    yearFrom:
      nullablePositiveInteger.optional(),

    yearTo:
      nullablePositiveInteger.optional(),
  })

export interface VehicleConfigurationClient {
  vehicleGeneration: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  vehicleConfiguration: {
    findMany(args: {
      where: { generationId: string }
      orderBy: { name: 'asc' }
    }): Promise<
      VehicleConfigurationDbRecord[]
    >

    findUnique(args: {
      where: { id: string }
    }): Promise<
      VehicleConfigurationDbRecord | null
    >

    create(args: {
      data: VehicleConfigurationCreateData
    }): Promise<VehicleConfigurationDbRecord>

    update(args: {
      where: { id: string }
      data: VehicleConfigurationUpdateData
    }): Promise<VehicleConfigurationDbRecord>

    delete(args: {
      where: { id: string }
    }): Promise<VehicleConfigurationDbRecord>
  }

  productVehicleCompatibility: {
    count(args: {
      where: {
        vehicleConfigurationId: string
      }
    }): Promise<number>
  }
}

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

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

function getClient(
  client?: VehicleConfigurationClient,
): VehicleConfigurationClient {
  return (
    client ??
    (prisma as unknown as VehicleConfigurationClient)
  )
}

function validateConfigurationId(
  id: string,
) {
  if (!id.trim()) {
    throw new ValidationError(
      'ID da configuração de veículo é obrigatório',
    )
  }
}

function validateGenerationId(
  generationId: string,
) {
  if (!generationId.trim()) {
    throw new ValidationError(
      'ID da geração de veículo é obrigatório',
    )
  }
}

function validateYearRange(
  yearFrom: number | null,
  yearTo: number | null,
) {
  if (
    yearFrom !== null &&
    yearTo !== null &&
    yearTo < yearFrom
  ) {
    throw new ValidationError(
      'O ano final não pode ser anterior ao ano inicial',
    )
  }
}

function parseCreateInput(
  input: unknown,
): VehicleConfigurationCreateData {
  const result =
    vehicleConfigurationSchema.safeParse(
      input,
    )

  if (!result.success) {
    throw new ValidationError(
      'Dados da configuração de veículo inválidos',
    )
  }

  validateYearRange(
    result.data.yearFrom,
    result.data.yearTo,
  )

  return result.data
}

function parseUpdateInput(
  input: unknown,
): VehicleConfigurationUpdateData {
  const result =
    vehicleConfigurationUpdateSchema.safeParse(
      input,
    )

  if (!result.success) {
    throw new ValidationError(
      'Dados da configuração de veículo inválidos',
    )
  }

  return result.data
}

function normalizePowerKw(
  value: DecimalLike | null,
): number | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'number') {
    return value
  }

  return Number(value.toString())
}

function normalizeRecord(
  record: VehicleConfigurationDbRecord,
): VehicleConfigurationRecord {
  return {
    ...record,
    powerKw: normalizePowerKw(
      record.powerKw,
    ),
  }
}

export async function listVehicleConfigurations(
  generationId: string,
  client?: VehicleConfigurationClient,
) {
  validateGenerationId(generationId)

  const db = getClient(client)

  const generation =
    await db.vehicleGeneration.findUnique({
      where: {
        id: generationId,
      },
    })

  if (!generation) {
    throw new NotFoundError(
      'Geração de veículo não encontrada',
    )
  }

  const configurations =
    await db.vehicleConfiguration.findMany({
      where: {
        generationId,
      },
      orderBy: {
        name: 'asc',
      },
    })

  return configurations.map(
    normalizeRecord,
  )
}

export async function getVehicleConfigurationById(
  id: string,
  client?: VehicleConfigurationClient,
) {
  validateConfigurationId(id)

  const db = getClient(client)

  const configuration =
    await db.vehicleConfiguration.findUnique({
      where: { id },
    })

  if (!configuration) {
    throw new NotFoundError(
      'Configuração de veículo não encontrada',
    )
  }

  return normalizeRecord(configuration)
}

export async function createVehicleConfiguration(
  input: unknown,
  client?: VehicleConfigurationClient,
) {
  const db = getClient(client)
  const data = parseCreateInput(input)

  const generation =
    await db.vehicleGeneration.findUnique({
      where: {
        id: data.generationId,
      },
    })

  if (!generation) {
    throw new NotFoundError(
      'Geração de veículo não encontrada',
    )
  }

  const configuration =
    await db.vehicleConfiguration.create({
      data,
    })

  return normalizeRecord(configuration)
}

export async function updateVehicleConfiguration(
  id: string,
  input: unknown,
  client?: VehicleConfigurationClient,
) {
  validateConfigurationId(id)

  const db = getClient(client)
  const data = parseUpdateInput(input)

  const existing =
    await db.vehicleConfiguration.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Configuração de veículo não encontrada',
    )
  }

  if (
    data.generationId !== undefined &&
    data.generationId !==
      existing.generationId
  ) {
    const generation =
      await db.vehicleGeneration.findUnique({
        where: {
          id: data.generationId,
        },
      })

    if (!generation) {
      throw new NotFoundError(
        'Geração de veículo não encontrada',
      )
    }
  }

  const finalYearFrom =
    data.yearFrom !== undefined
      ? data.yearFrom
      : existing.yearFrom

  const finalYearTo =
    data.yearTo !== undefined
      ? data.yearTo
      : existing.yearTo

  validateYearRange(
    finalYearFrom,
    finalYearTo,
  )

  const configuration =
    await db.vehicleConfiguration.update({
      where: { id },
      data,
    })

  return normalizeRecord(configuration)
}

export async function deleteVehicleConfiguration(
  id: string,
  client?: VehicleConfigurationClient,
) {
  validateConfigurationId(id)

  const db = getClient(client)

  const existing =
    await db.vehicleConfiguration.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Configuração de veículo não encontrada',
    )
  }

  const compatibilitiesCount =
    await db.productVehicleCompatibility.count({
      where: {
        vehicleConfigurationId: id,
      },
    })

  if (compatibilitiesCount > 0) {
    throw new ConflictError(
      'Não é possível apagar uma configuração de veículo com compatibilidades de produtos associadas',
    )
  }

  const configuration =
    await db.vehicleConfiguration.delete({
      where: { id },
    })

  return normalizeRecord(configuration)
}