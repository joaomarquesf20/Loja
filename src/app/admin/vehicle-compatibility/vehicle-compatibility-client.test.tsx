import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

import VehicleCompatibilityClient from './vehicle-compatibility-client'

const fetchMock = vi.fn()

const tree = [
  {
    id: 'make-vw',
    name: 'Volkswagen',
    slug: 'volkswagen',
    createdAt: '2026-01-01T00:00:00.000Z',
    models: [
      {
        id: 'model-golf',
        name: 'Golf',
        slug: 'golf',
        createdAt: '2026-01-01T00:00:00.000Z',
        specs: [
          {
            id: 'spec-tdi',
            engine: '2.0 TDI 150',
            engineCode: 'CRLB',
            yearStart: 2013,
            yearEnd: 2020,
            fuelType: 'DIESEL',
            powerHp: 150,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    ],
  },
]

function jsonResponse(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

describe('VehicleCompatibilityClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url

        if (
          init?.method === 'POST' &&
          url === '/api/admin/vehicle-makes'
        ) {
          return jsonResponse(
            {
              id: 'make-audi',
              name: 'Audi',
              slug: 'audi',
            },
            201,
          )
        }

        if (
          init?.method === 'POST' &&
          url === '/api/admin/vehicle-specs'
        ) {
          return jsonResponse(
            {
              id: 'spec-new',
            },
            201,
          )
        }

        if (
          url ===
          '/api/admin/vehicle-compatibility'
        ) {
          return jsonResponse(tree)
        }

        throw new Error(
          `Pedido não mockado: ${init?.method} ${url}`,
        )
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('mostra a hierarquia Make → Model → Spec', async () => {
    render(<VehicleCompatibilityClient />)

    expect(
      await screen.findByText('Volkswagen'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Golf'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('2.0 TDI 150'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Código CRLB · DIESEL · 2013–2020 · 150 cv',
      ),
    ).toBeInTheDocument()
  })

  test('cria uma especificação inline no modelo selecionado', async () => {
    render(<VehicleCompatibilityClient />)
    await screen.findByText('Volkswagen')

    fireEvent.click(
      screen.getByRole('button', {
        name: '+ Especificação',
      }),
    )
    fireEvent.change(
      screen.getByLabelText('Motor de Golf'),
      {
        target: { value: '2.0 TSI' },
      },
    )
    fireEvent.change(
      screen.getByLabelText('Código de motor'),
      {
        target: { value: 'DNPA' },
      },
    )
    fireEvent.change(
      screen.getByLabelText('Ano inicial'),
      {
        target: { value: '2013' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Criar',
      }),
    )

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) =>
          init?.method === 'POST' &&
          (init?.headers as Record<string, string>)
            ?.['Content-Type'] ===
            'application/json',
      )
      expect(post).toBeDefined()
      expect(
        JSON.parse(
          (post?.[1] as RequestInit)
            .body as string,
        ),
      ).toMatchObject({
        modelId: 'model-golf',
        engine: '2.0 TSI',
        engineCode: 'DNPA',
        fuelType: 'DIESEL',
      })
    })
  })

  test('cria uma marca inline e atualiza a hierarquia', async () => {
    render(<VehicleCompatibilityClient />)
    await screen.findByText('Volkswagen')

    fireEvent.click(
      screen.getByRole('button', {
        name: '+ Nova marca',
      }),
    )
    fireEvent.change(
      screen.getByLabelText('Nome da marca'),
      {
        target: { value: 'Audi' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Criar',
      }),
    )

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) =>
          init?.method === 'POST',
      )
      expect(post).toBeDefined()
      expect(
        JSON.parse(
          (post?.[1] as RequestInit)
            .body as string,
        ),
      ).toEqual({
        name: 'Audi',
        slug: 'audi',
      })
    })
  })
})
