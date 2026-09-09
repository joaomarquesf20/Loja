import {
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
import { AddressesClient } from './addresses-client'

const fetchMock = vi.fn()
const confirmMock = vi.fn()

function createAddress(
  overrides: Partial<{
    id: string
    name: string
    addressLine1: string
    addressLine2: string | null
    city: string
    postalCode: string
    country: string
  }> = {},
) {
  return {
    id: 'address-1',
    name: 'Maria Silva',
    addressLine1:
      'Rua Central 10',
    addressLine2: null,
    city: 'Porto',
    postalCode: '4000-001',
    country: 'Portugal',
    ...overrides,
  }
}

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

describe('AddressesClient', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    confirmMock.mockReset()

    confirmMock.mockReturnValue(
      true,
    )

    vi.stubGlobal(
      'fetch',
      fetchMock,
    )

    vi.stubGlobal(
      'confirm',
      confirmMock,
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('carrega e apresenta moradas guardadas', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        addresses: [
          createAddress(),
        ],
      }),
    )

    render(<AddressesClient />)

    expect(
      screen.getByText(
        'A carregar moradas…',
      ),
    ).toBeInTheDocument()

    expect(
      await screen.findByText(
        'Rua Central 10',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        '4000-001 Porto',
      ),
    ).toBeInTheDocument()

    expect(
      fetchMock,
    ).toHaveBeenCalledWith(
      '/api/addresses',
      {
        method: 'GET',
        cache: 'no-store',
      },
    )
  })

  test('mostra estado vazio sem inventar moradas', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        addresses: [],
      }),
    )

    render(<AddressesClient />)

    expect(
      await screen.findByText(
        'Ainda não tens moradas guardadas.',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByRole(
        'heading',
        {
          name: 'Adicionar morada',
        },
      ),
    ).toBeInTheDocument()
  })

  test('mostra erro de carregamento e permite tentar novamente', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Erro interno do servidor',
          },
          500,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          addresses: [],
        }),
      )

    render(<AddressesClient />)

    const alert =
      await screen.findByRole(
        'alert',
      )

    expect(
      alert,
    ).toHaveTextContent(
      'Erro interno do servidor',
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Tentar novamente',
        },
      ),
    )

    expect(
      await screen.findByText(
        'Ainda não tens moradas guardadas.',
      ),
    ).toBeInTheDocument()

    expect(
      fetchMock,
    ).toHaveBeenCalledTimes(2)
  })

  test('cria uma morada através da API', async () => {
    const address =
      createAddress()

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          addresses: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            address,
          },
          201,
        ),
      )

    render(<AddressesClient />)

    await screen.findByText(
      'Ainda não tens moradas guardadas.',
    )

    fireEvent.change(
      screen.getByLabelText(
        'Nome',
      ),
      {
        target: {
          value: 'Maria Silva',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Morada',
      ),
      {
        target: {
          value:
            'Rua Central 10',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Localidade',
      ),
      {
        target: {
          value: 'Porto',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Código postal',
      ),
      {
        target: {
          value: '4000-001',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'País',
      ),
      {
        target: {
          value: 'Portugal',
        },
      },
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Guardar morada',
        },
      ),
    )

    expect(
      await screen.findByText(
        'Rua Central 10',
      ),
    ).toBeInTheDocument()

    expect(
      fetchMock,
    ).toHaveBeenCalledTimes(2)

    expect(
      fetchMock.mock.calls[1]?.[0],
    ).toBe('/api/addresses')

    expect(
      fetchMock.mock.calls[1]?.[1],
    ).toMatchObject({
      method: 'POST',
    })

    const options =
      fetchMock.mock
        .calls[1]?.[1] as
        | RequestInit
        | undefined

    expect(
      JSON.parse(
        String(options?.body),
      ),
    ).toEqual({
      name: 'Maria Silva',
      addressLine1:
        'Rua Central 10',
      addressLine2: '',
      city: 'Porto',
      postalCode: '4000-001',
      country: 'Portugal',
    })

    expect(
      screen.getByLabelText(
        'Nome',
      ),
    ).toHaveValue('')
  })

  test('edita uma morada existente', async () => {
    const address =
      createAddress()

    const updatedAddress =
      createAddress({
        city: 'Lisboa',
        postalCode: '1000-001',
      })

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          addresses: [
            address,
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          address:
            updatedAddress,
        }),
      )

    render(<AddressesClient />)

    await screen.findByText(
      'Rua Central 10',
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Editar',
        },
      ),
    )

    expect(
      screen.getByRole(
        'heading',
        {
          name: 'Editar morada',
        },
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText(
        'Nome',
      ),
    ).toHaveValue(
      'Maria Silva',
    )

    fireEvent.change(
      screen.getByLabelText(
        'Localidade',
      ),
      {
        target: {
          value: 'Lisboa',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Código postal',
      ),
      {
        target: {
          value: '1000-001',
        },
      },
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name:
            'Guardar alterações',
        },
      ),
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          '1000-001 Lisboa',
        ),
      ).toBeInTheDocument()
    })

    const options =
      fetchMock.mock
        .calls[1]?.[1] as
        | RequestInit
        | undefined

    expect(
      options?.method,
    ).toBe('PATCH')

    expect(
      JSON.parse(
        String(options?.body),
      ),
    ).toEqual({
      addressId: 'address-1',
      name: 'Maria Silva',
      addressLine1:
        'Rua Central 10',
      addressLine2: '',
      city: 'Lisboa',
      postalCode: '1000-001',
      country: 'Portugal',
    })

    expect(
      screen.getByRole(
        'heading',
        {
          name: 'Adicionar morada',
        },
      ),
    ).toBeInTheDocument()
  })

  test('permite cancelar a edição sem alterar a morada', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        addresses: [
          createAddress(),
        ],
      }),
    )

    render(<AddressesClient />)

    await screen.findByText(
      'Rua Central 10',
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Editar',
        },
      ),
    )

    fireEvent.change(
      screen.getByLabelText(
        'Localidade',
      ),
      {
        target: {
          value: 'Lisboa',
        },
      },
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Cancelar edição',
        },
      ),
    )

    expect(
      screen.getByRole(
        'heading',
        {
          name: 'Adicionar morada',
        },
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText(
        'Localidade',
      ),
    ).toHaveValue('')

    expect(
      screen.getByText(
        '4000-001 Porto',
      ),
    ).toBeInTheDocument()

    expect(
      fetchMock,
    ).toHaveBeenCalledTimes(1)
  })

  test('apaga uma morada depois de confirmação', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          addresses: [
            createAddress(),
          ],
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        }),
      )

    render(<AddressesClient />)

    await screen.findByText(
      'Rua Central 10',
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Remover',
        },
      ),
    )

    expect(
      confirmMock,
    ).toHaveBeenCalledWith(
      'Queres mesmo apagar esta morada?',
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Ainda não tens moradas guardadas.',
        ),
      ).toBeInTheDocument()
    })

    const options =
      fetchMock.mock
        .calls[1]?.[1] as
        | RequestInit
        | undefined

    expect(
      options?.method,
    ).toBe('DELETE')

    expect(
      JSON.parse(
        String(options?.body),
      ),
    ).toEqual({
      addressId: 'address-1',
    })
  })

  test('não apaga a morada quando a confirmação é cancelada', async () => {
    confirmMock.mockReturnValue(
      false,
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        addresses: [
          createAddress(),
        ],
      }),
    )

    render(<AddressesClient />)

    await screen.findByText(
      'Rua Central 10',
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Remover',
        },
      ),
    )

    expect(
      screen.getByText(
        'Rua Central 10',
      ),
    ).toBeInTheDocument()

    expect(
      fetchMock,
    ).toHaveBeenCalledTimes(1)
  })

  test('mostra erro devolvido pela API sem apagar os dados do formulário', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          addresses: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Código postal inválido',
          },
          400,
        ),
      )

    render(<AddressesClient />)

    await screen.findByText(
      'Ainda não tens moradas guardadas.',
    )

    fireEvent.change(
      screen.getByLabelText(
        'Nome',
      ),
      {
        target: {
          value: 'Maria Silva',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Morada',
      ),
      {
        target: {
          value:
            'Rua Central 10',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Localidade',
      ),
      {
        target: {
          value: 'Porto',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Código postal',
      ),
      {
        target: {
          value: 'inválido',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'País',
      ),
      {
        target: {
          value: 'Portugal',
        },
      },
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Guardar morada',
        },
      ),
    )

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Código postal inválido',
    )

    expect(
      screen.getByLabelText(
        'Código postal',
      ),
    ).toHaveValue(
      'inválido',
    )

    expect(
      screen.getByLabelText(
        'Nome',
      ),
    ).toHaveValue(
      'Maria Silva',
    )
  })
})
