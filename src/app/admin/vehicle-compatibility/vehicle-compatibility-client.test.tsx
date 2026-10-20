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
    models: [
      {
        id: 'model-golf',
        name: 'Golf',
        slug: 'golf',
        description: null,
        generations: [
          {
            id: 'generation-mk7',
            name: 'Mk7',
            platform: 'MQB',
            description: null,
            configurations: [
              {
                id: 'configuration-tdi',
                name: '2.0 TDI 150',
                engineCode: 'CRLB',
                engineType: 'Diesel',
                displacementCc: 1968,
                powerKw: 110,
                bodyType: 'Hatchback',
                yearFrom: 2012,
                yearTo: 2019,
              },
            ],
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
          url === '/api/admin/vehicle-brands'
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
          url ===
            '/api/admin/vehicle-configurations'
        ) {
          return jsonResponse(
            {
              id: 'configuration-new',
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

  test('mostra a hierarquia sem expor entidades separadas', async () => {
    render(<VehicleCompatibilityClient />)

    expect(
      await screen.findByText('Volkswagen'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Golf'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Mk7'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('2.0 TDI 150'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Motor CRLB · Diesel · 1968 cc · 110 kW · 2012–2019',
      ),
    ).toBeInTheDocument()
  })

  test('cria um motor inline na geração selecionada', async () => {
    render(<VehicleCompatibilityClient />)
    await screen.findByText('Volkswagen')

    fireEvent.click(
      screen.getByRole('button', {
        name: '+ Motor',
      }),
    )
    fireEvent.change(
      screen.getByLabelText('Motor de Mk7'),
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
      ).toMatchObject({
        generationId: 'generation-mk7',
        name: '2.0 TSI',
        engineCode: 'DNPA',
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
