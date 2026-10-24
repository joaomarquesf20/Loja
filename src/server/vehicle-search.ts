import type {
  Prisma,
  PrismaClient,
} from '@prisma/client'

import { prisma } from './db'

/**
 * Epico 2 — Vehicle Search: leituras publicas da arvore
 * veicular e das variantes compativeis com uma
 * configuracao de veiculo (M2M
 * ProductVariantVehicleCompatibility).
 *
 * Convensov §13: cliente Prisma injetavel (interface
 * minima via Pick), erros de dominio exportados e
 * validacao antes das leituras.
 */

export type VehicleSearchClient =
  Pick<
    PrismaClient,
    | 'vehicleBrand'
    | 'vehicleModel'
    | 'vehicleGeneration'
    | 'vehicleConfiguration'
    | 'productVariantVehicleCompatibility'
  >

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

function getClient(
  client?: VehicleSearchClient,
): VehicleSearchClient {
  return client ??
    (prisma as unknown as VehicleSearchClient)
}

function validateSlug(
  value: string,
  message: string,
) {
  const slug = value.trim()

  if (!slug) {
    throw new ValidationError(message)
  }

  return slug
}

function validateConfigurationId(
  value: string,
) {
  const id = value.trim()

  if (!id) {
    throw new ValidationError(
      'ID da configuração do veículo é obrigatório',
    )
  }

  return id
}

export type VehicleMakeOption = {
  id: string
  name: string
  slug: string
}

export type VehicleModelOption = {
  id: string
  name: string
  slug: string
  description: string | null
}

export type VehicleConfigurationSummary = {
  id: string
  name: string
  engineCode: string | null
  engineType: string | null
  displacementCc: number | null
  powerKw: Prisma.Decimal | null
  bodyType: string | null
  yearFrom: number | null
  yearTo: number | null
}

export type VehicleGenerationWithConfigurations =
  {
    id: string
    name: string
    platform: string | null
    description: string | null
    configurations: VehicleConfigurationSummary[]
  }

export type CompatibleVehicleVariantSummary =
  Prisma.ProductVariantGetPayload<{
    select: typeof compatibleVariantSelect
  }>

const compatibleVariantSelect = {
  id: true,
  sku: true,
  price: true,
  stockQuantity: true,
  images: true,
  position: true,
  optionKey: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      defaultFinish: true,
    },
  },
} satisfies Prisma.ProductVariantSelect

/**
 * Marcas de veículo disponíveis (equivalente a "makes").
 */
export async function listVehicleMakes(
  client?: VehicleSearchClient,
): Promise<VehicleMakeOption[]> {
  const db = getClient(client)

  return db.vehicleBrand.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })
}

/**
 * Modelos de um "make" (marca), por slug da marca.
 * A marca é o passo que tem slug global (@unique);
 * os modelos só são únicos dentro da marca.
 */
export async function listVehicleModelOptions(
  makeSlug: string,
  client?: VehicleSearchClient,
): Promise<VehicleModelOption[]> {
  const slug = validateSlug(
    makeSlug,
    'Marca de veículo é obrigatória',
  )
  const db = getClient(client)

  const vehicleBrand =
    await db.vehicleBrand.findUnique({
      where: { slug },
      select: { id: true },
    })

  if (!vehicleBrand) {
    throw new NotFoundError(
      'Marca de veículo não encontrada',
    )
  }

  return db.vehicleModel.findMany({
    where: { brandId: vehicleBrand.id },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
    },
  })
}

/**
 * Gerações (com configurações) de um modelo, por slug
 * do modelo. `@@unique([brandId, slug])` não garante
 * unicidade global do slug do modelo — a pesquisa usa
 * findFirst ordenado por marca para ser determinística
 * se alguma marca repetir um slug.
 */
export async function listVehicleGenerationOptions(
  modelSlug: string,
  client?: VehicleSearchClient,
): Promise<VehicleGenerationWithConfigurations[]> {
  const slug = validateSlug(
    modelSlug,
    'Modelo de veículo é obrigatório',
  )
  const db = getClient(client)

  const vehicleModel =
    await db.vehicleModel.findFirst({
      where: { slug },
      orderBy: {
        brand: { name: 'asc' },
      },
      select: { id: true },
    })

  if (!vehicleModel) {
    throw new NotFoundError(
      'Modelo de veículo não encontrado',
    )
  }

  return db.vehicleGeneration.findMany({
    where: { modelId: vehicleModel.id },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      platform: true,
      description: true,
      configurations: {
        orderBy: { name: 'asc' },
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
    },
  })
}

/**
 * Variantes compatíveis com uma configuração de veículo
 * (ligações M2M ProductVariantVehicleCompatibility). Só
 * devolve variantes ativas de produtos ativos.
 */
export async function findCompatibleVariantsForVehicleConfiguration(
  configurationId: string,
  client?: VehicleSearchClient,
): Promise<CompatibleVehicleVariantSummary[]> {
  const id = validateConfigurationId(
    configurationId,
  )
  const db = getClient(client)

  const vehicleConfiguration =
    await db.vehicleConfiguration.findUnique({
      where: { id },
      select: { id: true },
    })

  if (!vehicleConfiguration) {
    throw new NotFoundError(
      'Configuração do veículo não encontrada',
    )
  }

  const links =
    await db.productVariantVehicleCompatibility.findMany(
      {
        where: {
          vehicleConfigurationId: id,
          variant: {
            isActive: true,
            product: {
              isActive: true,
            },
          },
        },
        orderBy: [
          {
            variant: {
              product: { name: 'asc' },
            },
          },
          {
            variant: { position: 'asc' },
          },
        ],
        select: {
          id: true,
          variant: {
            select: compatibleVariantSelect,
          },
        },
      },
    )

  return links.map((link) => link.variant)
}
