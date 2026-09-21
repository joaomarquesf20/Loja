import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

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

const DEV_PREFIX = 'DEV-PFA-'
const DEV_SLUG_PREFIX = 'dev-'

const categories = [
  {
    name: 'Jantes',
    slug: 'dev-jantes',
    description:
      'Jantes premium para projetos de styling e personalização.',
  },
  {
    name: 'Suspensão',
    slug: 'dev-suspensao',
    description:
      'Coilovers, molas e soluções para postura e comportamento.',
  },
  {
    name: 'Exterior',
    slug: 'dev-exterior',
    description:
      'Body-kits, splitters, spoilers e difusores.',
  },
  {
    name: 'Acessórios',
    slug: 'dev-acessorios',
    description:
      'Acessórios para personalização automóvel.',
  },
]

const brands = [
  {
    name: 'BBS',
    slug: 'dev-bbs',
  },
  {
    name: 'OZ Racing',
    slug: 'dev-oz-racing',
  },
  {
    name: 'KW',
    slug: 'dev-kw',
  },
  {
    name: 'Bilstein',
    slug: 'dev-bilstein',
  },
  {
    name: 'H&R',
    slug: 'dev-h-r',
  },
  {
    name: 'Maxton Design',
    slug: 'dev-maxton-design',
  },
  {
    name: 'Sparco',
    slug: 'dev-sparco',
  },
  {
    name: 'Eibach',
    slug: 'dev-eibach',
  },
]

const products = [
  {
    name: 'BBS CH-R II 19" Satin Black',
    slug: 'dev-bbs-ch-r-ii-19-satin-black',
    sku: 'DEV-PFA-WHE-001',
    category: 'Jantes',
    brand: 'BBS',
    description:
      'Jante BBS CH-R II de 19 polegadas em acabamento Satin Black, pensada para projetos de styling com uma presença mais marcada.',
    price: '649.90',
    stockQuantity: 8,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1676222617103-67f8d2eead16?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'OZ Racing Ultraleggera 18"',
    slug: 'dev-oz-racing-ultraleggera-18',
    sku: 'DEV-PFA-WHE-002',
    category: 'Jantes',
    brand: 'OZ Racing',
    description:
      'Jante OZ Racing Ultraleggera de 18 polegadas para projetos de personalização automóvel com foco num visual desportivo e limpo.',
    price: '479.90',
    stockQuantity: 6,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1676222617103-67f8d2eead16?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'KW Variant 3 Coilover Kit',
    slug: 'dev-kw-variant-3-coilover-kit',
    sku: 'DEV-PFA-SUS-001',
    category: 'Suspensão',
    brand: 'KW',
    description:
      'Kit de suspensão coilover KW Variant 3 para projetos que procuram trabalhar a postura e o comportamento do automóvel.',
    price: '1899.00',
    stockQuantity: 2,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1760836395716-7dd00b71311a?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Bilstein B14 PSS Coilover Kit',
    slug: 'dev-bilstein-b14-pss-coilover-kit',
    sku: 'DEV-PFA-SUS-002',
    category: 'Suspensão',
    brand: 'Bilstein',
    description:
      'Kit de suspensão Bilstein B14 PSS destinado a projetos de personalização e rebaixamento com componentes dedicados.',
    price: '1099.00',
    stockQuantity: 4,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1760836395716-7dd00b71311a?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'H&R Sport Springs',
    slug: 'dev-h-r-sport-springs',
    sku: 'DEV-PFA-SUS-003',
    category: 'Suspensão',
    brand: 'H&R',
    description:
      'Conjunto de molas H&R Sport para projetos que procuram uma postura mais baixa e uma presença mais dinâmica.',
    price: '289.90',
    stockQuantity: 5,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1760836395716-7dd00b71311a?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Maxton Design Front Splitter V2',
    slug: 'dev-maxton-front-splitter-v2',
    sku: 'DEV-PFA-EXT-001',
    category: 'Exterior',
    brand: 'Maxton Design',
    description:
      'Splitter dianteiro Maxton Design V2 para reforçar visualmente a frente do automóvel e completar um projeto de exterior.',
    price: '219.90',
    stockQuantity: 7,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1681869893306-de7fa3a289eb?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Maxton Design Rear Diffuser Street Pro',
    slug: 'dev-maxton-rear-diffuser-street-pro',
    sku: 'DEV-PFA-EXT-002',
    category: 'Exterior',
    brand: 'Maxton Design',
    description:
      'Difusor traseiro Maxton Design Street Pro para acrescentar definição e presença à traseira do automóvel.',
    price: '289.90',
    stockQuantity: 3,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1681869893306-de7fa3a289eb?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Maxton Design Spoiler Extension',
    slug: 'dev-maxton-spoiler-extension',
    sku: 'DEV-PFA-EXT-003',
    category: 'Exterior',
    brand: 'Maxton Design',
    description:
      'Extensão de spoiler Maxton Design para complementar a linha traseira e dar um acabamento mais marcado ao projeto.',
    price: '159.90',
    stockQuantity: 6,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1681869893306-de7fa3a289eb?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Sparco Aluminium Pedal Set',
    slug: 'dev-sparco-aluminium-pedal-set',
    sku: 'DEV-PFA-ACC-001',
    category: 'Acessórios',
    brand: 'Sparco',
    description:
      'Conjunto de pedais em alumínio Sparco para acrescentar um detalhe de personalização ao interior do automóvel.',
    price: '74.90',
    stockQuantity: 12,
    shippingClass: 'SMALL',
    image:
      'https://images.unsplash.com/photo-1556982962-dc0ee0f77f47?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Eibach Pro-Spacer Kit',
    slug: 'dev-eibach-pro-spacer-kit',
    sku: 'DEV-PFA-ACC-002',
    category: 'Acessórios',
    brand: 'Eibach',
    description:
      'Kit Eibach Pro-Spacer para projetos que procuram ajustar visualmente a posição das rodas relativamente à carroçaria.',
    price: '129.90',
    stockQuantity: 9,
    shippingClass: 'SMALL',
    image:
      'https://images.unsplash.com/photo-1556982962-dc0ee0f77f47?auto=format&fit=crop&w=1000&q=82',
  },
]

