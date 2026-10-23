import {
  describe,
  expect,
  test,
} from 'vitest'
import {
  getStorefrontCategoryImage,
  isStorefrontCategoryVisible,
  sortStorefrontCategories,
} from './storefront-category-media'

describe('storefront category media', () => {
  test('oculta a categoria de desenvolvimento TESTE', () => {
    expect(
      isStorefrontCategoryVisible({
        name: 'TESTE',
        slug: 'teste',
      }),
    ).toBe(false)

    expect(
      isStorefrontCategoryVisible({
        name: 'Jantes',
        slug: 'dev-jantes',
      }),
    ).toBe(true)
  })

  test.each([
    ['Jantes', 'jantes'],
    ['Suspensão', 'suspensao'],
    ['Exterior', 'exterior'],
    ['Iluminação', 'iluminacao'],
    ['Performance', 'performance'],
    ['Acessórios', 'acessorios'],
  ])(
    'fornece imagem específica para %s',
    (name, slug) => {
      expect(
        getStorefrontCategoryImage({
          name,
          slug,
        }),
      ).toMatch(
        /^https:\/\/images\.unsplash\.com\//,
      )
    },
  )

  test('não inventa imagem específica para uma categoria desconhecida', () => {
    expect(
      getStorefrontCategoryImage({
        name: 'Categoria nova',
        slug: 'categoria-nova',
      }),
    ).toBeNull()
  })

  test('prioriza as categorias centrais da marca sem inventar categorias', () => {
    const categories = [
      {
        name: 'Detalhes',
        slug: 'detalhes',
      },
      {
        name: 'Exterior',
        slug: 'exterior',
      },
      {
        name: 'Jantes',
        slug: 'jantes',
      },
      {
        name: 'Acessórios',
        slug: 'acessorios',
      },
      {
        name: 'Suspensão',
        slug: 'suspensao',
      },
    ]

    expect(
      sortStorefrontCategories(
        categories,
      ).map(
        (category) =>
          category.name,
      ),
    ).toEqual([
      'Jantes',
      'Suspensão',
      'Exterior',
      'Acessórios',
      'Detalhes',
    ])
  })
})
