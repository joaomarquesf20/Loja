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
  getVisibleVehicleSpecs,
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
  vehicleSpecIds: [],
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
        makeId: 'make-vw',
        productCount: 2,
        specs: [
          {
            id: 'spec-gtd',
            engine: '2.0 TDI GTD',
            engineCode: 'CRLB',
            yearStart: 2013,
            yearEnd: 2020,
            fuelType: 'DIESEL',
            powerHp: 184,
            modelId: 'model-golf',
            productCount: 1,
          },
          {
            id: 'spec-gti',
            engine: '2.0 TSI GTI',
            engineCode: null,
            yearStart: 2013,
            yearEnd: 2020,
            fuelType: 'GASOLINA',
            powerHp: 220,
            modelId: 'model-golf',
            productCount: 1,
          },
        ],
      },
      {
        id: 'model-passat',
        name: 'Passat',
        makeId: 'make-vw',
        productCount: 1,
        specs: [
          {
            id: 'spec-passat-20tdi',
            engine: '2.0 TDI',
            engineCode: 'DFGA',
            yearStart: 2015,
            yearEnd: null,
            fuelType: 'DIESEL',
            powerHp: 150,
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
        makeId: 'make-bmw',
        productCount: 1,
        specs: [
          {
            id: 'spec-f30-18d',
            engine: '318d',
            engineCode: 'N47D20C1',
            yearStart: 2011,
            yearEnd: 2015,
            fuelType: 'DIESEL',
            powerHp: 143,
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
          vehicleSpecIds: ['spec-gtd'],
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
        '/categorias/jantes?stock=available&brand=bbs&brand=oz-racing&priceMin=100&priceMax=900&make=make-vw&model=model-golf&spec=spec-gtd&v_diameter=18%22&v_diameter=19%22&v_pcd=5x120&sort=price-asc',
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

    test('toggleId alterna ids de marca, modelo e especificação', () => {
      expect(
        toggleId(['a'], 'b'),
      ).toEqual(['a', 'b'])

      expect(
        toggleId(['a', 'b'], 'a'),
      ).toEqual(['b'])
    })

    test('selecionar uma marca restringe os modelos e especificações visíveis', () => {
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
        getVisibleVehicleSpecs(
          onlyVolkswagen,
          [],
        ).map((spec) => spec.id),
      ).toEqual([
        'spec-gtd',
        'spec-gti',
        'spec-passat-20tdi',
      ])

      expect(
        getVisibleVehicleSpecs(
          onlyVolkswagen,
          ['model-golf'],
        ).map((spec) => spec.id),
      ).toEqual([
        'spec-gtd',
        'spec-gti',
      ])
    })

    test('normaliza a seleção de veículo contra a árvore real', () => {
      expect(
        normalizeVehicleSelections({
          makeIds: ['make-vw'],
          modelIds: ['model-serie-3'],
          specIds: ['spec-gtd'],
          makes,
        }),
      ).toEqual({
        vehicleMakeIds: ['make-vw'],
        vehicleModelIds: [],
        vehicleSpecIds: ['spec-gtd'],
        hasInvalid: true,
      })
    })

    test('aceita a hierarquia coerente marca > modelo > especificação', () => {
      expect(
        normalizeVehicleSelections({
          makeIds: ['make-vw'],
          modelIds: ['model-golf'],
          specIds: ['spec-gti'],
          makes,
        }),
      ).toEqual({
        vehicleMakeIds: ['make-vw'],
        vehicleModelIds: ['model-golf'],
        vehicleSpecIds: ['spec-gti'],
        hasInvalid: false,
      })
    })

    test('rejeita ids de veículo inexistentes', () => {
      expect(
        normalizeVehicleSelections({
          makeIds: ['make-fantasma'],
          modelIds: ['model-fantasma'],
          specIds: ['spec-fantasma'],
          makes,
        }),
      ).toEqual({
        vehicleMakeIds: [],
        vehicleModelIds: [],
        vehicleSpecIds: [],
        hasInvalid: true,
      })
    })
  },
)
