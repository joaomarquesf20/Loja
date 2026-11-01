import { z } from 'zod'

import { prisma } from './db'

/**
 * Épico 8 — CRUD admin de especificações de veículo (fitment).
 * Fusão do que no Épico 2 eram duas entidades (VehicleGeneration +
 * VehicleConfiguration) numa só: motor + código + intervalo de anos +
 * combustível + potência. A chave natural `[modelId, engine,
 * yearStart]` garante uma especificação única por motor/ano inicial.
 */

type VehicleSpecRecord = {
  id: string
  modelId: string
  engine: string
  engineCode: string | null
  yearStart: number
  yearEnd: number | null
  fuelType: string
  powerHp: number | null
  /** ISO string — serializado na fronteira do serviço. */
  createdAt: string
}

type VehicleSpecCreateData = {
  modelId: string
  engine: string
  engineCode: string | null
  yearStart: number
  yearEnd: number | null
  fuelType: string
  powerHp: number | null
}

type VehicleSpecUpdateData = Partial<VehicleSpecCreateData>

type VehicleSpecWhereUnique =
  | {
      id: string
    }
  | {
      modelId_engine_yearStart: {
        modelId: string
        engine: string
        yearStart: number
      }
    }

const YEAR_MIN = 1900
const YEAR_MAX = 2100

const YEAR_MESSAGE = `O ano deve estar entre ${YEAR_MIN} e ${YEAR_MAX}`

const POWER_MESSAGE =
  'A potência deve ser um número inteiro positivo'

/**
 * União null-or-int usada nos campos opcionais de especificação.
 * `z.null()` em primeiro lugar para o coerce não converter null em 0.
 */
const nullableIntUnion = (
  message: string,
  min: number,
  max: number,
) =>
  z.union([
    z.null(),
    z.coerce
      .number({ message })
      .int({ message })
      .min(min, { message })
      .max(max, { message }),
  ])

const vehicleSpecSchema = z.object({
  modelId: z.string().trim().min(1),
  engine: z.string().trim().min(1).max(120),
  engineCode: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  yearStart: z.coerce
    .number({ message: YEAR_MESSAGE })
    .int({ message: YEAR_MESSAGE })
    .min(YEAR_MIN, { message: YEAR_MESSAGE })
    .max(YEAR_MAX, { message: YEAR_MESSAGE }),
  yearEnd: nullableIntUnion(YEAR_MESSAGE, YEAR_MIN, YEAR_MAX)
    .optional()
    .transform((value) => value ?? null),
  fuelType: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase()),
  powerHp: nullableIntUnion(POWER_MESSAGE, 1, 2000)
    .optional()
    .transform((value) => value ?? null),
})

/**
 * Schema de atualização: os campos nulláveis PRESERVAM `undefined`
 * (campo ausente = manter o valor atual) e aceitam `null` explícito
 * (limpar). Só o `engineCode` vazio vira null.
 */
const vehicleSpecUpdateSchema = z.object({
  modelId: z.string().trim().min(1).optional(),
  engine: z.string().trim().min(1).max(120).optional(),
  engineCode: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : value
          ? value
          : null,
    ),
  yearStart: z.coerce
    .number({ message: YEAR_MESSAGE })
    .int({ message: YEAR_MESSAGE })
    .min(YEAR_MIN, { message: YEAR_MESSAGE })
    .max(YEAR_MAX, { message: YEAR_MESSAGE })
    .optional(),
  yearEnd: nullableIntUnion(
    YEAR_MESSAGE,
    YEAR_MIN,
    YEAR_MAX,
  ).optional(),
  fuelType: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase())
    .optional(),
  powerHp: nullableIntUnion(
    POWER_MESSAGE,
    1,
    2000,
  ).optional(),
})

export interface VehicleSpecClient {
  vehicleModel: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  vehicleSpec: {
    findMany(args: {
      where: { modelId: string }
      orderBy: Array<
        { engine: 'asc' | 'desc' } | { yearStart: 'asc' | 'desc' }
      >
    }): Promise<VehicleSpecRecord[]>

    findUnique(args: {
      where: VehicleSpecWhereUnique
    }): Promise<VehicleSpecRecord | null>

    create(args: {
      data: VehicleSpecCreateData
    }): Promise<VehicleSpecRecord>

    update(args: {
      where: { id: string }
      data: VehicleSpecUpdateData
    }): Promise<VehicleSpecRecord>

    delete(args: {
      where: { id: string }
    }): Promise<VehicleSpecRecord>
  }

