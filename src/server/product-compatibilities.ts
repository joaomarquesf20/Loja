import { prisma } from './db'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from './products'
import { productCompatibilitySchema } from '../lib/product-compatibility-validation'

type DecimalLike =
  | number
  | string
  | {
      toString(): string
    }

type ProductVehicleCompatibilityRecord = {
  id: string
  productId: string
  vehicleConfigurationId: string | null
}

type ProductVehicleCompatibilityListRecord =
  ProductVehicleCompatibilityRecord & {
    vehicleBrand: {
      id: string
      name: string
    }
    vehicleModel: {
      id: string
      name: string
    }
    vehicleGeneration: {
      id: string
      name: string
    } | null
    vehicleConfiguration: {
      id: string
      name: string
      engineCode: string | null
      engineType: string | null
      displacementCc: number | null
      powerKw: DecimalLike | null
      bodyType: string | null
      yearFrom: number | null
      yearTo: number | null
    } | null
  }

type VehicleConfigurationHierarchyRecord = {
  id: string
  generation: {
    id: string
    model: {
      id: string
      brand: {
        id: string
      }
    }
  }
}

const compatibilityInclude = {
  vehicleBrand: {
    select: {
      id: true,
      name: true,
    },
  },
  vehicleModel: {
    select: {
      id: true,
      name: true,
    },
  },
  vehicleGeneration: {
    select: {
      id: true,
      name: true,
    },
  },
  vehicleConfiguration: {
    select: {
      id: true,
      name: true,
      engineCode: true,
      engineType: true,
      displacementCc: true,
      powerKw: true,
      bodyType: true,
      yearFrom: true,
      yearTo: true,
    },
  },
} as const

const vehicleConfigurationHierarchySelect = {
  id: true,
  generation: {
    select: {
      id: true,
      model: {
        select: {
          id: true,
          brand: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  },
} as const

export interface ProductCompatibilityClient {
  productVehicleCompatibility: {
    findMany(args: {
      where: { productId: string }
      include: typeof compatibilityInclude
    }): Promise<ProductVehicleCompatibilityListRecord[]>

    findFirst(args: {
      where: {
        productId: string
        vehicleConfigurationId: string
      }
    }): Promise<ProductVehicleCompatibilityRecord | null>

    create(args: {
      data: {
        productId: string
        vehicleBrandId: string
        vehicleModelId: string
        vehicleGenerationId: string
        vehicleConfigurationId: string
      }
    }): Promise<ProductVehicleCompatibilityRecord>

    delete(args: {
      where: { id: string }
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
      select: typeof vehicleConfigurationHierarchySelect
    }): Promise<VehicleConfigurationHierarchyRecord | null>
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

function normalizePowerKw(value: DecimalLike | null) {
  if (value === null) {
    return null
  }

  return Number(value.toString())
}

function normalizeCompatibility(
  record: ProductVehicleCompatibilityListRecord,
) {
  return {
    ...record,
    vehicleConfiguration:
      record.vehicleConfiguration === null
        ? null
        : {
            ...record.vehicleConfiguration,
            powerKw: normalizePowerKw(
              record.vehicleConfiguration.powerKw,
            ),
          },
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

  const compatibilities =
    await db.productVehicleCompatibility.findMany({
      where: { productId },
      include: compatibilityInclude,
    })

  return compatibilities.map(normalizeCompatibility)
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
      select: vehicleConfigurationHierarchySelect,
    })

  if (!vehicleConfiguration) {
    throw new NotFoundError(
      'Configuração do veículo não encontrada',
    )
  }

  const existing =
    await db.productVehicleCompatibility.findFirst({
      where: {
        productId: data.productId,
        vehicleConfigurationId:
          data.vehicleConfigurationId,
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
      vehicleBrandId:
        vehicleConfiguration.generation.model.brand.id,
      vehicleModelId:
        vehicleConfiguration.generation.model.id,
      vehicleGenerationId:
        vehicleConfiguration.generation.id,
      vehicleConfigurationId:
        vehicleConfiguration.id,
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
    await db.productVehicleCompatibility.findFirst({
      where: {
        productId: data.productId,
        vehicleConfigurationId:
          data.vehicleConfigurationId,
      },
    })

  if (!existing) {
    throw new NotFoundError(
      'Associação de compatibilidade não encontrada',
    )
  }

  return db.productVehicleCompatibility.delete({
    where: { id: existing.id },
  })
}