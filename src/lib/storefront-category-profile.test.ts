import {
  describe,
  expect,
  test,
} from 'vitest'
import type { CatalogVariantFacet } from '@/server/catalog'
import {
  getBrandFilterLabel,
  getCategoryFilterProfile,
  getVisibleVariantFacets,
  shouldShowVehicleFilter,
  shouldShowVehicleGenerations,
} from './storefront-category-profile'

function createFacet(
  code: string,
  name: string,
): CatalogVariantFacet {
  return {
    code,
    name,
    values: [
      {
        value: 'valor',
        productCount: 1,
      },
    ],
  }
}

const facets: CatalogVariantFacet[] = [
  createFacet('diameter', 'Diâmetro'),
  createFacet('width', 'Largura'),
  createFacet('pcd', 'Padrão de parafusos'),
  createFacet('offset', 'Offset (ET)'),
  createFacet('centre_bore', 'Furo central'),
  createFacet('finish', 'Acabamento'),
  createFacet('front_drop_mm', 'Rebaixo dianteiro'),
  createFacet('rear_drop_mm', 'Rebaixo traseiro'),
  createFacet('axle_load', 'Carga por eixo'),
  createFacet(
    'vehicle_application',
    'Aplicação veicular',
  ),
  createFacet('thickness_mm', 'Espessura'),
]

describe(
  'storefront category profile',
  () => {
    test('identifica o perfil a partir do nome e slug da categoria', () => {
      expect(
        getCategoryFilterProfile({
          name: 'Jantes',
          slug: 'jantes',
        }),
      ).toBe('wheels')

      expect(
        getCategoryFilterProfile({
          name: 'Wheels',
          slug: 'wheels',
        }),
      ).toBe('wheels')

      expect(
        getCategoryFilterProfile({
          name: 'Suspensão',
          slug: 'suspensao',
        }),
      ).toBe('suspension')

      expect(
        getCategoryFilterProfile({
          name: 'Molas',
          slug: 'molas',
        }),
      ).toBe('suspension')

      expect(
        getCategoryFilterProfile({
          name: 'Exterior',
          slug: 'exterior',
        }),
      ).toBe('exterior')

      expect(
        getCategoryFilterProfile({
          name: 'Acessórios',
          slug: 'acessorios',
        }),
      ).toBe('generic')
    })

    test('jantes mostram medidas e nenhuma opção de veículo', () => {
      expect(
        getVisibleVariantFacets(
          'wheels',
          facets,
        ).map((facet) => facet.code),
      ).toEqual([
        'diameter',
        'pcd',
        'width',
        'offset',
        'centre_bore',
        'finish',
      ])

      expect(
        shouldShowVehicleFilter('wheels'),
      ).toBe(false)

      expect(
        getBrandFilterLabel('wheels'),
      ).toBe('Marca')
    })

    test('suspensão mostra rebaixamento e aplicação sem carga por eixo', () => {
      const visible =
        getVisibleVariantFacets(
          'suspension',
          facets,
        )

      expect(
        visible.map(
          (facet) => facet.code,
        ),
      ).toEqual([
        'front_drop_mm',
        'rear_drop_mm',
        'vehicle_application',
      ])

      expect(
        visible.some(
          (facet) =>
            facet.code === 'axle_load',
        ),
      ).toBe(false)

      expect(
        shouldShowVehicleFilter(
          'suspension',
        ),
      ).toBe(true)

      expect(
        getBrandFilterLabel('suspension'),
      ).toBe('Fabricante')
    })

    test('exterior mostra apenas fabricante e veículo', () => {
      expect(
        getVisibleVariantFacets(
          'exterior',
          facets,
        ),
      ).toEqual([])

      expect(
        shouldShowVehicleFilter('exterior'),
      ).toBe(true)

      expect(
        getBrandFilterLabel('exterior'),
      ).toBe('Fabricante')
    })

    test('categorias genéricas mostram todos os eixos exceto a carga por eixo', () => {
      expect(
        getVisibleVariantFacets(
          'generic',
          facets,
        ).map((facet) => facet.code),
      ).toEqual([
        'diameter',
        'width',
        'pcd',
        'offset',
        'centre_bore',
        'finish',
        'front_drop_mm',
        'rear_drop_mm',
        'vehicle_application',
        'thickness_mm',
      ])
    })

    test('as gerações só aparecem na suspensão ou quando um modelo tem várias', () => {
      const modelsWithOneGeneration = [
        {
          generations: [
            { id: 'g1', name: 'Mk7' },
          ],
        },
      ]

      const modelsWithTwoGenerations = [
        {
          generations: [
            { id: 'g1', name: 'Mk7' },
            { id: 'g2', name: 'Mk8' },
          ],
        },
      ]

      expect(
        shouldShowVehicleGenerations(
          'suspension',
          modelsWithOneGeneration,
        ),
      ).toBe(true)

      expect(
        shouldShowVehicleGenerations(
          'exterior',
          modelsWithOneGeneration,
        ),
      ).toBe(false)

      expect(
        shouldShowVehicleGenerations(
          'exterior',
          modelsWithTwoGenerations,
        ),
      ).toBe(true)
    })
  },
)
