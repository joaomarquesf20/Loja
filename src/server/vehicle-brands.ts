import { z } from 'zod'

import { toSlug } from '../lib/slug'
import { prisma } from './db'

type VehicleBrandRecord = {
  id: string
  name: string
  slug: string
}

type VehicleBrandCreateData = {
  name: string
  slug: string
}

type VehicleBrandUpdateData = Partial<VehicleBrandCreateData>

const vehicleBrandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((value) => toSlug(value))
    .pipe(z.string().min(1)),
})

const vehicleBrandUpdateSchema =
  vehicleBrandSchema.partial()

export interface VehicleBrandClient {
  vehicleBrand: {
    findMany(args: {
      orderBy: { name: 'asc' }
    }): Promise<VehicleBrandRecord[]>

    findUnique(args: {
      where:
        | { id: string }
        | { slug: string }
        | { name: string }
    }): Promise<VehicleBrandRecord | null>

    create(args: {
      data: VehicleBrandCreateData
    }): Promise<VehicleBrandRecord>

    update(args: {
      where: { id: string }
      data: VehicleBrandUpdateData
    }): Promise<VehicleBrandRecord>

    delete(args: {
      where: { id: string }
    }): Promise<VehicleBrandRecord>
  }

  vehicleModel: {
    count(args: {
      where: { brandId: string }
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
  client?: VehicleBrandClient,
): VehicleBrandClient {
  return client ?? (prisma as unknown as VehicleBrandClient)
}

function validateId(id: string) {
  if (!id.trim()) {
    throw new ValidationError(
      'ID da marca de veículo é obrigatório',
    )
  }
}

function parseCreateInput(
  input: unknown,
): VehicleBrandCreateData {
  const result = vehicleBrandSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados da marca de veículo inválidos',
    )
  }

  return result.data
}

function parseUpdateInput(
  input: unknown,
): VehicleBrandUpdateData {
  const result = vehicleBrandUpdateSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados da marca de veículo inválidos',
    )
  }

  return result.data
}

export async function listVehicleBrands(
  client?: VehicleBrandClient,
) {
  const db = getClient(client)

  return db.vehicleBrand.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getVehicleBrandById(
  id: string,
  client?: VehicleBrandClient,
) {
  validateId(id)

  const db = getClient(client)

  const vehicleBrand = await db.vehicleBrand.findUnique({
    where: { id },
  })

  if (!vehicleBrand) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  return vehicleBrand
}

export async function createVehicleBrand(
  input: unknown,
  client?: VehicleBrandClient,
) {
  const db = getClient(client)
  const data = parseCreateInput(input)

  const existingByName = await db.vehicleBrand.findUnique({
    where: { name: data.name },
  })

  if (existingByName) {
    throw new ConflictError(
      'Já existe uma marca de veículo com este nome',
    )
  }

  const existingBySlug = await db.vehicleBrand.findUnique({
    where: { slug: data.slug },
  })

  if (existingBySlug) {
    throw new ConflictError(
      'Já existe uma marca de veículo com este slug',
    )
  }

  return db.vehicleBrand.create({
    data,
  })
}

export async function updateVehicleBrand(
  id: string,
  input: unknown,
  client?: VehicleBrandClient,
) {
  validateId(id)

  const db = getClient(client)
  const data = parseUpdateInput(input)

  const existing = await db.vehicleBrand.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  if (data.name && data.name !== existing.name) {
    const nameConflict = await db.vehicleBrand.findUnique({
      where: { name: data.name },
    })

    if (nameConflict && nameConflict.id !== id) {
      throw new ConflictError(
        'Já existe uma marca de veículo com este nome',
      )
    }
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await db.vehicleBrand.findUnique({
      where: { slug: data.slug },
    })

    if (slugConflict && slugConflict.id !== id) {
      throw new ConflictError(
        'Já existe uma marca de veículo com este slug',
      )
    }
  }

  return db.vehicleBrand.update({
    where: { id },
    data,
  })
}

export async function deleteVehicleBrand(
  id: string,
  client?: VehicleBrandClient,
) {
  validateId(id)

  const db = getClient(client)

  const existing = await db.vehicleBrand.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  const modelsCount = await db.vehicleModel.count({
    where: { brandId: id },
  })

  if (modelsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar uma marca de veículo com modelos associados',
    )
  }

  return db.vehicleBrand.delete({
    where: { id },
  })
}