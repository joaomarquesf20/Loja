import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Seed de TESTE do Épico 8 (Vehicle Fitment): veículos de
 * referência (make/model/spec) + compatibilidades ao nível do
 * PRODUTO (ProductCompatibility).
 *
 * - Idempotente: todos os upserts usam chaves únicas reais
 *   (make slug, makeId+slug do modelo, chave natural
 *   [modelId, engine, yearStart] da spec, par composto
 *   [productId, vehicleSpecId] da compatibilidade).
 * - Reutiliza dados existentes: as marcas/makes "Opel" e "BMW"
 *   já podem existir (name é @unique) — só se cria o que falta.
 * - NÃO apaga nada: compatibilidades só se acrescentam.
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

// Veículos de teste do Épico 8.
// Opel Corsa B: o 1.5 TD tem dois códigos de motor usados em
// catálogos (X15DT e a designação de família 4EC1-T); a spec guarda
// um código por especificação, por isso entram como duas specs
// irmãs — assim as consultas continuam a encontrar os motores por
// igualdade em engineCode.
// Potência: o catálogo declara cv (powerHp) — 50 kW ≈ 68 cv.
const testVehicles = [
  {
    make: { name: 'Opel', slug: 'opel' },
    model: {
      name: 'Corsa B',
      slug: 'corsa-b',
    },
    specs: [
      {
        engine: '1.5 TD Sport',
        engineCode: 'X15DT',
        fuelType: 'DIESEL',
        powerHp: 68,
        yearStart: 1994,
        yearEnd: 2000,
      },
      {
        engine: '1.5 TD',
        engineCode: '4EC1-T',
        fuelType: 'DIESEL',
        powerHp: 68,
        yearStart: 1994,
        yearEnd: 2000,
      },
    ],
  },
  {
    make: { name: 'BMW', slug: 'bmw' },
    model: {
      name: 'Série 1',
      slug: 'serie-1',
    },
    specs: [
      {
        engine: '116d',
        engineCode: 'N47D20C1',
        fuelType: 'DIESEL',
        powerHp: 116,
        yearStart: 2011,
        yearEnd: 2015,
      },
    ],
  },
]

// Compatibilidades produto↔especificação para testes:
// - o produto do difusor BMW real (BM-2-44-MPACK-SD1G) fica
//   compatível com o 116d (Série 1 F20);
// - o produto dos "bicos" fica compatível com o 1.5 TD Sport
//   da Corsa B.
// A compatibilidade é do PRODUTO: resolve-se o produto através
// da variante declarada.
const compatibilityLinks = [
  {
    variantSku: 'BM-2-44-MPACK-SD1G',
    // Marca BMW pré-existente: criada pelo dev seed com slug
    // dev-bmw (VehicleMake.name é @unique — a seed reutiliza-a).
    makeSlug: 'dev-bmw',
    modelSlug: 'serie-1',
    specEngine: '116d',
    note: 'Ajuste direto na Série 1 (F20)',
  },
  {
    variantSku: 'bicos',
    makeSlug: 'opel',
    modelSlug: 'corsa-b',
    specEngine: '1.5 TD Sport',
    note: null,
  },
]

async function upsertVehicleMake(
  definition,
) {
  // Makes "raciais" já podem existir criadas pelo administrador
  // (VehicleMake.name é @unique): reutilizar nesse caso.
  const existingByName =
    await prisma.vehicleMake.findUnique({
      where: {
        name: definition.name,
      },
    })

  if (existingByName) {
    return existingByName
  }

  return prisma.vehicleMake.upsert({
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
  vehicleMake,
  definition,
) {
  return prisma.vehicleModel.upsert({
    where: {
      makeId_slug: {
        makeId: vehicleMake.id,
        slug: definition.slug,
      },
    },
    update: {
      name: definition.name,
    },
    create: {
      name: definition.name,
      slug: definition.slug,
      makeId: vehicleMake.id,
    },
  })
}

async function upsertVehicleSpec(
  vehicleModel,
  definition,
) {
  return prisma.vehicleSpec.upsert({
    where: {
      modelId_engine_yearStart: {
        modelId: vehicleModel.id,
        engine: definition.engine,
        yearStart: definition.yearStart,
      },
    },
    update: {
      engineCode: definition.engineCode,
      yearEnd: definition.yearEnd,
      fuelType: definition.fuelType,
      powerHp: definition.powerHp,
    },
    create: {
      modelId: vehicleModel.id,
      engine: definition.engine,
      engineCode: definition.engineCode,
      yearStart: definition.yearStart,
      yearEnd: definition.yearEnd,
      fuelType: definition.fuelType,
      powerHp: definition.powerHp,
    },
  })
}

async function linkProductToSpec(
  link,
) {
  const variant =
    await prisma.productVariant.findUnique({
      where: {
        sku: link.variantSku,
      },
      select: {
        id: true,
        productId: true,
        product: { select: { name: true } },
      },
    })

  if (!variant) {
    throw new Error(
      `Variante "${link.variantSku}" não existe na BD — sem ela não é possível ligar o produto à especificação "${link.specEngine}"`,
    )
  }

  const spec =
    await prisma.vehicleSpec.findFirst({
      where: {
        engine: link.specEngine,
        model: {
          slug: link.modelSlug,
          make: {
            slug: link.makeSlug,
          },
        },
      },
    })

  if (!spec) {
    throw new Error(
      `Especificação "${link.specEngine}" (${link.makeSlug} / ${link.modelSlug}) não existe — corre o seed outra vez após verificar o veículo`,
    )
  }

  await prisma.productCompatibility.upsert({
    where: {
      productId_vehicleSpecId: {
        productId: variant.productId,
        vehicleSpecId: spec.id,
      },
    },
    update: {
      notes: link.note ?? null,
    },
    create: {
      productId: variant.productId,
      vehicleSpecId: spec.id,
      notes: link.note ?? null,
    },
  })

  console.log(
    `Ligação: ${variant.product.name} → ${link.makeSlug} / ${link.modelSlug} / ${link.specEngine}`,
  )
}

async function main() {
  for (const vehicle of testVehicles) {
    const vehicleMake =
      await upsertVehicleMake(
        vehicle.make,
      )

    const vehicleModel =
      await upsertVehicleModel(
        vehicleMake,
        vehicle.model,
      )

    for (const spec of vehicle.specs) {
      await upsertVehicleSpec(
        vehicleModel,
        spec,
      )
    }

    console.log(
      `Veículo: ${vehicleMake.name} / ${vehicleModel.name} (${vehicle.specs.length} especificações)`,
    )
  }

  for (const link of compatibilityLinks) {
    await linkProductToSpec(
      link,
    )
  }

  const linked =
    await prisma.productCompatibility.findMany(
      {
        include: {
          product: {
            select: { name: true },
          },
          vehicleSpec: {
            include: {
              model: {
                include: { make: true },
              },
            },
          },
        },
        orderBy: [{ id: 'asc' }],
      },
    )

  console.log(
    `Compatibilidades produto↔especificação na BD (${linked.length}):`,
  )

  for (const link of linked) {
    console.log(
      `  ${link.product.name} → ${link.vehicleSpec.model.make.name} ${link.vehicleSpec.model.name} ${link.vehicleSpec.engine} (${link.vehicleSpec.engineCode ?? 'sem código'})`,
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
