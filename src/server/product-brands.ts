import { prisma } from './db'
import {
  productBrandSchema,
  productBrandUpdateSchema,
} from '../lib/admin-validation'

type ProductBrandRecord = {
  id: string
  name: string
  slug: string
}

type ProductBrandCreateData = {
  name: string
  slug: string
}

type ProductBrandUpdateData = Partial<ProductBrandCreateData>

export interface ProductBrandClient {
  productBrand: {
    findMany(args: {
      orderBy: { name: 'asc' }
    }): Promise<ProductBrandRecord[]>

    findUnique(args: {
      where: { id: string } | { slug: string }
    }): Promise<ProductBrandRecord | null>

    create(args: {
      data: ProductBrandCreateData
    }): Promise<ProductBrandRecord>

    update(args: {
      where: { id: string }
      data: ProductBrandUpdateData
    }): Promise<ProductBrandRecord>

    delete(args: {
      where: { id: string }
    }): Promise<ProductBrandRecord>
  }

  product: {
    count(args: {
      where: { productBrandId: string }
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

function getClient(client?: ProductBrandClient): ProductBrandClient {
  return client ?? (prisma as unknown as ProductBrandClient)
}

function validateId(id: string) {
  if (!id.trim()) {
    throw new ValidationError('ID da marca é obrigatório')
  }
}

export async function listProductBrands(client?: ProductBrandClient) {
  const db = getClient(client)

  return db.productBrand.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getProductBrandById(
  id: string,
  client?: ProductBrandClient,
) {
  validateId(id)

  const db = getClient(client)

  const productBrand = await db.productBrand.findUnique({
    where: { id },
  })

  if (!productBrand) {
    throw new NotFoundError('Marca não encontrada')
  }

  return productBrand
}

export async function createProductBrand(
  input: unknown,
  client?: ProductBrandClient,
) {
  const db = getClient(client)
  const data = productBrandSchema.parse(input)

  const existing = await db.productBrand.findUnique({
    where: { slug: data.slug },
  })

  if (existing) {
    throw new ConflictError('Já existe uma marca com este slug')
  }

  return db.productBrand.create({
    data,
  })
}

export async function updateProductBrand(
  id: string,
  input: unknown,
  client?: ProductBrandClient,
) {
  validateId(id)

  const db = getClient(client)
  const data = productBrandUpdateSchema.parse(input)

  const existing = await db.productBrand.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError('Marca não encontrada')
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await db.productBrand.findUnique({
      where: { slug: data.slug },
    })

    if (slugConflict && slugConflict.id !== id) {
      throw new ConflictError(
        'Já existe uma marca com este slug',
      )
    }
  }

  return db.productBrand.update({
    where: { id },
    data,
  })
}

export async function deleteProductBrand(
  id: string,
  client?: ProductBrandClient,
) {
  validateId(id)

  const db = getClient(client)

  const existing = await db.productBrand.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError('Marca não encontrada')
  }

  const productsCount = await db.product.count({
    where: { productBrandId: id },
  })

  if (productsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar uma marca com produtos associados',
    )
  }

  return db.productBrand.delete({
    where: { id },
  })
}
