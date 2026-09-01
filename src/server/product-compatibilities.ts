import { prisma } from './db'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from './products'
import { productCompatibilitySchema } from '../lib/product-compatibility-validation'

type ProductVehicleCompatibilityRecord = {
  id: string
  productId: string
  vehicleConfigurationId: string
}

type CompatibilityWhereUnique =
  | { id: string }
  | {
      productId_vehicleConfigurationId: {
        productId: string
        vehicleConfigurationId: string
      }
    }

export interface ProductCompatibilityClient {
  productVehicleCompatibility: {
    findMany(args: {
      where: { productId: string }
    }): Promise<ProductVehicleCompatibilityRecord[]>

    findUnique(args: {
      where: CompatibilityWhereUnique
    }): Promise<ProductVehicleCompatibilityRecord | null>

    create(args: {
      data: {
        productId: string
        vehicleConfigurationId: string
      }
    }): Promise<ProductVehicleCompatibilityRecord>

    delete(args: {
      where: {
        productId_vehicleConfigurationId: {
          productId: string
          vehicleConfigurationId: string
        }
      }
    }): Promise<ProductVehicleCompatibilityRecord>
  }

  product: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  vehicleConfiguration: {
    findUnique(args: {
      where: { id: string }
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

  return db.productVehicleCompatibility.findMany({
    where: { productId },
  })
}

export async function addProductCompatibility(
  productId: string,
  vehicleConfigurationId: string,
  client?: ProductCompatibilityClient,
) {
  const data = productCompatibilitySchema.parse({
    productId,
    vehicleConfigurationId,
  })

  const db = getClient(client)

  const product = await db.product.findUnique({
    where: { id: data.productId },
  })

  if (!product) {
    throw new NotFoundError('Produto não encontrado')
  }

  const vehicleConfiguration =
    await db.vehicleConfiguration.findUnique({
      where: { id: data.vehicleConfigurationId },
    })

  if (!vehicleConfiguration) {
    throw new NotFoundError(
      'Configuração do veículo não encontrada',
    )
  }

  const existing =
    await db.productVehicleCompatibility.findUnique({
      where: {
        productId_vehicleConfigurationId: {
          productId: data.productId,
          vehicleConfigurationId:
            data.vehicleConfigurationId,
        },
      },
    })

  if (existing) {
    throw new ConflictError(
      'Este produto já está associado a esta configuração de veículo',
    )
  }

  return db.productVehicleCompatibility.create({
    data: {
      productId: data.productId,
      vehicleConfigurationId:
        data.vehicleConfigurationId,
    },
  })
}

export async function removeProductCompatibility(
  productId: string,
  vehicleConfigurationId: string,
  client?: ProductCompatibilityClient,
) {
  const data = productCompatibilitySchema.parse({
    productId,
    vehicleConfigurationId,
  })

  const db = getClient(client)

  const existing =
    await db.productVehicleCompatibility.findUnique({
      where: {
        productId_vehicleConfigurationId: {
          productId: data.productId,
          vehicleConfigurationId:
            data.vehicleConfigurationId,
        },
      },
    })

  if (!existing) {
    throw new NotFoundError(
      'Associação de compatibilidade não encontrada',
    )
  }

  return db.productVehicleCompatibility.delete({
    where: {
      productId_vehicleConfigurationId: {
        productId: data.productId,
        vehicleConfigurationId:
          data.vehicleConfigurationId,
      },
    },
  })
}