  productCompatibility: {
    count(args: {
      where: { vehicleSpecId: string }
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
  client?: VehicleSpecClient,
): VehicleSpecClient {
  return client ?? (prisma as unknown as VehicleSpecClient)
}

function validateSpecId(id: string) {
  if (!id.trim()) {
    throw new ValidationError(
      'ID da especificação de veículo é obrigatório',
    )
  }
}

function validateModelId(modelId: string) {
  if (!modelId.trim()) {
    throw new ValidationError(
      'ID do modelo de veículo é obrigatório',
    )
  }
}

function parseCreateInput(
  input: unknown,
): VehicleSpecCreateData {
  const result = vehicleSpecSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados da especificação de veículo inválidos',
    )
  }

  const data = result.data

  if (
    data.yearEnd !== null &&
    data.yearEnd < data.yearStart
  ) {
    throw new ValidationError(
      'O ano final não pode ser anterior ao ano inicial',
    )
  }

  return data
}

function parseUpdateInput(
  input: unknown,
): VehicleSpecUpdateData {
  const result =
    vehicleSpecUpdateSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados da especificação de veículo inválidos',
    )
  }

  return result.data
}

export async function listVehicleSpecs(
  modelId: string,
  client?: VehicleSpecClient,
) {
  validateModelId(modelId)

  const db = getClient(client)

  const model = await db.vehicleModel.findUnique({
    where: { id: modelId },
  })

  if (!model) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  return db.vehicleSpec.findMany({
    where: { modelId },
    orderBy: [{ engine: 'asc' }, { yearStart: 'asc' }],
  })
}

export async function getVehicleSpecById(
  id: string,
  client?: VehicleSpecClient,
) {
  validateSpecId(id)

  const db = getClient(client)

  const vehicleSpec =
    await db.vehicleSpec.findUnique({
      where: { id },
    })

  if (!vehicleSpec) {
    throw new NotFoundError(
      'Especificação de veículo não encontrada',
    )
  }

  return vehicleSpec
}

export async function createVehicleSpec(
  input: unknown,
  client?: VehicleSpecClient,
) {
  const db = getClient(client)
  const data = parseCreateInput(input)

  const model = await db.vehicleModel.findUnique({
    where: { id: data.modelId },
  })

  if (!model) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  const conflict =
    await db.vehicleSpec.findUnique({
      where: {
        modelId_engine_yearStart: {
          modelId: data.modelId,
          engine: data.engine,
          yearStart: data.yearStart,
        },
      },
    })

  if (conflict) {
    throw new ConflictError(
      'Já existe uma especificação com este motor e ano inicial nesse modelo',
    )
  }

  return db.vehicleSpec.create({
    data,
  })
}

export async function updateVehicleSpec(
  id: string,
  input: unknown,
  client?: VehicleSpecClient,
) {
  validateSpecId(id)

  const db = getClient(client)
  const data = parseUpdateInput(input)

  const existing =
    await db.vehicleSpec.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Especificação de veículo não encontrada',
    )
  }

  const finalModelId =
    data.modelId ?? existing.modelId

  if (
    data.modelId &&
    data.modelId !== existing.modelId
  ) {
    const model = await db.vehicleModel.findUnique({
      where: { id: data.modelId },
    })

    if (!model) {
      throw new NotFoundError(
        'Modelo de veículo não encontrado',
      )
    }
  }

  const finalEngine = data.engine ?? existing.engine
  const finalYearStart =
    data.yearStart ?? existing.yearStart
  // `null` explícito limpa o ano final; ausente mantém o atual.
  const finalYearEnd =
    data.yearEnd === undefined
      ? existing.yearEnd
      : data.yearEnd

  if (
    finalYearEnd !== null &&
    finalYearEnd < finalYearStart
  ) {
    throw new ValidationError(
      'O ano final não pode ser anterior ao ano inicial',
    )
  }

  const conflict =
    await db.vehicleSpec.findUnique({
      where: {
        modelId_engine_yearStart: {
          modelId: finalModelId,
          engine: finalEngine,
          yearStart: finalYearStart,
        },
      },
    })

  if (conflict && conflict.id !== id) {
    throw new ConflictError(
      'Já existe uma especificação com este motor e ano inicial nesse modelo',
    )
  }

  return db.vehicleSpec.update({
    where: { id },
    data,
  })
}

export async function deleteVehicleSpec(
  id: string,
  client?: VehicleSpecClient,
) {
  validateSpecId(id)

  const db = getClient(client)

  const existing =
    await db.vehicleSpec.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Especificação de veículo não encontrada',
    )
  }

  const compatibilitiesCount =
    await db.productCompatibility.count({
      where: { vehicleSpecId: id },
    })

  if (compatibilitiesCount > 0) {
    throw new ConflictError(
      'Não é possível apagar uma especificação de veículo com compatibilidades associadas',
    )
  }

  return db.vehicleSpec.delete({
    where: { id },
  })
}
