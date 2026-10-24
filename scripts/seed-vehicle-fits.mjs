import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Seed de TESTE do Epic 2 (Vehicle Search): veículos de referência
 * + ligações variante↔configuração (ProductVariantVehicleCompatibility).
 *
 * - Idempotente: todos os upserts usam chaves únicas reais
 *   (brand slug, brandId+slug, modelId+name, M2M composto).
 * - Reutiliza dados existentes: a marca BMW e o modelo "Série 1"
 *   (slug serie-1) já existem na BD — só a geração F20 é criada.
 * - NÃO apaga nada (sem "clear"): as ligações M2M só se acrescentam
 *   (o par variante↔configuração é único e fica estável).
 *
 * Uso: node --env-file=.env scripts/seed-vehicle-fits.mjs
 */

const connectionString =
  process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL não definida',
  )
}

const adapter = new PrismaPg({
  connectionString,
})

const prisma = new PrismaClient({
  adapter,
})

// Veículos de teste do Epic 2.
// Opel Corsa B: o 1.5 TD tem dois códigos de motor usados em
// catálogos (X15DT e a designação de família 4EC1-T); o schema guarda
// um código por configuração, por isso entram como duas
// configurações irmãs — assim as consultas continuam a encontrar os
// motores por igualdade em engineCode.
const testVehicles = [
  {
    brand: { name: 'Opel', slug: 'opel' },
    model: {
      name: 'Corsa B',
      slug: 'corsa-b',
    },
    generation: {
      name: '1993-2000',
      platform: 'GM Gamma',
    },
    configurations: [
      {
        name: '1.5 TD Sport',
        engineCode: 'X15DT',
        engineType: 'Diesel',
        displacementCc: 1488,
        powerKw: '50',
        bodyType: '3-door hatchback',
        yearFrom: 1994,
        yearTo: 2000,
      },
      {
        name: '1.5 TD',
        engineCode: '4EC1-T',
        engineType: 'Diesel',
        displacementCc: 1488,
        powerKw: '50',
        bodyType: '3-door hatchback',
        yearFrom: 1994,
        yearTo: 2000,
      },
    ],
  },
  {
    brand: { name: 'BMW', slug: 'bmw' },
    model: {
      name: 'Série 1',
      slug: 'serie-1',
    },
    generation: {
      name: 'F20',
      platform: null,
    },
    configurations: [
      {
        name: '116d',
        engineCode: 'N47D20C1',
        engineType: 'Diesel',
        displacementCc: 1995,
        powerKw: '85',
        bodyType: '5-door hatchback',
        yearFrom: 2011,
        yearTo: 2015,
      },
    ],
  },
]

// Ligações variante↔configuração para testes:
// - o difusor BMW real (BM-2-44-MPACK-SD1G) fica ligado ao 116d F20;
// - a variante "bicos" fica ligada ao 1.5 TD Sport da Corsa B.
const compatibilityLinks = [
  {
    variantSku: 'BM-2-44-MPACK-SD1G',
    // Marca BMW pré-existente: criada pelo dev seed com slug dev-bmw.
    brandSlug: 'dev-bmw',
    generationName: 'F20',
    configurationName: '116d',
  },
  {
    variantSku: 'bicos',
    brandSlug: 'opel',
    generationName: '1993-2000',
    configurationName: '1.5 TD Sport',
  },
]

async function upsertVehicleBrand(
  definition,
) {
  // Marcas "raciais" já podem existir criadas pelo administrador
  // (VehicleBrand.name é @unique): reutilizar nesse caso.
  const existingByName =
    await prisma.vehicleBrand.findUnique({
      where: {
        name: definition.name,
      },
    })

  if (existingByName) {
    return existingByName
  }

  return prisma.vehicleBrand.upsert({
    where: {
      slug: definition.slug,
    },
    update: {
      name: definition.name,
    },
    create: {
      name: definition.name,
      slug: definition.slug,
    },
  })
}

async function upsertVehicleModel(
  vehicleBrand,
  definition,
) {
  return prisma.vehicleModel.upsert({
    where: {
      brandId_slug: {
        brandId: vehicleBrand.id,
        slug: definition.slug,
      },
    },
    update: {
      name: definition.name,
    },
    create: {
      name: definition.name,
      slug: definition.slug,
      brandId: vehicleBrand.id,
    },
  })
}

