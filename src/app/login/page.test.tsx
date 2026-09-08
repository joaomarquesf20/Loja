import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    signIn: vi.fn(),
    useSession: vi.fn(),
    update: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
)

vi.mock(
  'next-auth/react',
  () => ({
    signIn: mocks.signIn,
    useSession:
      mocks.useSession,
  }),
)

vi.mock(
  'next/navigation',
  () => ({
    useRouter: () => ({
      replace:
        mocks.replace,
      refresh:
        mocks.refresh,
    }),
  }),
)

import LoginPage from './page'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.update.mockResolvedValue(
      null,
    )

    mocks.useSession.mockReturnValue(
      {
        data: null,
        status:
          'unauthenticated',
        update: mocks.update,
      },
    )
  })

  test('inicia sessão e regressa à loja', async () => {
    mocks.signIn.mockResolvedValue(
      {
        error: null,
        status: 200,
        ok: true,
        url: null,
      },
    )

    render(<LoginPage />)

    fireEvent.change(
      screen.getByLabelText(
        'Email',
      ),
      {
        target: {
          value:
            'cliente@example.com',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Password',
      ),
      {
        target: {
          value: 'segredo',
        },
      },
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Entrar',
        },
      ),
    )

    await waitFor(() => {
      expect(
        mocks.signIn,
      ).toHaveBeenCalledWith(
        'credentials',
        {
          email:
            'cliente@example.com',
          password:
            'segredo',
          redirect: false,
        },
      )
    })

    expect(
      mocks.update,
    ).toHaveBeenCalled()

    expect(
      mocks.replace,
    ).toHaveBeenCalledWith(
      '/',
    )

    expect(
      mocks.refresh,
    ).toHaveBeenCalled()
  })

  test('mostra erro quando as credenciais são inválidas', async () => {
    mocks.signIn.mockResolvedValue(
      {
        error:
          'CredentialsSignin',
        status: 401,
        ok: false,
        url: null,
      },
    )

    render(<LoginPage />)

    fireEvent.change(
      screen.getByLabelText(
        'Email',
      ),
      {
        target: {
          value:
            'cliente@example.com',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Password',
      ),
      {
        target: {
          value: 'errada',
        },
      },
    )

    fireEvent.click(
      screen.getByRole(
        'button',
        {
          name: 'Entrar',
        },
      ),
    )

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Email ou password inválidos.',
    )

    expect(
      mocks.update,
    ).not.toHaveBeenCalled()

    expect(
      mocks.replace,
    ).not.toHaveBeenCalled()
  })

  test('não apresenta formulário a um utilizador já autenticado', () => {
    mocks.useSession.mockReturnValue(
      {
        status:
          'authenticated',
        update: mocks.update,
        data: {
          user: {
            id: 'user-1',
            name: 'Maria',
            email:
              'maria@example.com',
            role: 'BUYER',
          },
        },
      },
    )

    render(<LoginPage />)

    expect(
      screen.getByRole(
        'heading',
        {
          name:
            'Sessão iniciada',
        },
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Maria',
      ),
    ).toBeInTheDocument()

    expect(
      screen.queryByLabelText(
        'Password',
      ),
    ).not.toBeInTheDocument()
  })
})
