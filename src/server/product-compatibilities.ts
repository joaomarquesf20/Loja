import { getCategoryFilterProfile } from '@/lib/storefront-category-profile'
import { prisma } from './db'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from './products'
import { productCompatibilitySchema } from '../lib/product-compatibility-validation'

/**
 * Épico 8 — compatibilidade de PRODUTO com especificações de veículo
 * (ProductCompatibility: productId + vehicleSpecId + notes, par
 * único). Substitui a ProductVehicleCompatibility do Épico 2, que
 * duplicava a hierarquia na própria linha.
 */

type ProductCompatibilityRecord = {
  id: string
  productId: string
  vehicleSpecId: string
  notes: string | null
  /** ISO string — serializado na fronteira do serviço. */
  createdAt: string
}

type ProductCompatibilityListRecord = ProductCompatibilityRecord & {
  vehicleSpec: {
    id: string
    engine: string
    engineCode: string | null
    yearStart: number
    yearEnd: number | null
    fuelType: string
    powerHp: number | null
    model: {
      id: string
      name: string
      slug: string
      make: {
        id: string
        name: string
        slug: string
      }
    }
  }
}

const compatibilityInclude = {
  vehicleSpec: {
    select: {
      id: true,
      engine: true,
      engineCode: true,
      yearStart: true,
      yearEnd: true,
      fuelType: true,
      powerHp: true,
      model: {
        select: {
          id: true,
          name: true,
          slug: true,
          make: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  },
} as const

export interface ProductCompatibilityClient {
  productCompatibility: {
    findMany(args: {
      where: { productId: string }
      include: typeof compatibilityInclude
      orderBy: { createdAt: 'asc' }[]
    }): Promise<ProductCompatibilityListRecord[]>

    findUnique(args: {
      where: {
        productId_vehicleSpecId: {
          productId: string
          vehicleSpecId: string
        }
      }
    }): Promise<{ id: string } | null>

    create(args: {
      data: {
        productId: string
        vehicleSpecId: string
        notes: string | null
      }
    }): Promise<ProductCompatibilityRecord>

    delete(args: {
      where: { id: string }
    }): Promise<ProductCompatibilityRecord>
  }

  product: {
    findUnique(args: {
      where: { id: string }
      select?: {
        category: {
          select: {
            name: true
            slug: true
          }
        }
      }
    }): Promise<{
      id: string
      category?: {
        name: string
        slug: string
      } | null
    } | null>
  }

  vehicleSpec: {
    findUnique(args: {
      where: { id: string }
      select: { id: true }
    }): Promise<{ id: string } | null>
  }
}

function getClient(
  client?: ProductCompatibilityClient,
): ProductCompatibilityClient {
  return client ?? (prisma as unknown as ProductCompatibilityClient)
}

function validateId(id: string) {
  if (!id.trim()) {
    throw new ValidationError('ID é obrigatório')
  }
}

/**
 * Lista as compatibilidades de um produto com a hierarquia veicular
 * incluída (make → model → spec) para o editor admin e a ficha de
 * produto na loja.
 */
export async function listProductCompatibilities(
  productId: string,
  client?: ProductCompatibilityClient,
) {
  validateId(productId)

  const db = getClient(client)

  const product = await db.product.findUnique({
    where: { id: productId },
  })

  if (!product) {
    throw new NotFoundError('Produto não encontrado')
  }

  return db.productCompatibility.findMany({
    where: { productId },
    include: compatibilityInclude,
    orderBy: [{ createdAt: 'asc' }],
  })
}

/**
 * Associa um produto a uma especificação de veículo. Produtos da
 * categoria Jantes (profile 'wheels') não usam compatibilidade
 * manual: a adequação é calculada a partir das especificações da
 * variante (furação, furo central, diâmetro, largura e offset).
 */
export async function addProductCompatibility(
  input: {
    productId?: unknown
    vehicleSpecId?: unknown
    notes?: unknown
  },
  client?: ProductCompatibilityClient,
) {
  const data = productCompatibilitySchema.parse(input)

  const db = getClient(client)

  const product = await db.product.findUnique({
    where: { id: data.productId },
    select: {
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  })

  if (!product) {
    throw new NotFoundError('Produto não encontrado')
  }

  if (
    product.category &&
    getCategoryFilterProfile(
      product.category,
    ) === 'wheels'
  ) {
    throw new ValidationError(
      'Jantes não usam compatibilidade por veículo: a adequação é calculada a partir das especificações da variante',
    )
  }

  const vehicleSpec =
    await db.vehicleSpec.findUnique({
      where: { id: data.vehicleSpecId },
      select: { id: true },
    })

  if (!vehicleSpec) {
    throw new NotFoundError(
      'Especificação de veículo não encontrada',
    )
  }

  const existing =
    await db.productCompatibility.findUnique({
      where: {
        productId_vehicleSpecId: {
          productId: data.productId,
          vehicleSpecId: data.vehicleSpecId,
        },
      },
    })

  if (existing) {
    throw new ConflictError(
      'Este produto já está associado a esta especificação de veículo',
    )
  }

  return db.productCompatibility.create({
    data: {
      productId: data.productId,
      vehicleSpecId: data.vehicleSpecId,
      notes: data.notes ?? null,
    },
  })
}

/**
 * Remove a associação produto ↔ especificação identificada pelo par
 * composto.
 */
export async function removeProductCompatibility(
  productId: string,
  vehicleSpecId: string,
  client?: ProductCompatibilityClient,
) {
  const data = productCompatibilitySchema
    .pick({
      productId: true,
      vehicleSpecId: true,
    })
    .parse({
      productId,
      vehicleSpecId,
    })

  const db = getClient(client)

  const existing =
    await db.productCompatibility.findUnique({
      where: {
        productId_vehicleSpecId: {
          productId: data.productId,
          vehicleSpecId: data.vehicleSpecId,
        },
      },
    })

  if (!existing) {
    throw new NotFoundError(
      'Associação de compatibilidade não encontrada',
    )
  }

  return db.productCompatibility.delete({
    where: { id: existing.id },
  })
}
