import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import VehicleSelector from './vehicle-selector'

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

const makes = [
  {
    id: 'brand-opel',
    name: 'Opel',
    slug: 'opel',
  },
  {
    id: 'brand-bmw',
    name: 'BMW',
    slug: 'dev-bmw',
  },
]

const corsaModels = [
  {
    id: 'model-corsa-b',
    name: 'Corsa B',
    slug: 'corsa-b',
  },
]

const corsaGenerations = [
  {
    id: 'generation-corsa-b',
    name: 'Corsa B (1993-2000)',
    configurations: [
      {
        id: 'configuration-15td-sport',
        name: '1.5 TD Sport',
        engineCode: 'X15DT',
        powerKw: '54',
      },
      {
        id: 'configuration-15td',
        name: '1.5 TD',
        engineCode: '4EC1-T',
        powerKw: '49',
      },
    ],
  },
]

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
  fetchMock.mockImplementation(
    (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/vehicles/makes') {
        return Promise.resolve(
          jsonResponse(makes),
        )
      }

      if (
        url ===
        '/api/vehicles/makes/opel/models'
      ) {
        return Promise.resolve(
          jsonResponse(corsaModels),
        )
      }

      if (
        url ===
        '/api/vehicles/models/corsa-b/generations'
      ) {
        return Promise.resolve(
          jsonResponse(
            corsaGenerations,
          ),
        )
      }

      return Promise.reject(
        new Error(
          `URL inesperado no teste: ${url}`,
        ),
      )
    },
  )

  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe(
  'VehicleSelector',
  () => {
    test(
      'carrega as marcas no arranque',
      async () => {
        render(<VehicleSelector />)

        expect(
          await screen.findByText('Opel'),
        ).toBeInTheDocument()
        expect(
          screen.getByText('BMW'),
        ).toBeInTheDocument()
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/makes',
        )

        const makeSelect =
          screen.getByLabelText('Marca')

        expect(
          makeSelect,
        ).toHaveValue('')
      },
    )

    test(
      'mostra erro quando as marcas falham e recupera com o botão de retry',
      async () => {
        fetchMock.mockImplementation(
          (input: RequestInfo | URL) => {
            if (
              String(input) ===
              '/api/vehicles/makes'
            ) {
              return (
                Promise.resolve(
                  jsonResponse(
                    {},
                    500,
                  ),
                )
              )
            }

            return Promise.reject(
              new Error('url inesperada'),
            )
          },
        )
        render(<VehicleSelector />)

        expect(
          await screen.findByRole('alert'),
        ).toHaveTextContent(
          'Não foi possível carregar as marcas de veículo',
        )

        fetchMock.mockImplementation(
          (input: RequestInfo | URL) => {
            if (
              String(input) ===
              '/api/vehicles/makes'
            ) {
              return Promise.resolve(
                jsonResponse(makes),
              )
            }

            return Promise.reject(
              new Error('url inesperada'),
            )
          },
        )

        fireEvent.click(
          screen.getByText('Tentar novamente'),
        )

        expect(
          await screen.findByText('Opel'),
        ).toBeInTheDocument()
      },
    )

    test(
      'carrega modelos e configurações em cascata',
      async () => {
        render(<VehicleSelector />)

        await screen.findByText('Opel')

        fireEvent.change(
          screen.getByLabelText('Marca'),
          { target: { value: 'opel' } },
        )

        expect(
          await screen.findByText(
            /Corsa B/,
          ),
        ).toBeInTheDocument()
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/makes/opel/models',
        )

        fireEvent.change(
          screen.getByLabelText('Modelo'),
          {
            target: {
              value: 'corsa-b',
            },
          },
        )

        expect(
          await screen.findByText(
            '1.5 TD Sport (X15DT)',
          ),
        ).toBeInTheDocument()
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/models/corsa-b/generations',
        )
      },
    )

    test(
      'guarda a seleção ao escolher a configuração',
      async () => {
        render(<VehicleSelector />)

        await screen.findByText('Opel')
        fireEvent.change(
          screen.getByLabelText('Marca'),
          { target: { value: 'opel' } },
        )
        await screen.findByText('Corsa B')
        fireEvent.change(
          screen.getByLabelText('Modelo'),
          {
            target: {
              value: 'corsa-b',
            },
          },
        )
        await screen.findByText(
          '1.5 TD Sport (X15DT)',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Configuração',
          ),
          {
            target: {
              value:
                'configuration-15td-sport',
            },
          },
        )

        expect(
          await screen.findByText(
            /Veículo guardado:/,
          ),
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Opel Corsa B 1.5 TD Sport',
          ),
        ).toBeInTheDocument()
        expect(
          window.localStorage.getItem(
            STORAGE_KEY,
          ),
        ).toBe(
          JSON.stringify(storedSelection),
        )
      },
    )

    test(
      'pré-seleciona a cascata a partir do veículo guardado',
      async () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(storedSelection),
        )

        render(<VehicleSelector />)

        expect(
          await screen.findByText(
            /Veículo guardado:/,
          ),
        ).toBeInTheDocument()

        const makeSelect =
          screen.getByLabelText('Marca')

        await waitFor(() =>
          expect(
            makeSelect,
          ).toHaveValue('opel'),
        )

        const modelSelect =
          screen.getByLabelText('Modelo')

        await waitFor(() =>
          expect(
            modelSelect,
          ).toHaveValue('corsa-b'),
        )

        const configurationSelect =
          screen.getByLabelText(
            'Configuração',
          )

        await waitFor(() =>
          expect(
            configurationSelect,
          ).toHaveValue(
            'configuration-15td-sport',
          ),
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/makes/opel/models',
        )
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/models/corsa-b/generations',
        )
      },
    )

    test(
      'limpa o veículo guardado',
      async () => {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(storedSelection),
        )

        render(<VehicleSelector />)

        expect(
          await screen.findByText(
            /Veículo guardado:/,
          ),
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByText('Limpar'),
        )

        expect(
          await screen.findByText(
            'Nenhum veículo guardado',
          ),
        ).toBeInTheDocument()

        expect(
          window.localStorage.getItem(
            STORAGE_KEY,
          ),
        ).toBeNull()
      },
    )
  },
)
