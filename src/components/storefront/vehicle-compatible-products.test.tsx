import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import type { CatalogProduct } from '@/server/catalog'
import VehicleCompatibleProducts from './vehicle-compatible-products'

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
      },
    },
  )
}

function buildProduct(
  id: string,
  slug: string,
  name: string,
): CatalogProduct {
  return {
    id,
    slug,
    name,
    price: 129.9,
    sku: id.toUpperCase(),
    inStock: true,
    images: [],
    brand: {
      id: 'brand-1',
      name: 'Marca',
      slug: 'marca',
    },
    variants: [
      {
        id: `${id}-variant`,
        sku: `REF-${id.toUpperCase()}`,
      },
    ],
  } as unknown as CatalogProduct
}

const productDifusores =
  buildProduct(
    'product-difusores',
    'difusores-bm',
    'Difusores de Saias Laterais BMW',
  )
const productBicos =
  buildProduct(
    'product-bicos',
    'bicos-injetores',
    'Bicos de Injetores Opel',
  )

const storedSelection = {
  configurationId:
    'configuration-15td-sport',
  label: 'Opel Corsa B 1.5 TD Sport',
  makeSlug: 'opel',
  modelSlug: 'corsa-b',
}

const STORAGE_KEY = 'pfa-veiculo'

function seedVehicleSelection() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(storedSelection),
  )
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe(
  'VehicleCompatibleProducts',
  () => {
    test(
      'sem veículo guardado apresenta a grelha completa',
      async () => {
        render(
          <VehicleCompatibleProducts
            products={[
              productDifusores,
              productBicos,
            ]}
          />,
        )

        expect(
          screen.getByText(
            'Difusores de Saias Laterais BMW',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Bicos de Injetores Opel',
          ),
        ).toBeInTheDocument()
        expect(
          screen.queryByTestId(
            'vehicle-compatibility-banner',
          ),
        ).not.toBeInTheDocument()
        expect(
          fetchMock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'sem produtos no servidor mostra o estado vazio com CTA de filtros',
      async () => {
        render(
          <VehicleCompatibleProducts
            products={[]}
            clearFiltersHref="/categorias/molduras?clear=1"
          />,
        )

        expect(
          screen.getByText(
            'Nenhum produto encontrado',
          ),
        ).toBeInTheDocument()

        const removedFiltersLink =
          screen.getByText(
            'Remover filtros',
          )

        expect(
          removedFiltersLink.getAttribute(
            'href',
          ),
        ).toBe(
          '/categorias/molduras?clear=1',
        )
      },
    )

    test(
      'sem produtos no servidor e sem filtros ativos omite o CTA',
      async () => {
        render(
          <VehicleCompatibleProducts
            products={[]}
          />,
        )

        expect(
          screen.getByText(
            'Nenhum produto encontrado',
          ),
        ).toBeInTheDocument()
        expect(
          screen.queryByText(
            'Remover filtros',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'mostra indicador e filtra a grelha pelas peças compatíveis',
      async () => {
        seedVehicleSelection()

        fetchMock.mockResolvedValue(
          jsonResponse({
            products: [
              {
                id: 'product-difusores',
                slug: 'difusores-bm',
              },
            ],
          }),
        )

        render(
          <VehicleCompatibleProducts
            products={[
              productDifusores,
              productBicos,
            ]}
          />,
        )

        expect(
          await screen.findByTestId(
            'vehicle-compatibility-banner',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /A mostrar peças compatíveis para:/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Opel Corsa B 1.5 TD Sport',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            '1 peça compatível nesta categoria',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Difusores de Saias Laterais BMW',
          ),
        ).toBeInTheDocument()
        expect(
          screen.queryByText(
            'Bicos de Injetores Opel',
          ),
        ).not.toBeInTheDocument()

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/configurations/configuration-15td-sport/products',
        )
      },
    )

    test(
      'esconde a grelha enquanto verifica a compatibilidade',
      async () => {
        seedVehicleSelection()

        fetchMock.mockReturnValue(
          new Promise<Response>(() => {}),
        )

        render(
          <VehicleCompatibleProducts
            products={[
              productDifusores,
              productBicos,
            ]}
          />,
        )

        expect(
          await screen.findByText(
            'A verificar compatibilidade…',
          ),
        ).toBeInTheDocument()
        expect(
          screen.queryByText(
            'Difusores de Saias Laterais BMW',
          ),
        ).not.toBeInTheDocument()
        expect(
          screen.queryByText(
            'Bicos de Injetores Opel',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'sem peças compatíveis mostra estado vazio dedicado',
      async () => {
        seedVehicleSelection()

        fetchMock.mockResolvedValue(
          jsonResponse({
            products: [],
          }),
        )

        render(
          <VehicleCompatibleProducts
            products={[
              productDifusores,
              productBicos,
            ]}
          />,
        )

        expect(
          await screen.findByText(
            'Nenhuma peça compatível com Opel Corsa B 1.5 TD Sport',
          ),
        ).toBeInTheDocument()
        expect(
          screen
            .getAllByRole('button', {
              name: 'Limpar',
            })
            .length,
        ).toBeGreaterThan(0)
        expect(
          screen.queryByText(
            'Difusores de Saias Laterais BMW',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'falha aberta: erro de rede mostra o catálogo completo',
      async () => {
        seedVehicleSelection()

        fetchMock.mockRejectedValue(
          new Error('rede em baixo'),
        )

        render(
          <VehicleCompatibleProducts
            products={[
              productDifusores,
              productBicos,
            ]}
          />,
        )

        expect(
          await screen.findByText(
            /Não foi possível verificar a compatibilidade/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Difusores de Saias Laterais BMW',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Bicos de Injetores Opel',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'Limpar restaura a grelha completa',
      async () => {
        seedVehicleSelection()

        fetchMock.mockResolvedValue(
          jsonResponse({
            products: [
              {
                id: 'product-difusores',
                slug: 'difusores-bm',
              },
            ],
          }),
        )

        render(
          <VehicleCompatibleProducts
            products={[
              productDifusores,
              productBicos,
            ]}
          />,
        )

        await screen.findByText(
          'Opel Corsa B 1.5 TD Sport',
        )

        fireEvent.click(
          screen.getByRole('button', {
            name: 'Limpar',
          }),
        )

        await waitFor(() => {
          expect(
            screen.queryByTestId(
              'vehicle-compatibility-banner',
            ),
          ).not.toBeInTheDocument()
        })

        expect(
          screen.getByText(
            'Difusores de Saias Laterais BMW',
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Bicos de Injetores Opel',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'Mudar veículo abre o selector em cascata embebido',
      async () => {
        seedVehicleSelection()

        fetchMock.mockResolvedValue(
          jsonResponse({
            products: [
              {
                id: 'product-difusores',
                slug: 'difusores-bm',
              },
            ],
          }),
        )

        render(
          <VehicleCompatibleProducts
            products={[productDifusores]}
          />,
        )

        await screen.findByText(
          'Opel Corsa B 1.5 TD Sport',
        )

        expect(
          screen.queryByLabelText('Marca'),
        ).not.toBeInTheDocument()
        expect(
          screen.getByText('Mudar veículo'),
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByText('Mudar veículo'),
        )

        expect(
          await screen.findByLabelText(
            'Marca',
          ),
        ).toBeInTheDocument()

        const changeButton =
          screen.getByText(
            'Fechar selector',
          )
        expect(
          changeButton.getAttribute(
            'aria-expanded',
          ),
        ).toBe('true')
      },
    )
  },
)
