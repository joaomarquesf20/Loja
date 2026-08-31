import { prisma } from './db'
import {
  categorySchema,
  categoryUpdateSchema,
} from '../lib/admin-validation'

type CategoryRecord = {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
}

type CategoryCreateData = {
  name: string
  slug: string
  description?: string
  parentId?: string | null
}

type CategoryUpdateData = Partial<CategoryCreateData>

export interface CategoryClient {
  category: {
    findMany(args: {
      orderBy: { name: 'asc' }
    }): Promise<CategoryRecord[]>

    findUnique(args: {
      where: { id: string } | { slug: string }
    }): Promise<CategoryRecord | null>

    create(args: {
      data: CategoryCreateData
    }): Promise<CategoryRecord>

    update(args: {
      where: { id: string }
      data: CategoryUpdateData
    }): Promise<CategoryRecord>

    delete(args: {
      where: { id: string }
    }): Promise<CategoryRecord>

    count(args: {
      where: { parentId: string }
    }): Promise<number>
  }

  product: {
    count(args: {
      where: { categoryId: string }
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

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

function getClient(client?: CategoryClient): CategoryClient {
  return client ?? (prisma as unknown as CategoryClient)
}

function validateId(id: string) {
  if (!id.trim()) {
    throw new ValidationError('ID da categoria é obrigatório')
  }
}

export async function listCategories(client?: CategoryClient) {
  const db = getClient(client)

  return db.category.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getCategoryById(
  id: string,
  client?: CategoryClient,
) {
  validateId(id)

  const db = getClient(client)

  const category = await db.category.findUnique({
    where: { id },
  })

  if (!category) {
    throw new NotFoundError('Categoria não encontrada')
  }

  return category
}

export async function createCategory(
  input: unknown,
  client?: CategoryClient,
) {
  const db = getClient(client)
  const data = categorySchema.parse(input)

  const existing = await db.category.findUnique({
    where: { slug: data.slug },
  })

  if (existing) {
    throw new ConflictError('Já existe uma categoria com este slug')
  }

  return db.category.create({
    data,
  })
}

export async function updateCategory(
  id: string,
  input: unknown,
  client?: CategoryClient,
) {
  validateId(id)

  const db = getClient(client)
  const data = categoryUpdateSchema.parse(input)

  const existing = await db.category.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError('Categoria não encontrada')
  }

  if (data.parentId === id) {
    throw new ForbiddenError(
      'Uma categoria não pode ser pai de si própria',
    )
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await db.category.findUnique({
      where: { slug: data.slug },
    })

    if (slugConflict && slugConflict.id !== id) {
      throw new ConflictError(
        'Já existe uma categoria com este slug',
      )
    }
  }

  return db.category.update({
    where: { id },
    data,
  })
}

export async function deleteCategory(
  id: string,
  client?: CategoryClient,
) {
  validateId(id)

  const db = getClient(client)

  const existing = await db.category.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError('Categoria não encontrada')
  }

  const childrenCount = await db.category.count({
    where: { parentId: id },
  })

  if (childrenCount > 0) {
    throw new ConflictError(
      'Não é possível apagar uma categoria com subcategorias',
    )
  }

  const productsCount = await db.product.count({
    where: { categoryId: id },
  })

  if (productsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar uma categoria com produtos associados',
    )
  }

  return db.category.delete({
    where: { id },
  })
}