import { z } from 'zod'

import { prisma } from './db'

type VehicleGenerationRecord = {
  id: string
  modelId: string
  name: string
  platform: string | null
  description: string | null
}

type VehicleGenerationCreateData = {
  modelId: string
  name: string
  platform: string | null
  description: string | null
}

type VehicleGenerationUpdateData =
  Partial<VehicleGenerationCreateData>

type VehicleGenerationWhereUnique =
  | {
      id: string
    }
  | {
      modelId_name: {
        modelId: string
        name: string
      }
    }

const vehicleGenerationSchema = z.object({
  modelId: z.string().trim().min(1),
  name: z
    .string()
    .trim()
    .min(1)
    .max(120),
  platform: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  description: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
})

const vehicleGenerationUpdateSchema = z.object({
  modelId: z
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
  platform: z
    .string()
    .trim()
    .nullable()
    .optional(),
  description: z
    .string()
    .trim()
    .nullable()
    .optional(),
})

export interface VehicleGenerationClient {
  vehicleModel: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  vehicleGeneration: {
    findMany(args: {
      where: { modelId: string }
      orderBy: { name: 'asc' }
    }): Promise<VehicleGenerationRecord[]>

    findUnique(args: {
      where: VehicleGenerationWhereUnique
    }): Promise<VehicleGenerationRecord | null>

    create(args: {
      data: VehicleGenerationCreateData
    }): Promise<VehicleGenerationRecord>

    update(args: {
      where: { id: string }
      data: VehicleGenerationUpdateData
    }): Promise<VehicleGenerationRecord>

    delete(args: {
      where: { id: string }
    }): Promise<VehicleGenerationRecord>
  }

  vehicleConfiguration: {
    count(args: {
      where: { generationId: string }
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
  client?: VehicleGenerationClient,
): VehicleGenerationClient {
  return (
    client ??
    (prisma as unknown as VehicleGenerationClient)
  )
}

function validateGenerationId(id: string) {
  if (!id.trim()) {
    throw new ValidationError(
      'ID da geração de veículo é obrigatório',
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
): VehicleGenerationCreateData {
  const result =
    vehicleGenerationSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados da geração de veículo inválidos',
    )
  }

  return result.data
}

function parseUpdateInput(
  input: unknown,
): VehicleGenerationUpdateData {
  const result =
    vehicleGenerationUpdateSchema.safeParse(
      input,
    )

  if (!result.success) {
    throw new ValidationError(
      'Dados da geração de veículo inválidos',
    )
  }

  return result.data
}

export async function listVehicleGenerations(
  modelId: string,
  client?: VehicleGenerationClient,
) {
  validateModelId(modelId)

  const db = getClient(client)

  const model =
    await db.vehicleModel.findUnique({
      where: { id: modelId },
    })

  if (!model) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  return db.vehicleGeneration.findMany({
    where: { modelId },
    orderBy: { name: 'asc' },
  })
}

export async function getVehicleGenerationById(
  id: string,
  client?: VehicleGenerationClient,
) {
  validateGenerationId(id)

  const db = getClient(client)

  const generation =
    await db.vehicleGeneration.findUnique({
      where: { id },
    })

  if (!generation) {
    throw new NotFoundError(
      'Geração de veículo não encontrada',
    )
  }

  return generation
}

export async function createVehicleGeneration(
  input: unknown,
  client?: VehicleGenerationClient,
) {
  const db = getClient(client)
  const data = parseCreateInput(input)

  const model =
    await db.vehicleModel.findUnique({
      where: { id: data.modelId },
    })

  if (!model) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  const conflict =
    await db.vehicleGeneration.findUnique({
      where: {
        modelId_name: {
          modelId: data.modelId,
          name: data.name,
        },
      },
    })

  if (conflict) {
    throw new ConflictError(
      'Já existe uma geração de veículo com este nome neste modelo',
    )
  }

  return db.vehicleGeneration.create({
    data,
  })
}

export async function updateVehicleGeneration(
  id: string,
  input: unknown,
  client?: VehicleGenerationClient,
) {
  validateGenerationId(id)

  const db = getClient(client)
  const data = parseUpdateInput(input)

  const existing =
    await db.vehicleGeneration.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Geração de veículo não encontrada',
    )
  }

  const finalModelId =
    data.modelId ?? existing.modelId
  const finalName =
    data.name ?? existing.name

  if (
    data.modelId &&
    data.modelId !== existing.modelId
  ) {
    const model =
      await db.vehicleModel.findUnique({
        where: { id: data.modelId },
      })

    if (!model) {
      throw new NotFoundError(
        'Modelo de veículo não encontrado',
      )
    }
  }

  const conflict =
    await db.vehicleGeneration.findUnique({
      where: {
        modelId_name: {
          modelId: finalModelId,
          name: finalName,
        },
      },
    })

  if (conflict && conflict.id !== id) {
    throw new ConflictError(
      'Já existe uma geração de veículo com este nome neste modelo',
    )
  }

  return db.vehicleGeneration.update({
    where: { id },
    data,
  })
}

export async function deleteVehicleGeneration(
  id: string,
  client?: VehicleGenerationClient,
) {
  validateGenerationId(id)

  const db = getClient(client)

  const existing =
    await db.vehicleGeneration.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Geração de veículo não encontrada',
    )
  }

  const configurationsCount =
    await db.vehicleConfiguration.count({
      where: {
        generationId: id,
      },
    })

  if (configurationsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar uma geração de veículo com configurações associadas',
    )
  }

  return db.vehicleGeneration.delete({
    where: { id },
  })
}