async function upsertVehicleGeneration(
  vehicleModel,
  definition,
) {
  return prisma.vehicleGeneration.upsert({
    where: {
      modelId_name: {
        modelId: vehicleModel.id,
        name: definition.name,
      },
    },
    update: {
      platform: definition.platform,
    },
    create: {
      name: definition.name,
      platform: definition.platform,
      modelId: vehicleModel.id,
    },
  })
}

async function upsertVehicleConfiguration(
  vehicleGeneration,
  definition,
) {
  const existing =
    await prisma.vehicleConfiguration.findFirst(
      {
        where: {
          generationId:
            vehicleGeneration.id,
          name: definition.name,
        },
      },
    )

  if (existing) {
    return existing
  }

  return prisma.vehicleConfiguration.create({
    data: {
      generationId: vehicleGeneration.id,
      name: definition.name,
      engineCode: definition.engineCode,
      engineType: definition.engineType,
      displacementCc:
        definition.displacementCc,
      powerKw: definition.powerKw,
      bodyType: definition.bodyType,
      yearFrom: definition.yearFrom,
      yearTo: definition.yearTo,
    },
  })
}

async function linkVariantToConfiguration(
  link,
) {
  const variant =
    await prisma.productVariant.findUnique({
      where: {
        sku: link.variantSku,
      },
    })

  if (!variant) {
    throw new Error(
      `Variante "${link.variantSku}" não existe na BD — sem ela não é possível ligar a configuração "${link.configurationName}"`,
    )
  }

  const configuration =
    await prisma.vehicleConfiguration.findFirst(
      {
        where: {
          name: link.configurationName,
          generation: {
            name: link.generationName,
            model: {
              brand: {
                slug: link.brandSlug,
              },
            },
          },
        },
      },
    )

  if (!configuration) {
    throw new Error(
      `Configuração "${link.configurationName}" (${link.generationName}, ${link.brandSlug}) não existe — corre o seed outra vez após verificar o veículo`,
    )
  }

  await prisma.productVariantVehicleCompatibility.upsert(
    {
      where: {
        productVariantId_vehicleConfigurationId:
          {
            productVariantId: variant.id,
            vehicleConfigurationId:
              configuration.id,
          },
      },
      update: {},
      create: {
        productVariantId: variant.id,
        vehicleConfigurationId:
          configuration.id,
      },
    },
  )

  console.log(
    `Ligação: ${variant.sku} → ${link.brandSlug} / ${link.generationName} / ${link.configurationName}`,
  )
}

async function main() {
  for (const vehicle of testVehicles) {
    const vehicleBrand =
      await upsertVehicleBrand(
        vehicle.brand,
      )

    const vehicleModel =
      await upsertVehicleModel(
        vehicleBrand,
        vehicle.model,
      )

    const vehicleGeneration =
      await upsertVehicleGeneration(
        vehicleModel,
        vehicle.generation,
      )

    for (const configuration of vehicle.configurations) {
      await upsertVehicleConfiguration(
        vehicleGeneration,
        configuration,
      )
    }

    console.log(
      `Veículo: ${vehicleBrand.name} / ${vehicleModel.name} / ${vehicleGeneration.name} (${vehicle.configurations.length} configurações)`,
    )
  }

  for (const link of compatibilityLinks) {
    await linkVariantToConfiguration(
      link,
    )
  }

  const linked =
    await prisma.productVariantVehicleCompatibility.findMany(
      {
        include: {
          variant: {
            include: {
              product: {
                select: { name: true },
              },
            },
          },
          vehicleConfiguration: {
            include: {
              generation: {
                include: {
                  model: {
                    include: {
                      brand: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    )

  console.log(
    `Ligações variante↔configuração na BD (${linked.length}):`,
  )

  for (const link of linked) {
    console.log(
      `  ${link.variant.sku} (${link.variant.product.name}) → ${link.vehicleConfiguration.generation.model.brand.name} ${link.vehicleConfiguration.generation.model.name} ${link.vehicleConfiguration.generation.name} / ${link.vehicleConfiguration.name}`,
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
