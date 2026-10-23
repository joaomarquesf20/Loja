import {
  describe,
  expect,
  test,
} from 'vitest'
import type {
  CatalogVariantFacet,
  CatalogVehicleMakeFacet,
} from '@/server/catalog'
import {
  buildCategoryHref,
  getVisibleVehicleGenerations,
  getVisibleVehicleModels,
  normalizeVehicleSelections,
  parseSortParam,
  parseVariantSelections,
  toggleId,
  toggleVariantSelection,
  type CategoryFilterState,
} from './category-filter-query'

const baseFilters: CategoryFilterState = {
  inStockOnly: false,
  brandSlugs: [],
  vehicleMakeIds: [],
  vehicleModelIds: [],
  vehicleGenerationIds: [],
  variantSelections: [],
  sort: 'newest',
}

const facets: CatalogVariantFacet[] = [
  {
    code: 'diameter',
    name: 'Diâmetro',
    values: [
      { value: '18"', productCount: 1 },
      { value: '19"', productCount: 2 },
    ],
  },
  {
    code: 'pcd',
    name: 'Padrão de parafusos',
    values: [
      { value: '5x112', productCount: 1 },
      { value: '5x120', productCount: 1 },
    ],
  },
]

const makes: CatalogVehicleMakeFacet[] = [
  {
    id: 'make-vw',
    name: 'Volkswagen',
    productCount: 3,
    models: [
      {
        id: 'model-golf',
        name: 'Golf',
        brandId: 'make-vw',
        productCount: 2,
        generations: [
          {
            id: 'gen-mk7',
            name: 'Mk7',
            modelId: 'model-golf',
            productCount: 1,
          },
          {
            id: 'gen-mk8',
            name: 'Mk8',
            modelId: 'model-golf',
            productCount: 1,
          },
        ],
      },
      {
        id: 'model-passat',
        name: 'Passat',
        brandId: 'make-vw',
        productCount: 1,
        generations: [
          {
            id: 'gen-b8',
            name: 'B8',
            modelId: 'model-passat',
            productCount: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'make-bmw',
    name: 'BMW',
    productCount: 1,
    models: [
      {
        id: 'model-serie-3',
        name: 'Série 3',
        brandId: 'make-bmw',
        productCount: 1,
        generations: [
          {
            id: 'gen-f30',
            name: 'F30',
            modelId: 'model-serie-3',
            productCount: 1,
          },
        ],
      },
    ],
  },
]

describe(
  'category filter query',
  () => {
    test('preserva todos os filtros na URL', () => {
      expect(
        buildCategoryHref('jantes', {
          ...baseFilters,
          inStockOnly: true,
          brandSlugs: ['bbs', 'oz-racing'],
          priceMin: 100,
          priceMax: 900,
          vehicleMakeIds: ['make-vw'],
          vehicleModelIds: ['model-golf'],
          vehicleGenerationIds: ['gen-mk7'],
          variantSelections: [
            {
              code: 'diameter',
              values: ['18"', '19"'],
            },
            {
              code: 'pcd',
              values: ['5x120'],
            },
          ],
          sort: 'price-asc',
        }),
      ).toBe(
        '/categorias/jantes?stock=available&brand=bbs&brand=oz-racing&priceMin=100&priceMax=900&make=make-vw&model=model-golf&generation=gen-mk7&v_diameter=18%22&v_diameter=19%22&v_pcd=5x120&sort=price-asc',
      )
    })

    test('a ordenação por omissão não aparece na URL', () => {
      expect(
        buildCategoryHref('jantes', {
          ...baseFilters,
          sort: 'newest',
        }),
      ).toBe('/categorias/jantes')

      expect(
        buildCategoryHref('jantes', {
          ...baseFilters,
          sort: undefined,
        }),
      ).toBe('/categorias/jantes')
    })

    test('um override mantém os restantes filtros', () => {
      expect(
        buildCategoryHref(
          'jantes',
          {
            ...baseFilters,
            brandSlugs: ['bbs'],
            inStockOnly: true,
          },
          {
            brandSlugs: [],
          },
        ),
      ).toBe(
        '/categorias/jantes?stock=available',
      )
    })

    test('aceita apenas as ordenações suportadas', () => {
      expect(
        parseSortParam('newest'),
      ).toBe('newest')

      expect(
        parseSortParam('price-desc'),
      ).toBe('price-desc')

      expect(
        parseSortParam('name-asc'),
      ).toBeUndefined()

      expect(
        parseSortParam(undefined),
      ).toBeUndefined()
    })

    test('lê as opções de variante da query', () => {
      const parsed =
        parseVariantSelections(
          {
            v_diameter: ['18"', '19"'],
            v_pcd: '5x120',
            v_offset: 'ET45',
            v_diameter_duplicado: 'x',
            stock: 'available',
          },
          facets,
        )

      expect(
        parsed.selections,
      ).toEqual([
        {
          code: 'diameter',
          values: ['18"', '19"'],
        },
        {
          code: 'pcd',
          values: ['5x120'],
        },
      ])

      expect(
        parsed.hasInvalidValues,
      ).toBe(true)
    })

    test('rejeita valores de variante que não existem no catálogo', () => {
      const parsed =
        parseVariantSelections(
          {
            v_diameter: ['18"', '21"'],
          },
          facets,
        )

      expect(
        parsed.selections,
      ).toEqual([
        {
          code: 'diameter',
          values: ['18"'],
        },
      ])

      expect(
        parsed.hasInvalidValues,
      ).toBe(true)
    })

    test('alternar valores do mesmo eixo acumula e desmarca', () => {
      const withOne =
        toggleVariantSelection(
          [],
          'diameter',
          '19"',
        )

      expect(
        toggleVariantSelection(
          withOne,
          'diameter',
          '18"',
        ),
      ).toEqual([
        {
          code: 'diameter',
          values: ['19"', '18"'],
        },
      ])

      expect(
        toggleVariantSelection(
          withOne,
          'diameter',
          '19"',
        ),
      ).toEqual([])
    })

    test('toggleId alterna ids de marca, modelo e geração', () => {
      expect(
        toggleId(['a'], 'b'),
      ).toEqual(['a', 'b'])

      expect(
        toggleId(['a', 'b'], 'a'),
      ).toEqual(['b'])
    })

    test('selecionar uma marca restringe os modelos visíveis', () => {
      const all = getVisibleVehicleModels(
        makes,
        [],
      )

      expect(
        all.map(
          (model) => model.id,
        ),
      ).toEqual([
        'model-golf',
        'model-passat',
        'model-serie-3',
      ])

      const onlyVolkswagen =
        getVisibleVehicleModels(
          makes,
          ['make-vw'],
        )

      expect(
        onlyVolkswagen.map(
          (model) => model.id,
        ),
      ).toEqual([
        'model-golf',
        'model-passat',
      ])

      expect(
        getVisibleVehicleGenerations(
          onlyVolkswagen,
          ['model-golf'],
        ).map(
          (generation) => generation.id,
        ),
      ).toEqual([
        'gen-mk7',
        'gen-mk8',
      ])
    })

    test('normaliza a seleção de veículo contra a árvore real', () => {
      expect(
        normalizeVehicleSelections({
          makeIds: ['make-vw'],
          modelIds: ['model-serie-3'],
          generationIds: ['gen-mk7'],
          makes,
        }),
      ).toEqual({
        vehicleMakeIds: ['make-vw'],
        vehicleModelIds: [],
        vehicleGenerationIds: ['gen-mk7'],
        hasInvalid: true,
      })
    })

    test('aceita a hierarquia coerente marca > modelo > geração', () => {
      expect(
        normalizeVehicleSelections({
          makeIds: ['make-vw'],
          modelIds: ['model-golf'],
          generationIds: ['gen-mk8'],
          makes,
        }),
      ).toEqual({
        vehicleMakeIds: ['make-vw'],
        vehicleModelIds: ['model-golf'],
        vehicleGenerationIds: ['gen-mk8'],
        hasInvalid: false,
      })
    })

    test('rejeita ids de veículo inexistentes', () => {
      expect(
        normalizeVehicleSelections({
          makeIds: ['make-fantasma'],
          modelIds: ['model-fantasma'],
          generationIds: ['gen-fantasma'],
          makes,
        }),
      ).toEqual({
        vehicleMakeIds: [],
        vehicleModelIds: [],
        vehicleGenerationIds: [],
        hasInvalid: true,
      })
    })
  },
)