async function findOrCreateCategory(
  definition,
) {
  const existingByName =
    await prisma.category.findFirst({
      where: {
        name: definition.name,
      },
    })

  if (existingByName) {
    return existingByName
  }

  return prisma.category.upsert({
    where: {
      slug: definition.slug,
    },
    update: {
      name: definition.name,
      description:
        definition.description,
    },
    create: {
      name: definition.name,
      slug: definition.slug,
      description:
        definition.description,
    },
  })
}

async function findOrCreateBrand(
  definition,
) {
  const existingByName =
    await prisma.productBrand.findUnique({
      where: {
        name: definition.name,
      },
    })

  if (existingByName) {
    return existingByName
  }

  return prisma.productBrand.upsert({
    where: {
      slug: definition.slug,
    },
    update: {
      name: definition.name,
    },
    create: definition,
  })
}

async function seed() {
  const categoryByName = new Map()
  const brandByName = new Map()

  for (const definition of categories) {
    const category =
      await findOrCreateCategory(
        definition,
      )

    categoryByName.set(
      definition.name,
      category,
    )
  }

  for (const definition of brands) {
    const brand =
      await findOrCreateBrand(
        definition,
      )

    brandByName.set(
      definition.name,
      brand,
    )
  }

  for (const definition of products) {
    const category =
      categoryByName.get(
        definition.category,
      )

    const brand =
      brandByName.get(
        definition.brand,
      )

    if (!category || !brand) {
      throw new Error(
        `Dados de desenvolvimento incompletos para ${definition.name}`,
      )
    }

    await prisma.product.upsert({
      where: {
        sku: definition.sku,
      },
      update: {
        categoryId: category.id,
        productBrandId: brand.id,
        name: definition.name,
        slug: definition.slug,
        description:
          definition.description,
        price: definition.price,
        stockQuantity:
          definition.stockQuantity,
        isActive: true,
        images: [
          definition.image,
        ],
        shippingClass:
          definition.shippingClass,
      },
      create: {
        categoryId: category.id,
        productBrandId: brand.id,
        name: definition.name,
        slug: definition.slug,
        sku: definition.sku,
        description:
          definition.description,
        price: definition.price,
        stockQuantity:
          definition.stockQuantity,
        isActive: true,
        images: [
          definition.image,
        ],
        shippingClass:
          definition.shippingClass,
      },
    })
  }

  console.log(
    `Catálogo DEV criado/atualizado: ${categories.length} categorias, ${brands.length} marcas, ${products.length} produtos.`,
  )
}

async function clear() {
  const deletedProducts =
    await prisma.product.deleteMany({
      where: {
        OR: [
          {
            sku: {
              startsWith:
                DEV_PREFIX,
            },
          },
          {
            slug: {
              startsWith:
                DEV_SLUG_PREFIX,
            },
          },
        ],
      },
    })

  const deletedBrands =
    await prisma.productBrand.deleteMany({
      where: {
        slug: {
          startsWith:
            DEV_SLUG_PREFIX,
        },
        products: {
          none: {},
        },
      },
    })

  const deletedCategories =
    await prisma.category.deleteMany({
      where: {
        slug: {
          startsWith:
            DEV_SLUG_PREFIX,
        },
        products: {
          none: {},
        },
        children: {
          none: {},
        },
      },
    })

  console.log(
    `Catálogo DEV removido: ${deletedProducts.count} produtos, ${deletedBrands.count} marcas e ${deletedCategories.count} categorias.`,
  )
}

async function main() {
  const command = process.argv[2]

  if (command === 'seed') {
    await seed()
    return
  }

  if (command === 'clear') {
    await clear()
    return
  }

  throw new Error(
    'Usa "seed" ou "clear".',
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
