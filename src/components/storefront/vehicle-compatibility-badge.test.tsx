import { cleanup, render, screen, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import VehicleCompatibilityBadge from './vehicle-compatibility-badge'

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

const storedSelection = {
  configurationId:
    'configuration-15td-sport',
  label: 'Opel Corsa B 1.5 TD Sport',
  makeSlug: 'opel',
  modelSlug: 'corsa-b',
}

const STORAGE_KEY = 'pfa-veiculo'

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
  'VehicleCompatibilityBadge',
  () => {
    test(
      'sem veículo guardado não renderiza',
      () => {
        render(
          <VehicleCompatibilityBadge productSlug="difusores-bm" />,
        )

        expect(
          screen.queryByTestId(
            'vehicle-compatibility-badge',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'compatível com o teu veículo',
      async () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(storedSelection),
        )

        fetchMock.mockResolvedValue(
          jsonResponse({
            configurationId:
              'configuration-15td-sport',
            compatible: true,
          }),
        )

        render(
          <VehicleCompatibilityBadge productSlug="difusores-bm" />,
        )

        const badge =
          await screen.findByTestId(
            'vehicle-compatibility-badge',
          )

        expect(
          badge,
        ).toHaveTextContent(
          'Compatível com o teu veículo',
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/products/difusores-bm/compatibility?configurationId=configuration-15td-sport',
        )
      },
    )

    test(
      'não compatível com o teu veículo',
      async () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(storedSelection),
        )

        fetchMock.mockResolvedValue(
          jsonResponse({
            configurationId:
              'configuration-15td-sport',
            compatible: false,
          }),
        )

        render(
          <VehicleCompatibilityBadge productSlug="difusores-bm" />,
        )

        const badge =
          await screen.findByTestId(
            'vehicle-compatibility-badge',
          )

        expect(
          badge,
        ).toHaveTextContent('Não compatível')
        expect(
          badge.textContent,
        ).not.toContain(
          'Compatível com o teu veículo',
        )
      },
    )

    test(
      'resposta sem sucesso esconde o badge',
      async () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(storedSelection),
        )

        fetchMock.mockResolvedValue(
          jsonResponse(
            {
              error:
                'Produto não encontrado',
            },
            404,
          ),
        )

        render(
          <VehicleCompatibilityBadge productSlug="missing" />,
        )

        await waitFor(() => {
          expect(
            screen.queryByTestId(
              'vehicle-compatibility-badge',
            ),
          ).not.toBeInTheDocument()
        })
      },
    )

    test(
      'erro de rede esconde o badge',
      async () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(storedSelection),
        )

        fetchMock.mockRejectedValue(
          new Error('rede em baixo'),
        )

        render(
          <VehicleCompatibilityBadge productSlug="difusores-bm" />,
        )

        await waitFor(() => {
          expect(
            screen.queryByTestId(
              'vehicle-compatibility-badge',
            ),
          ).not.toBeInTheDocument()
        })
      },
    )

    test(
      'limpar o veículo remove o badge',
      async () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(storedSelection),
        )

        fetchMock.mockResolvedValue(
          jsonResponse({
            compatible: true,
          }),
        )

        const { rerender } = render(
          <VehicleCompatibilityBadge productSlug="difusores-bm" />,
        )

        expect(
          await screen.findByTestId(
            'vehicle-compatibility-badge',
          ),
        ).toBeInTheDocument()

        window.localStorage.removeItem(
          STORAGE_KEY,
        )
        window.dispatchEvent(
          new CustomEvent(
            'pfa-veiculo-mudou',
          ),
        )

        rerender(
          <VehicleCompatibilityBadge productSlug="difusores-bm" />,
        )

        await waitFor(() => {
          expect(
            screen.queryByTestId(
              'vehicle-compatibility-badge',
            ),
          ).not.toBeInTheDocument()
        })
      },
    )
  },
)
