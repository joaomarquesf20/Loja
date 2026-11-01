import {
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

import SettingsPage from './page'

const brandingPayload = {
  branding: {
    storeName: 'Officine Rossi',
    contactEmail: 'geral@officine.example',
    contactPhone: null,
    nif: null,
    address: null,
    primaryColorHex: '#0f766e',
    logoUrl: '/brand/logo-horizontal.png',
    brandCssVariables: '',
  },
  raw: {
    storeName: 'Officine Rossi',
    contactEmail: null,
    contactPhone: null,
    nif: null,
    address: null,
    primaryColorHex: null,
    logoUrl: null,
  },
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  vi.stubGlobal('fetch', fetchMock)
})

describe('admin settings page (white-label)', () => {
  test('carrega as configurações e pré preenche o formulário', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(brandingPayload), {
        status: 200,
      }),
    )

    render(<SettingsPage />)

    await waitFor(() => {
      expect(
        screen.queryByText(
          'A carregar configurações...',
        ),
      ).toBeNull()
    })

    expect(
      fetchMock,
    ).toHaveBeenCalledWith(
      '/api/admin/settings',
      expect.objectContaining({
        signal: expect.anything(),
      }),
    )

    const storeName = screen.getByLabelText(
      'Nome da loja',
    ) as HTMLInputElement

    expect(storeName.value).toBe(
      'Officine Rossi',
    )

    // raw sem cor configurada → form usa o default do template.
    const color =
      screen.getByLabelText(
        'Cor da loja (hex)',
      ) as HTMLInputElement

    expect(color.value).toBe('#ef5b2a')
  })

  test('grava identidade via PATCH e mostra mensagem de êxito', async () => {
    fetchMock.mockImplementation(
      async (input: unknown) => {
        if (
          typeof input === 'object' &&
          input !== null &&
          (input as Request).method ===
            'PATCH'
        ) {
          return new Response(
            JSON.stringify({
              branding:
                brandingPayload.branding,
            }),
            { status: 200 },
          )
        }

        return new Response(
          JSON.stringify(
            brandingPayload,
          ),
          { status: 200 },
        )
      },
    )

    render(<SettingsPage />)

    await waitFor(() => {
      expect(
        screen.queryByText(
          'A carregar configurações...',
        ),
      ).toBeNull()
    })

    fireEvent.change(
      screen.getByLabelText('NIF'),
      {
        target: {
          value: 'PT501234567',
        },
      },
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Guardar configurações',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('status'),
      ).toHaveTextContent(
        'Configurações guardadas',
      )
    })

    const patchCall = fetchMock.mock.calls.find(
      (call) =>
        String(call[0]).endsWith(
          '/api/admin/settings',
        ) &&
        (call[1] as RequestInit)?.method ===
          'PATCH',
    )

    expect(patchCall).toBeTruthy()

    const body = JSON.parse(
      String(
        (patchCall![1] as RequestInit)
          .body,
      ),
    )

    expect(body).toMatchObject({
      storeName: 'Officine Rossi',
      nif: 'PT501234567',
      contactEmail: '',
    })
  })

  test('valida client-side: nome obrigatório antes de chamar a API', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...brandingPayload,
          raw: { ...brandingPayload.raw, storeName: '' },
          branding: {
            ...brandingPayload.branding,
            storeName: 'AutoParts',
          },
        }),
        { status: 200 },
      ),
    )

    render(<SettingsPage />)

    await waitFor(() => {
      expect(
        screen.queryByText(
          'A carregar configurações...',
        ),
      ).toBeNull()
    })

    const storeName =
      screen.getByLabelText(
        'Nome da loja',
      ) as HTMLInputElement

    fireEvent.change(storeName, {
      target: { value: '' },
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Guardar configurações',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('alert'),
      ).toHaveTextContent(
        'O nome da loja é obrigatório',
      )
    })
  })

  test('mostra o erro de validação da API (400)', async () => {
    fetchMock.mockImplementation(
      async (input: unknown) => {
        if (
          typeof input === 'object' &&
          input !== null &&
          (input as Request).method ===
            'PATCH'
        ) {
          return new Response(
            JSON.stringify({
              error:
                'A cor da loja deve ser um hex #RRGGBB',
            }),
            { status: 400 },
          )
        }

        return new Response(
          JSON.stringify(brandingPayload),
          { status: 200 },
        )
      },
    )

    render(<SettingsPage />)

    await waitFor(() => {
      expect(
        screen.queryByText(
          'A carregar configurações...',
        ),
      ).toBeNull()
    })

    fireEvent.change(
      screen.getByLabelText(
        'Cor da loja (hex)',
      ),
      {
        target: { value: 'cor-laranja' },
      },
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Guardar configurações',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('alert'),
      ).toHaveTextContent(
        'A cor da loja deve ser um hex #RRGGBB',
      )
    })
  })
})
