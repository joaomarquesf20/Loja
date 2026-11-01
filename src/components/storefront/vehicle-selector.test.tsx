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
    id: 'make-opel',
    name: 'Opel',
    slug: 'opel',
  },
  {
    id: 'make-bmw',
    name: 'BMW',
    slug: 'bmw',
  },
]

const corsaModels = [
  {
    id: 'model-corsa-b',
    name: 'Corsa B',
    slug: 'corsa-b',
  },
]

const corsaSpecs = [
  {
    id: 'spec-15td-sport',
    engine: '1.5 TD Sport',
    engineCode: 'X15DT',
    yearStart: 1993,
    yearEnd: 2000,
    fuelType: 'DIESEL',
    powerHp: 73,
  },
  {
    id: 'spec-15td',
    engine: '1.5 TD',
    engineCode: '4EC1-T',
    yearStart: 1993,
    yearEnd: 2000,
    fuelType: 'DIESEL',
    powerHp: 67,
  },
]

const storedSelection = {
  specId: 'spec-15td-sport',
  label: 'Opel Corsa B 1.5 TD Sport',
  makeId: 'make-opel',
  modelId: 'model-corsa-b',
}

const STORAGE_KEY = 'pfa-veiculo'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockImplementation(
    (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/vehicles/makes') {
        return Promise.resolve(
          jsonResponse({ makes }),
        )
      }

      if (
        url ===
        '/api/vehicles/models?makeId=make-opel'
      ) {
        return Promise.resolve(
          jsonResponse({ models: corsaModels }),
        )
      }

      if (
        url ===
        '/api/vehicles/specs?modelId=model-corsa-b'
      ) {
        return Promise.resolve(
          jsonResponse({ specs: corsaSpecs }),
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
                jsonResponse({ makes }),
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
      'carrega modelos e especificações em cascata',
      async () => {
        render(<VehicleSelector />)

        await screen.findByText('Opel')

        fireEvent.change(
          screen.getByLabelText('Marca'),
          { target: { value: 'make-opel' } },
        )

        expect(
          await screen.findByText(
            /Corsa B/,
          ),
        ).toBeInTheDocument()
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/models?makeId=make-opel',
        )

        fireEvent.change(
          screen.getByLabelText('Modelo'),
          {
            target: {
              value: 'model-corsa-b',
            },
          },
        )

        expect(
          await screen.findByText(
            '1.5 TD Sport (X15DT) · 1993–2000',
          ),
        ).toBeInTheDocument()
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/specs?modelId=model-corsa-b',
        )
      },
    )

    test(
      'guarda a seleção ao escolher a especificação',
      async () => {
        render(<VehicleSelector />)

        await screen.findByText('Opel')
        fireEvent.change(
          screen.getByLabelText('Marca'),
          { target: { value: 'make-opel' } },
        )
        await screen.findByText('Corsa B')
        fireEvent.change(
          screen.getByLabelText('Modelo'),
          {
            target: {
              value: 'model-corsa-b',
            },
          },
        )
        await screen.findByText(
          '1.5 TD Sport (X15DT) · 1993–2000',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Especificação',
          ),
          {
            target: {
              value: 'spec-15td-sport',
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
          ).toHaveValue('make-opel'),
        )

        const modelSelect =
          screen.getByLabelText('Modelo')

        await waitFor(() =>
          expect(
            modelSelect,
          ).toHaveValue('model-corsa-b'),
        )

        const specSelect =
          screen.getByLabelText(
            'Especificação',
          )

        await waitFor(() =>
          expect(
            specSelect,
          ).toHaveValue(
            'spec-15td-sport',
          ),
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/models?makeId=make-opel',
        )
        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/vehicles/specs?modelId=model-corsa-b',
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
