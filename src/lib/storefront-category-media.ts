type StorefrontCategoryLike = {
  name: string
  slug: string
}

type CategoryVisual = {
  image: string
}

const CATEGORY_VISUALS: Array<{
  keywords: string[]
  visual: CategoryVisual
}> = [
  {
    keywords: [
      'jante',
      'jantes',
      'wheel',
      'wheels',
      'rim',
      'rims',
    ],
    visual: {
      image:
        'https://images.unsplash.com/photo-1676222617103-67f8d2eead16?auto=format&fit=crop&w=1200&q=82',
    },
  },
  {
    keywords: [
      'suspensao',
      'suspensão',
      'coilover',
      'coilovers',
      'mola',
      'molas',
      'amortecedor',
      'amortecedores',
      'suspension',
    ],
    visual: {
      image:
        'https://images.unsplash.com/photo-1760836395716-7dd00b71311a?auto=format&fit=crop&w=1200&q=82',
    },
  },
  {
    keywords: [
      'exterior',
      'splitter',
      'splitters',
      'spoiler',
      'spoilers',
      'difusor',
      'difusores',
      'bodykit',
      'body-kit',
      'carrocaria',
      'carroçaria',
    ],
    visual: {
      image:
        'https://images.unsplash.com/photo-1681869893306-de7fa3a289eb?auto=format&fit=crop&w=1200&q=82',
    },
  },
  {
    keywords: [
      'iluminacao',
      'iluminação',
      'lighting',
      'farol',
      'farois',
      'faróis',
      'farolim',
      'farolins',
      'drl',
    ],
    visual: {
      image:
        'https://images.unsplash.com/photo-1706805005614-29d03b3c89b6?auto=format&fit=crop&w=1200&q=82',
    },
  },
  {
    keywords: [
      'performance',
      'escape',
      'exhaust',
      'intake',
      'admissao',
      'admissão',
      'intercooler',
      'turbo',
    ],
    visual: {
      image:
        'https://images.unsplash.com/photo-1703778785063-1fb14ac295c2?auto=format&fit=crop&w=1200&q=82',
    },
  },
  {
    keywords: [
      'acessorio',
      'acessório',
      'acessorios',
      'acessórios',
      'accessory',
      'accessories',
      'interior',
    ],
    visual: {
      image:
        'https://images.unsplash.com/photo-1556982962-dc0ee0f77f47?auto=format&fit=crop&w=1200&q=82',
    },
  },
]

const HIDDEN_STOREFRONT_CATEGORY_KEYS =
  new Set([
    'teste',
    'dev-teste',
  ])

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('pt-PT')
}

export function isStorefrontCategoryVisible(
  category: StorefrontCategoryLike,
) {
  const name = normalize(category.name)
  const slug = normalize(category.slug)

  return (
    !HIDDEN_STOREFRONT_CATEGORY_KEYS.has(
      name,
    ) &&
    !HIDDEN_STOREFRONT_CATEGORY_KEYS.has(
      slug,
    )
  )
}

export function getStorefrontCategoryImage(
  category: StorefrontCategoryLike,
) {
  const searchable = normalize(
    `${category.name} ${category.slug}`,
  )

  const match =
    CATEGORY_VISUALS.find(
      ({ keywords }) =>
        keywords.some((keyword) =>
          searchable.includes(
            normalize(keyword),
          ),
        ),
    )

  return match?.visual.image ?? null
}
