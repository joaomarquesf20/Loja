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
      'Jantes para projetos de styling e performance.',
  },
  {
    name: 'Exterior',
    slug: 'dev-exterior',
    description:
      'Splitters, spoilers, difusores e styling exterior.',
  },
  {
    name: 'Suspensão',
    slug: 'dev-suspensao',
    description:
      'Soluções para postura, altura e comportamento.',
  },
  {
    name: 'Performance',
    slug: 'dev-performance',
    description:
      'Admissão, escape e componentes orientados à performance.',
  },
  {
    name: 'Iluminação',
    slug: 'dev-iluminacao',
    description:
      'Iluminação e detalhes para uma presença mais moderna.',
  },
  {
    name: 'Acessórios',
    slug: 'dev-acessorios',
    description:
      'Acessórios para completar o projeto.',
  },
]

const brands = [
  {
    name: 'BBS',
    slug: 'dev-bbs',
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
    name: 'Akrapovič',
    slug: 'dev-akrapovic',
  },
  {
    name: 'Maxton Design',
    slug: 'dev-maxton-design',
  },
  {
    name: 'Osram',
    slug: 'dev-osram',
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
    price: '649.90',
    stockQuantity: 8,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1611016186353-9af58c69a533?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'BBS CI-R 18" Platinum Silver',
    slug: 'dev-bbs-ci-r-18-platinum-silver',
    sku: 'DEV-PFA-WHE-002',
    category: 'Jantes',
    brand: 'BBS',
    price: '529.90',
    stockQuantity: 5,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1606577924006-27d39b132ae2?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Maxton Design Front Splitter V2',
    slug: 'dev-maxton-front-splitter-v2',
    sku: 'DEV-PFA-EXT-001',
    category: 'Exterior',
    brand: 'Maxton Design',
    price: '219.90',
    stockQuantity: 7,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Maxton Design Rear Diffuser Street Pro',
    slug: 'dev-maxton-rear-diffuser-street-pro',
    sku: 'DEV-PFA-EXT-002',
    category: 'Exterior',
    brand: 'Maxton Design',
    price: '289.90',
    stockQuantity: 3,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'KW Variant 3 Coilover Kit',
    slug: 'dev-kw-variant-3-coilover-kit',
    sku: 'DEV-PFA-SUS-001',
    category: 'Suspensão',
    brand: 'KW',
    price: '1899.00',
    stockQuantity: 2,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Bilstein B14 PSS Coilover Kit',
    slug: 'dev-bilstein-b14-pss-coilover-kit',
    sku: 'DEV-PFA-SUS-002',
    category: 'Suspensão',
    brand: 'Bilstein',
    price: '1099.00',
    stockQuantity: 4,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Akrapovič Evolution Line Exhaust',
    slug: 'dev-akrapovic-evolution-line-exhaust',
    sku: 'DEV-PFA-PER-001',
    category: 'Performance',
    brand: 'Akrapovič',
    price: '2749.00',
    stockQuantity: 1,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1494905998402-395d579af36f?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Sparco Performance Intake Kit',
    slug: 'dev-sparco-performance-intake-kit',
    sku: 'DEV-PFA-PER-002',
    category: 'Performance',
    brand: 'Sparco',
    price: '349.90',
    stockQuantity: 6,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Osram LEDriving Headlight Set',
    slug: 'dev-osram-ledriving-headlight-set',
    sku: 'DEV-PFA-LIG-001',
    category: 'Iluminação',
    brand: 'Osram',
    price: '749.90',
    stockQuantity: 3,
    shippingClass: 'SMALL',
    image:
      'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Osram Dynamic Mirror Indicator Set',
    slug: 'dev-osram-dynamic-mirror-indicators',
    sku: 'DEV-PFA-LIG-002',
    category: 'Iluminação',
    brand: 'Osram',
    price: '119.90',
    stockQuantity: 9,
    shippingClass: 'SMALL',
    image:
      'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Eibach Pro-Kit Lowering Springs',
    slug: 'dev-eibach-pro-kit-lowering-springs',
    sku: 'DEV-PFA-ACC-001',
    category: 'Acessórios',
    brand: 'Eibach',
    price: '279.90',
    stockQuantity: 5,
    shippingClass: 'STANDARD',
    image:
      'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1000&q=82',
  },
  {
    name: 'Sparco Aluminium Pedal Set',
    slug: 'dev-sparco-aluminium-pedal-set',
    sku: 'DEV-PFA-ACC-002',
    category: 'Acessórios',
    brand: 'Sparco',
    price: '74.90',
    stockQuantity: 12,
    shippingClass: 'SMALL',
    image:
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1000&q=82',
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
          'Dados de desenvolvimento PFAutoParts para validação visual do storefront.',
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
          'Dados de desenvolvimento PFAutoParts para validação visual do storefront.',
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
