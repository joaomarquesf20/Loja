import { prisma } from './db'
import {
  productSchema,
  productUpdateSchema,
} from '../lib/admin-validation'

type ProductRecord = {
  id: string
  categoryId: string
  productBrandId: string | null
  name: string
  slug: string
  sku: string
  description: string | null
  price: number
  stockQuantity: number
  isActive: boolean
}

type ProductCreateData = {
  name: string
  slug: string
  sku: string
  description?: string
  price: number
  stockQuantity: number
  categoryId: string
  productBrandId?: string | null
  isActive?: boolean
}

type ProductUpdateData = Partial<ProductCreateData>

export interface ProductClient {
  product: {
    findMany(args: {
      orderBy: { name: 'asc' }
    }): Promise<ProductRecord[]>

    findUnique(args: {
      where:
        | { id: string }
        | { slug: string }
        | { sku: string }
    }): Promise<ProductRecord | null>

    create(args: {
      data: ProductCreateData
    }): Promise<ProductRecord>

    update(args: {
      where: { id: string }
      data: ProductUpdateData
    }): Promise<ProductRecord>

    delete(args: {
      where: { id: string }
    }): Promise<ProductRecord>
  }

  category: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  productBrand: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  orderItem: {
    count(args: {
      where: { productId: string }
    }): Promise<number>
  }

  cartItem: {
    count(args: {
      where: { productId: string }
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

function getClient(client?: ProductClient): ProductClient {
  return client ?? (prisma as unknown as ProductClient)
}

function validateId(id: string) {
  if (!id.trim()) {
    throw new ValidationError('ID do produto é obrigatório')
  }
}

export async function listProducts(client?: ProductClient) {
  const db = getClient(client)

  return db.product.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getProductById(
  id: string,
  client?: ProductClient,
) {
  validateId(id)

  const db = getClient(client)

  const product = await db.product.findUnique({
    where: { id },
  })

  if (!product) {
    throw new NotFoundError('Produto não encontrado')
  }

  return product
}

export async function createProduct(
  input: unknown,
  client?: ProductClient,
) {
  const db = getClient(client)
  const data = productSchema.parse(input)

  const existingBySlug = await db.product.findUnique({
    where: { slug: data.slug },
  })

  if (existingBySlug) {
    throw new ConflictError(
      'Já existe um produto com este slug',
    )
  }

  const existingBySku = await db.product.findUnique({
    where: { sku: data.sku },
  })

  if (existingBySku) {
    throw new ConflictError(
      'Já existe um produto com este SKU',
    )
  }

  const categoryExists = await db.category.findUnique({
    where: { id: data.categoryId },
  })

  if (!categoryExists) {
    throw new ValidationError(
      'Categoria não encontrada para o ID fornecido',
    )
  }

  if (typeof data.productBrandId === 'string') {
    const brandExists = await db.productBrand.findUnique({
      where: { id: data.productBrandId },
    })

    if (!brandExists) {
      throw new ValidationError(
        'Marca não encontrada para o ID fornecido',
      )
    }
  }

  return db.product.create({
  data: {
    ...data,
    isActive: data.isActive ?? true,
  },
})
}

export async function updateProduct(
  id: string,
  input: unknown,
  client?: ProductClient,
) {
  validateId(id)

  const db = getClient(client)
  const data = productUpdateSchema.parse(input)

  const existing = await db.product.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError('Produto não encontrado')
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await db.product.findUnique({
      where: { slug: data.slug },
    })

    if (slugConflict && slugConflict.id !== id) {
      throw new ConflictError(
        'Já existe um produto com este slug',
      )
    }
  }

  if (data.sku && data.sku !== existing.sku) {
    const skuConflict = await db.product.findUnique({
      where: { sku: data.sku },
    })

    if (skuConflict && skuConflict.id !== id) {
      throw new ConflictError(
        'Já existe um produto com este SKU',
      )
    }
  }

  if (data.categoryId !== undefined) {
    const categoryExists = await db.category.findUnique({
      where: { id: data.categoryId },
    })

    if (!categoryExists) {
      throw new ValidationError(
        'Categoria não encontrada para o ID fornecido',
      )
    }
  }

  if (typeof data.productBrandId === 'string') {
    const brandExists = await db.productBrand.findUnique({
      where: { id: data.productBrandId },
    })

    if (!brandExists) {
      throw new ValidationError(
        'Marca não encontrada para o ID fornecido',
      )
    }
  }

  return db.product.update({
    where: { id },
    data,
  })
}

export async function deleteProduct(
  id: string,
  client?: ProductClient,
) {
  validateId(id)

  const db = getClient(client)

  const existing = await db.product.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError('Produto não encontrado')
  }

  const orderItemsCount = await db.orderItem.count({
    where: { productId: id },
  })

  if (orderItemsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar um produto com encomendas associadas',
    )
  }

  const cartItemsCount = await db.cartItem.count({
    where: { productId: id },
  })

  if (cartItemsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar um produto com carrinhos associados',
    )
  }

  return db.product.delete({
    where: { id },
  })
}