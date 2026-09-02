import { z } from 'zod'

import { toSlug } from '../lib/slug'
import { prisma } from './db'

type VehicleModelRecord = {
  id: string
  brandId: string
  name: string
  slug: string
  description: string | null
}

type VehicleModelCreateData = {
  brandId: string
  name: string
  slug: string
  description: string | null
}

type VehicleModelUpdateData = Partial<
  VehicleModelCreateData
>

type VehicleModelWhereUnique =
  | {
      id: string
    }
  | {
      brandId_slug: {
        brandId: string
        slug: string
      }
    }

const vehicleModelSchema = z.object({
  brandId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((value) => toSlug(value))
    .pipe(z.string().min(1)),
  description: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
})

const vehicleModelUpdateSchema = z.object({
  brandId: z.string().trim().min(1).optional(),
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((value) => toSlug(value))
    .pipe(z.string().min(1))
    .optional(),
  description: z
    .string()
    .trim()
    .nullable()
    .optional(),
})

export interface VehicleModelClient {
  vehicleBrand: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  vehicleModel: {
    findMany(args: {
      where: { brandId: string }
      orderBy: { name: 'asc' }
    }): Promise<VehicleModelRecord[]>

    findUnique(args: {
      where: VehicleModelWhereUnique
    }): Promise<VehicleModelRecord | null>

    create(args: {
      data: VehicleModelCreateData
    }): Promise<VehicleModelRecord>

    update(args: {
      where: { id: string }
      data: VehicleModelUpdateData
    }): Promise<VehicleModelRecord>

    delete(args: {
      where: { id: string }
    }): Promise<VehicleModelRecord>
  }

  vehicleGeneration: {
    count(args: {
      where: { modelId: string }
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
  client?: VehicleModelClient,
): VehicleModelClient {
  return client ?? (prisma as unknown as VehicleModelClient)
}

function validateModelId(id: string) {
  if (!id.trim()) {
    throw new ValidationError(
      'ID do modelo de veículo é obrigatório',
    )
  }
}

function validateBrandId(brandId: string) {
  if (!brandId.trim()) {
    throw new ValidationError(
      'ID da marca de veículo é obrigatório',
    )
  }
}

function parseCreateInput(
  input: unknown,
): VehicleModelCreateData {
  const result = vehicleModelSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados do modelo de veículo inválidos',
    )
  }

  return result.data
}

function parseUpdateInput(
  input: unknown,
): VehicleModelUpdateData {
  const result =
    vehicleModelUpdateSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados do modelo de veículo inválidos',
    )
  }

  return result.data
}

export async function listVehicleModels(
  brandId: string,
  client?: VehicleModelClient,
) {
  validateBrandId(brandId)

  const db = getClient(client)

  const brand = await db.vehicleBrand.findUnique({
    where: { id: brandId },
  })

  if (!brand) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  return db.vehicleModel.findMany({
    where: { brandId },
    orderBy: { name: 'asc' },
  })
}

export async function getVehicleModelById(
  id: string,
  client?: VehicleModelClient,
) {
  validateModelId(id)

  const db = getClient(client)

  const vehicleModel =
    await db.vehicleModel.findUnique({
      where: { id },
    })

  if (!vehicleModel) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  return vehicleModel
}

export async function createVehicleModel(
  input: unknown,
  client?: VehicleModelClient,
) {
  const db = getClient(client)
  const data = parseCreateInput(input)

  const brand = await db.vehicleBrand.findUnique({
    where: { id: data.brandId },
  })

  if (!brand) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  const conflict =
    await db.vehicleModel.findUnique({
      where: {
        brandId_slug: {
          brandId: data.brandId,
          slug: data.slug,
        },
      },
    })

  if (conflict) {
    throw new ConflictError(
      'Já existe um modelo de veículo com este slug nessa marca',
    )
  }

  return db.vehicleModel.create({
    data,
  })
}

export async function updateVehicleModel(
  id: string,
  input: unknown,
  client?: VehicleModelClient,
) {
  validateModelId(id)

  const db = getClient(client)
  const data = parseUpdateInput(input)

  const existing =
    await db.vehicleModel.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  const finalBrandId =
    data.brandId ?? existing.brandId
  const finalSlug =
    data.slug ?? existing.slug

  if (
    data.brandId &&
    data.brandId !== existing.brandId
  ) {
    const brand =
      await db.vehicleBrand.findUnique({
        where: { id: data.brandId },
      })

    if (!brand) {
      throw new NotFoundError(
        'Marca de veículo não encontrada',
      )
    }
  }

  const conflict =
    await db.vehicleModel.findUnique({
      where: {
        brandId_slug: {
          brandId: finalBrandId,
          slug: finalSlug,
        },
      },
    })

  if (conflict && conflict.id !== id) {
    throw new ConflictError(
      'Já existe um modelo de veículo com este slug nessa marca',
    )
  }

  return db.vehicleModel.update({
    where: { id },
    data,
  })
}

export async function deleteVehicleModel(
  id: string,
  client?: VehicleModelClient,
) {
  validateModelId(id)

  const db = getClient(client)

  const existing =
    await db.vehicleModel.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  const generationsCount =
    await db.vehicleGeneration.count({
      where: { modelId: id },
    })

  if (generationsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar um modelo de veículo com gerações associadas',
    )
  }

  return db.vehicleModel.delete({
    where: { id },
  })
}