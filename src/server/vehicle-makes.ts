import { z } from 'zod'

import { toSlug } from '../lib/slug'
import { prisma } from './db'

type VehicleMakeRecord = {
  id: string
  name: string
  slug: string
  /** ISO string — serializado na fronteira do serviço. */
  createdAt: string
}

type VehicleMakeCreateData = {
  name: string
  slug: string
}

type VehicleMakeUpdateData = Partial<VehicleMakeCreateData>

const vehicleMakeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((value) => toSlug(value))
    .pipe(z.string().min(1)),
})

const vehicleMakeUpdateSchema =
  vehicleMakeSchema.partial()

export interface VehicleMakeClient {
  vehicleMake: {
    findMany(args: {
      orderBy: { name: 'asc' }
    }): Promise<VehicleMakeRecord[]>

    findUnique(args: {
      where:
        | { id: string }
        | { slug: string }
        | { name: string }
    }): Promise<VehicleMakeRecord | null>

    create(args: {
      data: VehicleMakeCreateData
    }): Promise<VehicleMakeRecord>

    update(args: {
      where: { id: string }
      data: VehicleMakeUpdateData
    }): Promise<VehicleMakeRecord>

    delete(args: {
      where: { id: string }
    }): Promise<VehicleMakeRecord>
  }

  vehicleModel: {
    count(args: {
      where: { makeId: string }
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
  client?: VehicleMakeClient,
): VehicleMakeClient {
  return client ?? (prisma as unknown as VehicleMakeClient)
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
): VehicleMakeCreateData {
  const result = vehicleMakeSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados da marca de veículo inválidos',
    )
  }

  return result.data
}

function parseUpdateInput(
  input: unknown,
): VehicleMakeUpdateData {
  const result = vehicleMakeUpdateSchema.safeParse(input)

  if (!result.success) {
    throw new ValidationError(
      'Dados da marca de veículo inválidos',
    )
  }

  return result.data
}

export async function listVehicleMakes(
  client?: VehicleMakeClient,
) {
  const db = getClient(client)

  return db.vehicleMake.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getVehicleMakeById(
  id: string,
  client?: VehicleMakeClient,
) {
  validateId(id)

  const db = getClient(client)

  const vehicleMake = await db.vehicleMake.findUnique({
    where: { id },
  })

  if (!vehicleMake) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  return vehicleMake
}

export async function createVehicleMake(
  input: unknown,
  client?: VehicleMakeClient,
) {
  const db = getClient(client)
  const data = parseCreateInput(input)

  const existingByName = await db.vehicleMake.findUnique({
    where: { name: data.name },
  })

  if (existingByName) {
    throw new ConflictError(
      'Já existe uma marca de veículo com este nome',
    )
  }

  const existingBySlug = await db.vehicleMake.findUnique({
    where: { slug: data.slug },
  })

  if (existingBySlug) {
    throw new ConflictError(
      'Já existe uma marca de veículo com este slug',
    )
  }

  return db.vehicleMake.create({
    data,
  })
}

export async function updateVehicleMake(
  id: string,
  input: unknown,
  client?: VehicleMakeClient,
) {
  validateId(id)

  const db = getClient(client)
  const data = parseUpdateInput(input)

  const existing = await db.vehicleMake.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  if (data.name && data.name !== existing.name) {
    const nameConflict = await db.vehicleMake.findUnique({
      where: { name: data.name },
    })

    if (nameConflict && nameConflict.id !== id) {
      throw new ConflictError(
        'Já existe uma marca de veículo com este nome',
      )
    }
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await db.vehicleMake.findUnique({
      where: { slug: data.slug },
    })

    if (slugConflict && slugConflict.id !== id) {
      throw new ConflictError(
        'Já existe uma marca de veículo com este slug',
      )
    }
  }

  return db.vehicleMake.update({
    where: { id },
    data,
  })
}

export async function deleteVehicleMake(
  id: string,
  client?: VehicleMakeClient,
) {
  validateId(id)

  const db = getClient(client)

  const existing = await db.vehicleMake.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  const modelsCount = await db.vehicleModel.count({
    where: { makeId: id },
  })

  if (modelsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar uma marca de veículo com modelos associados',
    )
  }

  return db.vehicleMake.delete({
    where: { id },
  })
}
