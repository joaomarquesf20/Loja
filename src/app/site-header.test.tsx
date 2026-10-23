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
    usePathname: vi.fn(),
    useSession: vi.fn(),
    signOut: vi.fn(),
  }),
)

vi.mock(
  'next/navigation',
  () => ({
    usePathname:
      mocks.usePathname,
  }),
)

vi.mock(
  'next-auth/react',
  () => ({
    useSession:
      mocks.useSession,
    signOut: mocks.signOut,
  }),
)

import SiteHeader from './site-header'

function openAccountMenu() {
  fireEvent.click(
    screen.getByRole(
      'button',
      {
        name: 'Conta',
      },
    ),
  )
}

describe('SiteHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.usePathname.mockReturnValue(
      '/',
    )

    mocks.useSession.mockReturnValue(
      {
        data: null,
        status:
          'unauthenticated',
      },
    )

    mocks.signOut.mockResolvedValue(
      undefined,
    )
  })

  test('mostra navegação pública quando não existe sessão', () => {
    render(<SiteHeader />)

    expect(
      screen.getByRole('link', {
        name: 'PFAUTOPARTS',
      }),
    ).toHaveAttribute(
      'href',
      '/',
    )

    expect(
      screen.getByRole('link', {
        name: 'Carrinho',
      }),
    ).toHaveAttribute(
      'href',
      '/carrinho',
    )

    expect(
      screen.getByRole('link', {
        name: 'Criar conta',
      }),
    ).toHaveAttribute(
      'href',
      '/registar',
    )

    expect(
      screen.getByRole('link', {
        name: 'Entrar',
      }),
    ).toHaveAttribute(
      'href',
      '/login',
    )

    expect(
      screen.queryByRole(
        'button',
        {
          name: 'Sair',
        },
      ),
    ).not.toBeInTheDocument()
  })

  test('não apresenta autenticação enquanto a sessão está a carregar', () => {
    mocks.useSession.mockReturnValue(
      {
        data: null,
        status: 'loading',
      },
    )

    render(<SiteHeader />)

    expect(
      screen.getByText(
        'A verificar sessão…',
      ),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole(
        'link',
        {
          name: 'Criar conta',
        },
      ),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole(
        'link',
        {
          name: 'Entrar',
        },
      ),
    ).not.toBeInTheDocument()
  })

  test('mostra utilizador autenticado dentro do menu de conta', () => {
    mocks.useSession.mockReturnValue(
      {
        status:
          'authenticated',
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

    render(<SiteHeader />)
    openAccountMenu()

    expect(
      screen.getByRole(
        'menuitem',
        {
          name: 'Maria',
        },
      ),
    ).toHaveAttribute(
      'href',
      '/conta',
    )

    expect(
      screen.getByRole(
        'menuitem',
        {
          name: 'Maria',
        },
      ),
    ).toHaveAttribute(
      'title',
      'maria@example.com',
    )

    expect(
      screen.getByRole(
        'menuitem',
        {
          name: 'Sair',
        },
      ),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole(
        'link',
        {
          name:
            'Administração',
        },
      ),
    ).not.toBeInTheDocument()
  })

  test('mostra acesso à administração apenas no menu de conta de ADMIN', () => {
    mocks.useSession.mockReturnValue(
      {
        status:
          'authenticated',
        data: {
          user: {
            id: 'admin-1',
            name: 'Admin',
            email:
              'admin@example.com',
            role: 'ADMIN',
          },
        },
      },
    )

    render(<SiteHeader />)
    openAccountMenu()

    expect(
      screen.getByRole('menuitem', {
        name:
          'Administração',
      }),
    ).toHaveAttribute(
      'href',
      '/admin',
    )

    expect(
      screen.getByRole(
        'menuitem',
        {
          name: 'Admin',
        },
      ),
    ).toHaveAttribute(
      'href',
      '/conta',
    )
  })

  test('não mostra o cabeçalho público dentro do admin', () => {
    mocks.usePathname.mockReturnValue(
      '/admin/products',
    )

    render(<SiteHeader />)

    expect(
      screen.queryByRole(
        'banner',
      ),
    ).not.toBeInTheDocument()
  })

  test('termina sessão através do NextAuth', async () => {
    mocks.useSession.mockReturnValue(
      {
        status:
          'authenticated',
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

    render(<SiteHeader />)
    openAccountMenu()

    fireEvent.click(
      screen.getByRole(
        'menuitem',
        {
          name: 'Sair',
        },
      ),
    )

    await waitFor(() => {
      expect(
        mocks.signOut,
      ).toHaveBeenCalledWith({
        callbackUrl: '/',
      })
    })
  })

  test('mostra erro quando o logout falha', async () => {
    mocks.useSession.mockReturnValue(
      {
        status:
          'authenticated',
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

    mocks.signOut.mockRejectedValue(
      new Error('erro'),
    )

    render(<SiteHeader />)
    openAccountMenu()

    fireEvent.click(
      screen.getByRole(
        'menuitem',
        {
          name: 'Sair',
        },
      ),
    )

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Não foi possível terminar a sessão.',
    )
  })

  test('fecha o menu de conta com Escape ou clique fora e devolve o foco ao gatilho', () => {
    mocks.useSession.mockReturnValue({
      status: 'authenticated',
      data: {
        user: {
          id: 'user-1',
          name: 'Maria',
          email: 'maria@example.com',
          role: 'BUYER',
        },
      },
    })

    render(<SiteHeader />)

    const trigger = screen.getByRole('button', {
      name: 'Conta',
    })

    openAccountMenu()

    expect(
      screen.getByRole('menu'),
    ).toBeInTheDocument()
    expect(document.activeElement).not.toBe(
      trigger,
    )

    fireEvent.keyDown(window, {
      key: 'Escape',
    })

    expect(
      screen.queryByRole('menu'),
    ).not.toBeInTheDocument()
    expect(document.activeElement).toBe(
      trigger,
    )

    // Reabre e fecha ao clicar fora do menu.
    fireEvent.click(trigger)
    expect(
      screen.getByRole('menu'),
    ).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(
      screen.queryByRole('menu'),
    ).not.toBeInTheDocument()
  })
})
