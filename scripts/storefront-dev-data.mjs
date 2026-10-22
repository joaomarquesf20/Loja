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
const DEFAULT_OPTION_KEY = 'default'

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
  { name: 'BBS', slug: 'dev-bbs' },
  {
    name: 'OZ Racing',
    slug: 'dev-oz-racing',
  },
  {
    name: 'Japan Racing',
    slug: 'dev-japan-racing',
  },
  { name: 'KW', slug: 'dev-kw' },
  {
    name: 'Bilstein',
    slug: 'dev-bilstein',
  },
  { name: 'H&R', slug: 'dev-h-r' },
  {
    name: 'Eibach',
    slug: 'dev-eibach',
  },
  {
    name: 'Maxton Design',
    slug: 'dev-maxton-design',
  },
  { name: 'Sparco', slug: 'dev-sparco' },
]

// Árvore de veículos usada para compatibilidade
// (família VW Golf, audi A3/S3 e BMW Série 3).
const vehicleBrands = [
  {
    name: 'Volkswagen',
    slug: 'dev-volkswagen',
    models: [
      {
        name: 'Golf',
        slug: 'dev-golf',
        generations: [
          {
            name: 'Mk7',
            platform: 'MQB',
            configurations: [
              {
                name: '2.0 TDI 150',
                engineCode: 'CRLB',
                engineType: 'Diesel',
                displacementCc: 1968,
                powerKw: '110',
                bodyType: 'Hatchback',
                yearFrom: 2012,
                yearTo: 2019,
              },
              {
                name: '1.4 TSI 125',
                engineCode: 'CZCA',
                engineType: 'Gasolina',
                displacementCc: 1395,
                powerKw: '92',
                bodyType: 'Hatchback',
                yearFrom: 2014,
                yearTo: 2019,
              },
              {
                name: 'GTI Performance 2.0 TSI 245',
                engineCode: 'CHHB',
                engineType: 'Gasolina',
                displacementCc: 1984,
                powerKw: '180',
                bodyType: 'Hatchback',
                yearFrom: 2013,
                yearTo: 2019,
              },
            ],
          },
          {
            name: 'Mk7 GTI Clubsport',
            platform: 'MQB',
            configurations: [
              {
                name: '2.0 TSI 265',
                engineCode: 'CJXF',
                engineType: 'Gasolina',
                displacementCc: 1984,
                powerKw: '195',
                bodyType: 'Hatchback',
                yearFrom: 2016,
                yearTo: 2019,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Audi',
    slug: 'dev-audi',
    models: [
      {
        name: 'A3',
        slug: 'dev-a3',
        generations: [
          {
            name: '8V',
            platform: 'MQB',
            configurations: [
              {
                name: '2.0 TDI 150',
                engineCode: 'CRLB',
                engineType: 'Diesel',
                displacementCc: 1968,
                powerKw: '110',
                bodyType: 'Sportback',
                yearFrom: 2012,
                yearTo: 2018,
              },
              {
                name: 'S3 2.0 TFSI 300',
                engineCode: 'CJXC',
                engineType: 'Gasolina',
                displacementCc: 1984,
                powerKw: '221',
                bodyType: 'Sportback',
                yearFrom: 2013,
                yearTo: 2016,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'BMW',
    slug: 'dev-bmw',
    models: [
      {
        name: 'Série 3',
        slug: 'dev-serie-3',
        generations: [
          {
            name: 'F30',
            platform: 'CLAR',
            configurations: [
              {
                name: '320d 184',
                engineCode: 'N47D20',
                engineType: 'Diesel',
                displacementCc: 1995,
                powerKw: '135',
                bodyType: 'Sedan',
                yearFrom: 2011,
                yearTo: 2015,
              },
            ],
          },
        ],
      },
    ],
  },
]

// Eixos de opções por tipo de produto.
// Os valores disponíveis de cada eixo são derivados das variantes
// reais de cada produto (ordem de primeira ocorrência), garantindo
// que o seletor do produto só mostra combinações compráveis.
const wheelOptionAxes = {
  diameter: {
    code: 'diameter',
    name: 'Diâmetro',
  },
  width: {
    code: 'width',
    name: 'Largura',
  },
  pcd: {
    code: 'pcd',
    name: 'Padrão de parafusos',
  },
  offset: {
    code: 'offset',
    name: 'Offset (ET)',
  },
  centreBore: {
    code: 'centre_bore',
    name: 'Furo central',
  },
  finish: {
    code: 'finish',
    name: 'Acabamento',
  },
}

const springOptionAxes = {
  frontDrop: {
    code: 'front_drop_mm',
    name: 'Rebaixo dianteiro',
  },
  rearDrop: {
    code: 'rear_drop_mm',
    name: 'Rebaixo traseiro',
  },
  axleLoad: {
    code: 'axle_load',
    name: 'Carga por eixo',
  },
}

const vehicleApplicationAxis = {
  code: 'vehicle_application',
  name: 'Aplicação veicular',
}

const wheelImage =
  'https://images.unsplash.com/photo-1676222617103-67f8d2eead16?auto=format&fit=crop&w=1000&q=82'
const springImage =
  'https://images.unsplash.com/photo-1760836395716-7dd00b71311a?auto=format&fit=crop&w=1000&q=82'
const exteriorImage =
  'https://images.unsplash.com/photo-1681869893306-de7fa3a289eb?auto=format&fit=crop&w=1000&q=82'
const accessoryImage =
  'https://images.unsplash.com/photo-1674849958212-cd7eb5b2de3d?auto=format&fit=crop&w=1000&q=82'
const spacerImage =
  'https://images.unsplash.com/photo-1558652862-e6cf47acff59?auto=format&fit=crop&w=1000&q=82'

/**
 * Imagens de jante por acabamento para os dados DEV.
 *
 * REGRA DE PROPRIEDADE: cada produto tem os seus próprios URLs. O
 * script NUNCA referencia ficheiros de /uploads/products — essa
 * pasta pertence aos uploads reais do administrador (ex.: as fotos
 * da Veemann MF-Z7), e partilhar ficheiros entre produtos fazia
 * aparecer imagens de um produto no catálogo de outro.
 * `finish: null` = imagem geral (fallback quando um acabamento não
 * tem galeria própria).
 */
const wheelImageCatalog = {
  'Japan Racing JR11': {
    general: [
      'https://images.unsplash.com/photo-1676222617103-67f8d2eead16?auto=format&fit=crop&w=1000&q=82',
    ],
    'Satin Black': [
      'https://images.unsplash.com/photo-1578874691223-64558a3ca096?auto=format&fit=crop&w=1000&q=82',
    ],
    'Hyper Silver': [
      'https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&w=1000&q=82',
    ],
    Bronze: [
      'https://images.unsplash.com/photo-1611821064430-0d40291d0f0b?auto=format&fit=crop&w=1000&q=82',
    ],
  },
  'BBS CH-R II': {
    general: [
      'https://images.unsplash.com/photo-1595787572918-f7eaed9a7e66?auto=format&fit=crop&w=1000&q=82',
    ],
    'Satin Black': [
      'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1000&q=82',
    ],
    'Hyper Silver': [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1000&q=82',
    ],
  },
}

/**
 * Achata o mapa acabamento→imagens do produto em metadados com
 * `finish`, na ordem geral primeiro e depois acabamentos pela ordem
 * recebida.
 */
function buildWheelImageMetadata(
  productName,
  finishes,
) {
  const imagesByFinish =
    wheelImageCatalog[productName] ?? {}
  const entries = [
    ...(imagesByFinish.general ?? []).map(
      (url) => ({ url, finish: null }),
    ),
  ]

  for (const finish of finishes) {
    for (const url of imagesByFinish[finish] ?? []) {
      entries.push({ url, finish })
    }
  }

  return entries.map((entry, index) => ({
    url: entry.url,
    finish: entry.finish,
    altText: null,
    sortOrder: index,
  }))
}

/**
 * Produtos do catálogo DEV.
 *
 * Um produto = um modelo comercializado (ex.: "Japan Racing JR11").
 * Os tamanhos/acabamentos/rebaixos são VARIANTES do produto,
 * nunca produtos separados.
 *
 * - `variantOptions`: eixos de opções do produto (ProductOption).
 * - `variants`: combinações vendáveis (ProductVariant) com SKU,
 *   preço e stock próprios, ligadas aos valores por `selection`.
 * - `specifications`: dados por variante (ex.: carga por eixo).
 */
const products = [
  {
    name: 'Japan Racing JR11',
    slug: 'dev-japan-racing-jr11',
    sku: 'DEV-PFA-WHE-001',
    category: 'Jantes',
    brand: 'Japan Racing',
    shippingClass: 'STANDARD',
    images: [wheelImage],
    defaultFinish: 'Satin Black',
    imageMetadata: buildWheelImageMetadata(
      'Japan Racing JR11',
      [
        'Satin Black',
        'Hyper Silver',
        'Bronze',
      ],
    ),
    description:
      'Jante Japan Racing JR11 em desenho de cinco raios duplos, disponível em vários diâmetros, larguras e padrões de parafusos. O preço e o stock apresentados correspondem à variante selecionada na página do produto.',
    variantOptions: [
      wheelOptionAxes.diameter,
      wheelOptionAxes.width,
      wheelOptionAxes.pcd,
      wheelOptionAxes.offset,
      wheelOptionAxes.centreBore,
      wheelOptionAxes.finish,
    ],
    variants: [
      {
        sku: 'DEV-PFA-WHE-001-JR11-17-75-100-SB',
        optionKey: '17-7.5J-5x100-ET35-64.1-Satin Black',
        price: '169.90',
        stockQuantity: 8,
        selections: {
          diameter: '17"',
          width: '7.5J',
          pcd: '5x100',
          offset: 'ET35',
          centre_bore: '64.1 mm',
          finish: 'Satin Black',
        },
      },
      {
        sku: 'DEV-PFA-WHE-001-JR11-18-80-112-HS',
        optionKey: '18-8J-5x112-ET40-66.6-Hyper Silver',
        price: '189.90',
        stockQuantity: 6,
        selections: {
          diameter: '18"',
          width: '8J',
          pcd: '5x112',
          offset: 'ET40',
          centre_bore: '66.6 mm',
          finish: 'Hyper Silver',
        },
      },
      {
        sku: 'DEV-PFA-WHE-001-JR11-18-85-112-BR',
        optionKey: '18-8.5J-5x112-ET40-66.6-Bronze',
        price: '199.90',
        stockQuantity: 4,
        selections: {
          diameter: '18"',
          width: '8.5J',
          pcd: '5x112',
          offset: 'ET40',
          centre_bore: '66.6 mm',
          finish: 'Bronze',
        },
      },
      {
        sku: 'DEV-PFA-WHE-001-JR11-19-85-120-SB',
        optionKey: '19-8.5J-5x120-ET45-72.5-Satin Black',
        price: '219.90',
        stockQuantity: 3,
        selections: {
          diameter: '19"',
          width: '8.5J',
          pcd: '5x120',
          offset: 'ET45',
          centre_bore: '72.5 mm',
          finish: 'Satin Black',
        },
      },
      {
        sku: 'DEV-PFA-WHE-001-JR11-19-95-120-BR',
        optionKey: '19-9.5J-5x120-ET45-72.5-Bronze',
        price: '239.90',
        stockQuantity: 0,
        selections: {
          diameter: '19"',
          width: '9.5J',
          pcd: '5x120',
          offset: 'ET45',
          centre_bore: '72.5 mm',
          finish: 'Bronze',
        },
      },
    ],
  },
  {
    name: 'BBS CH-R II',
    slug: 'dev-bbs-ch-r-ii',
    sku: 'DEV-PFA-WHE-002',
    category: 'Jantes',
    brand: 'BBS',
    shippingClass: 'STANDARD',
    images: [wheelImage],
    defaultFinish: 'Satin Black',
    imageMetadata: buildWheelImageMetadata(
      'BBS CH-R II',
      [
        'Satin Black',
        'Hyper Silver',
      ],
    ),
    description:
      'Jante BBS CH-R II forjada em desenho de raios em Y, com acabamentos selecionáveis por variante. Cada variante tem SKU, preço e stock próprios.',
    variantOptions: [
      wheelOptionAxes.diameter,
      wheelOptionAxes.width,
      wheelOptionAxes.pcd,
      wheelOptionAxes.centreBore,
      wheelOptionAxes.finish,
    ],
    variants: [
      {
        sku: 'DEV-PFA-WHE-002-CHR2-19-85-112-SB',
        optionKey: '19-8.5J-5x112-66.6-Satin Black',
        price: '649.90',
        stockQuantity: 4,
        selections: {
          diameter: '19"',
          width: '8.5J',
          pcd: '5x112',
          centre_bore: '66.6 mm',
          finish: 'Satin Black',
        },
      },
      {
        sku: 'DEV-PFA-WHE-002-CHR2-20-95-112-HS',
        optionKey: '20-9.5J-5x112-66.6-Hyper Silver',
        price: '749.90',
        stockQuantity: 2,
        selections: {
          diameter: '20"',
          width: '9.5J',
          pcd: '5x112',
          centre_bore: '66.6 mm',
          finish: 'Hyper Silver',
        },
      },
    ],
  },
  {
    name: 'OZ Racing Ultraleggera',
    slug: 'dev-oz-racing-ultraleggera',
    sku: 'DEV-PFA-WHE-003',
    category: 'Jantes',
    brand: 'OZ Racing',
    shippingClass: 'STANDARD',
    images: [wheelImage],
    description:
      'Jante OZ Racing Ultraleggera inspirada no mundo das corridas, com várias combinações de diâmetro, largura e PCD disponíveis como variantes do mesmo modelo.',
    variantOptions: [
      wheelOptionAxes.diameter,
      wheelOptionAxes.width,
      wheelOptionAxes.pcd,
      wheelOptionAxes.centreBore,
      wheelOptionAxes.finish,
    ],
    variants: [
      {
        sku: 'DEV-PFA-WHE-003-ULT-17-75-100-HS',
        optionKey: '17-7.5J-5x100-64.1-Hyper Silver',
        price: '479.90',
        stockQuantity: 5,
        selections: {
          diameter: '17"',
          width: '7.5J',
          pcd: '5x100',
          centre_bore: '64.1 mm',
          finish: 'Hyper Silver',
        },
      },
      {
        sku: 'DEV-PFA-WHE-003-ULT-18-80-112-SB',
        optionKey: '18-8J-5x112-66.6-Satin Black',
        price: '519.90',
        stockQuantity: 3,
        selections: {
          diameter: '18"',
          width: '8J',
          pcd: '5x112',
          centre_bore: '66.6 mm',
          finish: 'Satin Black',
        },
      },
    ],
  },
  {
    name: 'H&R Sport Springs',
    slug: 'dev-h-r-sport-springs',
    sku: 'DEV-PFA-SUS-001',
    category: 'Suspensão',
    brand: 'H&R',
    shippingClass: 'STANDARD',
    images: [springImage],
    description:
      'Molas desportivas H&R para rebaixamento progressivo. Cada variante combina o rebaixo dianteiro/traseiro e a carga de eixo homologada para a configuração do veículo.',
    variantOptions: [
      springOptionAxes.frontDrop,
      springOptionAxes.rearDrop,
      springOptionAxes.axleLoad,
    ],
    variants: [
      {
        sku: 'DEV-PFA-SUS-001-HR-30-30-1000',
        optionKey: '30/30-1000kg',
        price: '289.90',
        stockQuantity: 5,
        selections: {
          front_drop_mm: '30',
          rear_drop_mm: '30',
          axle_load: 'Até 1000 kg',
        },
        specifications: [
          {
            key: 'vehicle_fitment',
            label: 'Aplicação',
            value: 'VW Golf Mk7 / Audi A3 8V',
          },
        ],
      },
      {
        sku: 'DEV-PFA-SUS-001-HR-40-30-1090',
        optionKey: '40/30-1090kg',
        price: '299.90',
        stockQuantity: 4,
        selections: {
          front_drop_mm: '40',
          rear_drop_mm: '30',
          axle_load: 'Até 1090 kg',
        },
        specifications: [
          {
            key: 'vehicle_fitment',
            label: 'Aplicação',
            value: 'VW Golf Mk7 GTI / Audi S3 8V',
          },
        ],
      },
      {
        sku: 'DEV-PFA-SUS-001-HR-50-40-1090',
        optionKey: '50/40-1090kg',
        price: '309.90',
        stockQuantity: 3,
        selections: {
          front_drop_mm: '50',
          rear_drop_mm: '40',
          axle_load: 'Até 1090 kg',
        },
        specifications: [
          {
            key: 'vehicle_fitment',
            label: 'Aplicação',
            value: 'VW Golf Mk7 GTI Clubsport',
          },
        ],
      },
      {
        sku: 'DEV-PFA-SUS-001-HR-60-50-1150',
        optionKey: '60/50-1150kg',
        price: '319.90',
        stockQuantity: 2,
        selections: {
          front_drop_mm: '60',
          rear_drop_mm: '50',
          axle_load: 'Até 1150 kg',
        },
        specifications: [
          {
            key: 'vehicle_fitment',
            label: 'Aplicação',
            value: 'Audi S3 8V / BMW 320d F30',
          },
        ],
      },
    ],
  },
  {
    name: 'Eibach Pro-Kit',
    slug: 'dev-eibach-pro-kit',
    sku: 'DEV-PFA-SUS-002',
    category: 'Suspensão',
    brand: 'Eibach',
    shippingClass: 'STANDARD',
    images: [springImage],
    description:
      'Kit de molas Eibach Pro-Kit com rebaixamento equilibrado entre estética e conforto, disponível por combinação de rebaixo dianteiro/traseiro e carga de eixo.',
    variantOptions: [
      springOptionAxes.frontDrop,
      springOptionAxes.rearDrop,
      springOptionAxes.axleLoad,
    ],
    variants: [
      {
        sku: 'DEV-PFA-SUS-002-EIB-30-30-1000',
        optionKey: '30/30-1000kg',
        price: '269.90',
        stockQuantity: 4,
        selections: {
          front_drop_mm: '30',
          rear_drop_mm: '30',
          axle_load: 'Até 1000 kg',
        },
      },
      {
        sku: 'DEV-PFA-SUS-002-EIB-40-40-1090',
        optionKey: '40/40-1090kg',
        price: '279.90',
        stockQuantity: 4,
        selections: {
          front_drop_mm: '40',
          rear_drop_mm: '40',
          axle_load: 'Até 1090 kg',
        },
      },
    ],
  },
  {
    name: 'KW Variant 3 Coilover Kit',
    slug: 'dev-kw-variant-3-coilover-kit',
    sku: 'DEV-PFA-SUS-003',
    category: 'Suspensão',
    brand: 'KW',
    shippingClass: 'STANDARD',
    images: [springImage],
    description:
      'Kit coilover KW Variant 3 com regulação independente de compressão e retorno, disponível por aplicação veicular (plataforma do veículo).',
    variantOptions: [vehicleApplicationAxis],
    variants: [
      {
        sku: 'DEV-PFA-SUS-003-KW-V3-MQB',
        optionKey: 'mqb',
        price: '1899.00',
        stockQuantity: 2,
        selections: {
          vehicle_application:
            'Plataforma MQB (VW/Audi/Skoda/Seat)',
        },
      },
      {
        sku: 'DEV-PFA-SUS-003-KW-V3-F30',
        optionKey: 'bmw-f30',
        price: '1949.00',
        stockQuantity: 1,
        selections: {
          vehicle_application:
            'BMW Série 3 F30',
        },
      },
    ],
  },
  {
    name: 'Bilstein B14 PSS Coilover Kit',
    slug: 'dev-bilstein-b14-pss-coilover-kit',
    sku: 'DEV-PFA-SUS-004',
    category: 'Suspensão',
    brand: 'Bilstein',
    shippingClass: 'STANDARD',
    images: [springImage],
    description:
      'Kit coilover Bilstein B14 PSS com altura ajustável e amortecedores monotube gás. Aplicação por plataforma, sem seleção de opções na ficha do produto.',
    variants: [
      {
        sku: 'DEV-PFA-SUS-004-B14-MQB',
        optionKey: DEFAULT_OPTION_KEY,
        price: '1099.00',
        stockQuantity: 4,
        selections: {},
      },
    ],
  },
  {
    name: 'Maxton Design Front Splitter V2',
    slug: 'dev-maxton-front-splitter-v2',
    sku: 'DEV-PFA-EXT-001',
    category: 'Exterior',
    brand: 'Maxton Design',
    shippingClass: 'STANDARD',
    images: [exteriorImage],
    description:
      'Splitter dianteiro Maxton Design V2 para reforçar visualmente a frente do automóvel.',
    variants: [
      {
        sku: 'DEV-PFA-EXT-001-SPLIT-V2',
        optionKey: DEFAULT_OPTION_KEY,
        price: '219.90',
        stockQuantity: 7,
        selections: {},
      },
    ],
  },
  {
    name: 'Maxton Design Rear Diffuser Street Pro',
    slug: 'dev-maxton-rear-diffuser-street-pro',
    sku: 'DEV-PFA-EXT-002',
    category: 'Exterior',
    brand: 'Maxton Design',
    shippingClass: 'STANDARD',
    images: [exteriorImage],
    description:
      'Difusor traseiro Maxton Design Street Pro para acrescentar definição à traseira do automóvel.',
    variants: [
      {
        sku: 'DEV-PFA-EXT-002-DIFF-SP',
        optionKey: DEFAULT_OPTION_KEY,
        price: '289.90',
        stockQuantity: 3,
        selections: {},
      },
    ],
  },
  {
    name: 'Sparco Aluminium Pedal Set',
    slug: 'dev-sparco-aluminium-pedal-set',
    sku: 'DEV-PFA-ACC-001',
    category: 'Acessórios',
    brand: 'Sparco',
    shippingClass: 'SMALL',
    images: [accessoryImage],
    description:
      'Conjunto de pedais em alumínio Sparco para um detalhe de personalização no interior.',
    variants: [
      {
        sku: 'DEV-PFA-ACC-001-PED-ALU',
        optionKey: DEFAULT_OPTION_KEY,
        price: '74.90',
        stockQuantity: 12,
        selections: {},
      },
    ],
  },
  {
    name: 'Eibach Pro-Spacer Kit',
    slug: 'dev-eibach-pro-spacer-kit',
    sku: 'DEV-PFA-ACC-002',
    category: 'Acessórios',
    brand: 'Eibach',
    shippingClass: 'SMALL',
    images: [spacerImage],
    description:
      'Kit Eibach Pro-Spacer com espessuras selecionáveis por variante.',
    variantOptions: [
      {
        code: 'thickness_mm',
        name: 'Espessura',
      },
    ],
    variants: [
      {
        sku: 'DEV-PFA-ACC-002-SPC-15',
        optionKey: '15mm',
        price: '129.90',
        stockQuantity: 4,
        selections: { thickness_mm: '15' },
      },
      {
        sku: 'DEV-PFA-ACC-002-SPC-30',
        optionKey: '30mm',
        price: '149.90',
        stockQuantity: 5,
        selections: { thickness_mm: '30' },
      },
    ],
  },
]

// Compatibilidades veículo↔produto (ProductVehicleCompatibility).
// Só para produtos cuja compatibilidade depende do
// veículo (suspensão). Jantes NÃO entram aqui: a
// adequação de uma jante vem das especificações da
// variante (furação, furo central, diâmetro, largura e
// offset), não de uma lista de veículos por produto.
const wheelCategoryNames = new Set([
  'Jantes',
])

const compatibilities = [
  {
    productSku: 'DEV-PFA-SUS-001',
    vehicleModelSlug: 'dev-golf',
    vehicleConfigurationEngineCode: 'CRLB',
    note: 'Aplicação por configuração de motor',
  },
  {
    productSku: 'DEV-PFA-SUS-001',
    vehicleModelSlug: 'dev-a3',
    vehicleConfigurationEngineCode: 'CRLB',
  },
  {
    productSku: 'DEV-PFA-SUS-003',
    vehicleModelSlug: 'dev-golf',
    vehicleGenerationName: 'Mk7',
  },
  {
    productSku: 'DEV-PFA-SUS-003',
    vehicleModelSlug: 'dev-serie-3',
    vehicleGenerationName: 'F30',
  },
  {
    productSku: 'DEV-PFA-SUS-004',
    vehicleModelSlug: 'dev-golf',
    vehicleGenerationName: 'Mk7',
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
      description: definition.description,
    },
    create: {
      name: definition.name,
      slug: definition.slug,
      description: definition.description,
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

async function upsertVehicleTree() {
  const vehicleBrandBySlug = new Map()
  const vehicleModelBySlug = new Map()
  const generationByKey = new Map()
  const configurationByKey = new Map()

  for (const brandDefinition of vehicleBrands) {
    const vehicleBrandSlug =
      brandDefinition.slug

    const vehicleBrand =
      await prisma.vehicleBrand.upsert({
        where: {
          slug: vehicleBrandSlug,
        },
        update: {
          name: brandDefinition.name,
        },
        create: {
          name: brandDefinition.name,
          slug: vehicleBrandSlug,
        },
      })

    vehicleBrandBySlug.set(
      vehicleBrandSlug,
      vehicleBrand,
    )

    for (const modelDefinition of brandDefinition.models) {
      const vehicleModelSlug =
        modelDefinition.slug

      const vehicleModel =
        await prisma.vehicleModel.upsert({
          where: {
            brandId_slug: {
              brandId: vehicleBrand.id,
              slug: vehicleModelSlug,
            },
          },
          update: {
            name: modelDefinition.name,
          },
          create: {
            name: modelDefinition.name,
            slug: vehicleModelSlug,
            brandId: vehicleBrand.id,
          },
        })

      vehicleModelBySlug.set(
        vehicleModelSlug,
        vehicleModel,
      )

      for (const generationDefinition of modelDefinition.generations) {
        const generationKey = `${vehicleModelSlug}:${generationDefinition.name}`

        const vehicleGeneration =
          await prisma.vehicleGeneration.upsert({
            where: {
              modelId_name: {
                modelId: vehicleModel.id,
                name: generationDefinition.name,
              },
            },
            update: {
              platform:
                generationDefinition.platform,
            },
            create: {
              name: generationDefinition.name,
              platform:
                generationDefinition.platform,
              modelId: vehicleModel.id,
            },
          })

        generationByKey.set(
          generationKey,
          vehicleGeneration,
        )

        for (const configurationDefinition of generationDefinition.configurations) {
          const configurationKey = `${generationKey}:${configurationDefinition.name}`

          const existingConfiguration =
            await prisma.vehicleConfiguration.findFirst(
              {
                where: {
                  generationId:
                    vehicleGeneration.id,
                  name: configurationDefinition.name,
                },
              },
            )

          const vehicleConfiguration =
            existingConfiguration ??
            (await prisma.vehicleConfiguration.create(
              {
                data: {
                  generationId:
                    vehicleGeneration.id,
                  name: configurationDefinition.name,
                  engineCode:
                    configurationDefinition.engineCode,
                  engineType:
                    configurationDefinition.engineType,
                  displacementCc:
                    configurationDefinition.displacementCc,
                  powerKw: configurationDefinition.powerKw
                    ? configurationDefinition.powerKw
                    : null,
                  bodyType:
                    configurationDefinition.bodyType,
                  yearFrom:
                    configurationDefinition.yearFrom,
                  yearTo:
                    configurationDefinition.yearTo,
                },
              },
            ))

          configurationByKey.set(
            configurationKey,
            vehicleConfiguration,
          )
        }
      }
    }
  }

  return {
    vehicleBrandBySlug,
    vehicleModelBySlug,
    generationByKey,
    configurationByKey,
  }
}

async function upsertOptionsAndVariants(
  product,
  definition,
) {
  const optionAxes =
    definition.variantOptions ?? []

  const optionByCode = new Map()

  // Valores efetivos de cada eixo: valores distintos pelas
  // variantes declaradas, pela ordem de primeira ocorrência.
  for (const [
    axisIndex,
    axis,
  ] of optionAxes.entries()) {
    const axisValues = []

    for (const variantDefinition of definition.variants) {
      const value =
        variantDefinition.selections?.[
          axis.code
        ]

      if (
        value !== undefined &&
        !axisValues.includes(value)
      ) {
        axisValues.push(value)
      }
    }

    const option =
      await prisma.productOption.upsert({
        where: {
          productId_code: {
            productId: product.id,
            code: axis.code,
          },
        },
        update: {
          name: axis.name,
          position: axisIndex,
        },
        create: {
          productId: product.id,
          code: axis.code,
          name: axis.name,
          position: axisIndex,
        },
      })

    optionByCode.set(axis.code, option)

    for (const [
      valueIndex,
      value,
    ] of axisValues.entries()) {
      await prisma.productOptionValue.upsert(
        {
          where: {
            optionId_value: {
              optionId: option.id,
              value,
            },
          },
          update: {
            position: valueIndex,
          },
          create: {
            optionId: option.id,
            value,
            position: valueIndex,
          },
        },
      )
    }
  }

  // Imagens com acabamento: a associação é feita pelo
  // finishValueId real (ProductOptionValue do eixo finish),
  // garantindo que a galeria da loja troca com o acabamento.
  if (
    definition.imageMetadata &&
    definition.imageMetadata.length > 0
  ) {
    const finishOption = optionByCode.get('finish')

    await prisma.productImage.deleteMany({
      where: { productId: product.id },
    })

    for (const image of definition.imageMetadata) {
      let finishValueId = null

      if (image.finish && finishOption) {
        const finishValue =
          await prisma.productOptionValue.findUnique({
            where: {
              optionId_value: {
                optionId: finishOption.id,
                value: image.finish,
              },
            },
            select: { id: true },
          })

        if (!finishValue) {
          throw new Error(
            `Imagem com acabamento "${image.finish}" não tem variante correspondente em "${definition.name}"`,
          )
        }

        finishValueId = finishValue.id
      }

      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: image.url,
          altText: image.altText ?? null,
          sortOrder: image.sortOrder ?? 0,
          isPrimary: image.isPrimary ?? false,
          finishValueId,
        },
      })
    }
  }

  for (const [
    variantIndex,
    variantDefinition,
  ] of definition.variants.entries()) {
    const variant =
      await prisma.productVariant.upsert({
        where: {
          productId_optionKey: {
            productId: product.id,
            optionKey:
              variantDefinition.optionKey,
          },
        },
        update: {
          sku: variantDefinition.sku,
          price: variantDefinition.price,
          stockQuantity:
            variantDefinition.stockQuantity,
          isActive: true,
          position: variantIndex,
          images: [],
        },
        create: {
          productId: product.id,
          sku: variantDefinition.sku,
          optionKey:
            variantDefinition.optionKey,
          price: variantDefinition.price,
          stockQuantity:
            variantDefinition.stockQuantity,
          isActive: true,
          position: variantIndex,
          images: [],
        },
      })

    for (const [
      code,
      value,
    ] of Object.entries(
      variantDefinition.selections ?? {},
    )) {
      const option = optionByCode.get(code)

      if (!option) {
        throw new Error(
          `Opção "${code}" não definida para ${definition.name}`,
        )
      }

      const optionValue =
        await prisma.productOptionValue.findUnique(
          {
            where: {
              optionId_value: {
                optionId: option.id,
                value,
              },
            },
          },
        )

      if (!optionValue) {
        throw new Error(
          `Valor "${value}" não existe na opção "${code}" de ${definition.name}`,
        )
      }

      await prisma.productVariantOptionSelection.upsert(
        {
          where: {
            variantId_optionId: {
              variantId: variant.id,
              optionId: option.id,
            },
          },
          update: {
            optionValueId: optionValue.id,
          },
          create: {
            variantId: variant.id,
            optionId: option.id,
            optionValueId: optionValue.id,
          },
        },
      )
    }

    for (const [
      specIndex,
      specification,
    ] of (
      variantDefinition.specifications ?? []
    ).entries()) {
      await prisma.productVariantSpecification.upsert(
        {
          where: {
            variantId_key: {
              variantId: variant.id,
              key: specification.key,
            },
          },
          update: {
            label: specification.label,
            value: specification.value,
            position: specIndex,
          },
          create: {
            variantId: variant.id,
            key: specification.key,
            label: specification.label,
            value: specification.value,
            position: specIndex,
          },
        },
      )
    }
  }
}

async function upsertCompatibility(
  product,
  compatibilityDefinition,
  vehicleTree,
) {
  const vehicleModel =
    vehicleTree.vehicleModelBySlug.get(
      compatibilityDefinition.vehicleModelSlug,
    )

  if (!vehicleModel) {
    throw new Error(
      `Modelo de veículo "${compatibilityDefinition.vehicleModelSlug}" não encontrado`,
    )
  }

  const generation =
    compatibilityDefinition.vehicleGenerationName
      ? vehicleTree.generationByKey.get(
          `${compatibilityDefinition.vehicleModelSlug}:${compatibilityDefinition.vehicleGenerationName}`,
        )
      : null

  if (
    compatibilityDefinition.vehicleGenerationName &&
    !generation
  ) {
    throw new Error(
      `Geração "${compatibilityDefinition.vehicleGenerationName}" não encontrada`,
    )
  }

  let configuration = null

  if (
    compatibilityDefinition.vehicleConfigurationEngineCode
  ) {
    const configurations =
      await prisma.vehicleConfiguration.findMany(
        {
          where: {
            engineCode:
              compatibilityDefinition.vehicleConfigurationEngineCode,
            generation: {
              modelId: vehicleModel.id,
            },
          },
          take: 1,
        },
      )

    configuration =
      configurations[0] ?? null
  }

  const existingCompatibility =
    await prisma.productVehicleCompatibility.findFirst(
      {
        where: {
          productId: product.id,
          vehicleBrandId: vehicleModel.brandId,
          vehicleModelId: vehicleModel.id,
          vehicleGenerationId:
            generation?.id ?? null,
          vehicleConfigurationId:
            configuration?.id ?? null,
        },
      },
    )

  if (existingCompatibility) {
    return existingCompatibility
  }

  return prisma.productVehicleCompatibility.create(
    {
      data: {
        productId: product.id,
        vehicleBrandId: vehicleModel.brandId,
        vehicleModelId: vehicleModel.id,
        vehicleGenerationId:
          generation?.id ?? null,
        vehicleConfigurationId:
          configuration?.id ?? null,
      },
    },
  )
}

async function seed() {
  const categoryByName = new Map()
  const brandByName = new Map()

  for (const definition of categories) {
    const category =
      await findOrCreateCategory(definition)

    categoryByName.set(
      definition.name,
      category,
    )
  }

  for (const definition of brands) {
    const brand =
      await findOrCreateBrand(definition)

    brandByName.set(definition.name, brand)
  }

  const vehicleTree =
    await upsertVehicleTree()

  let variantCount = 0

  for (const definition of products) {
    const category = categoryByName.get(
      definition.category,
    )

    const brand = brandByName.get(
      definition.brand,
    )

    if (!category || !brand) {
      throw new Error(
        `Dados de desenvolvimento incompletos para ${definition.name}`,
      )
    }

    const productCompatibilities =
      compatibilities.filter(
        (item) =>
          item.productSku ===
          definition.sku,
      )

    if (
      wheelCategoryNames.has(
        category.name,
      ) &&
      productCompatibilities.length > 0
    ) {
      throw new Error(
        `"${definition.name}" é uma jante: a compatibilidade vem das especificações da variante, não de uma lista de veículos por produto`,
      )
    }

    const product =
      await prisma.product.upsert({
        where: {
          sku: definition.sku,
        },
        update: {
          categoryId: category.id,
          productBrandId: brand.id,
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          isActive: true,
          images: definition.images,
          defaultFinish:
            definition.defaultFinish ?? null,
          shippingClass:
            definition.shippingClass,
        },
        create: {
          categoryId: category.id,
          productBrandId: brand.id,
          name: definition.name,
          slug: definition.slug,
          sku: definition.sku,
          description: definition.description,
          isActive: true,
          images: definition.images,
          defaultFinish:
            definition.defaultFinish ?? null,
          shippingClass:
            definition.shippingClass,
        },
      })

    await upsertOptionsAndVariants(
      product,
      definition,
    )

    variantCount +=
      definition.variants.length

    for (const compatibilityDefinition of productCompatibilities) {
      await upsertCompatibility(
        product,
        compatibilityDefinition,
        vehicleTree,
      )
    }
  }

  console.log(
    `Catálogo DEV criado/atualizado: ${categories.length} categorias, ${brands.length} marcas, ${products.length} produtos (modelos) com ${variantCount} variantes e ${compatibilities.length} compatibilidades.`,
  )
}

async function clear() {
  const deletedProducts =
    await prisma.product.deleteMany({
      where: {
        sku: {
          startsWith: DEV_PREFIX,
        },
      },
    })

  const deletedBrands =
    await prisma.productBrand.deleteMany({
      where: {
        slug: {
          in: brands.map(
            (brand) => brand.slug,
          ),
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
          in: categories.map(
            (category) => category.slug,
          ),
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
