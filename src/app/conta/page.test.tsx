import {
  render,
  screen,
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
    useSession: vi.fn(),
  }),
)

vi.mock(
  'next-auth/react',
  () => ({
    useSession:
      mocks.useSession,
  }),
)

import AccountPage from './page'

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useSession.mockReturnValue(
      {
        data: null,
        status:
          'unauthenticated',
      },
    )
  })

  test('não apresenta dados da conta enquanto a sessão está a carregar', () => {
    mocks.useSession.mockReturnValue(
      {
        data: null,
        status: 'loading',
      },
    )

    render(<AccountPage />)

    expect(
      screen.getByText(
        'A verificar sessão…',
      ),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole(
        'heading',
        {
          name: 'A minha conta',
        },
      ),
    ).not.toBeInTheDocument()
  })

  test('encaminha utilizador sem sessão para o login', () => {
    render(<AccountPage />)

    expect(
      screen.getByRole(
        'heading',
        {
          name: 'Inicia sessão',
        },
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByRole(
        'link',
        {
          name: 'Entrar',
        },
      ),
    ).toHaveAttribute(
      'href',
      '/login',
    )

    expect(
      screen.queryByText(
        'Ver carrinho',
      ),
    ).not.toBeInTheDocument()
  })

  test('mostra dados reais da sessão autenticada', () => {
    mocks.useSession.mockReturnValue(
      {
        status:
          'authenticated',
        data: {
          user: {
            id: 'user-1',
            name: 'Maria Silva',
            email:
              'maria@example.com',
            role: 'BUYER',
          },
        },
      },
    )

    render(<AccountPage />)

    expect(
      screen.getByRole(
        'heading',
        {
          name: 'A minha conta',
        },
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Maria Silva',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'maria@example.com',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByRole(
        'link',
        {
          name: 'Ver carrinho',
        },
      ),
    ).toHaveAttribute(
      'href',
      '/carrinho',
    )

    expect(
      screen.getByRole(
        'link',
        {
          name:
            'Continuar a comprar',
        },
      ),
    ).toHaveAttribute(
      'href',
      '/',
    )
  })

  test('não inventa dados ausentes na sessão', () => {
    mocks.useSession.mockReturnValue(
      {
        status:
          'authenticated',
        data: {
          user: {
            id: 'user-1',
            name: null,
            email: null,
            role: 'BUYER',
          },
        },
      },
    )

    render(<AccountPage />)

    expect(
      screen.getAllByText(
        'Não definido',
      ),
    ).toHaveLength(2)

    expect(
      screen.queryByText(
        'Encomendas',
      ),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText(
        'Moradas',
      ),
    ).not.toBeInTheDocument()
  })
})
