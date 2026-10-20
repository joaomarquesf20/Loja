import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock(
  'next-auth/react',
  () => ({
    useSession: mocks.useSession,
    signOut: mocks.signOut,
  }),
)

import FooterSessionLink from './footer-session-link'

describe('FooterSessionLink', () => {
  beforeEach(() => {
    mocks.signOut.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test('mostra Entrar a visitantes', () => {
    mocks.useSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<FooterSessionLink />)

    expect(
      screen.getByRole('link', {
        name: 'Entrar',
      }),
    ).toHaveAttribute('href', '/login')

    expect(
      screen.queryByRole('button', {
        name: 'Terminar sessão',
      }),
    ).toBeNull()
  })

  test('mostra Terminar sessão em vez de Entrar quando há sessão', () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: { name: 'Maria' },
      },
      status: 'authenticated',
    })

    render(<FooterSessionLink />)

    expect(
      screen.queryByRole('link', {
        name: 'Entrar',
      }),
    ).toBeNull()

    expect(
      screen.getByRole('button', {
        name: 'Terminar sessão',
      }),
    ).toBeInTheDocument()
  })

  test('termina sessão e volta à página inicial', () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: { name: 'Maria' },
      },
      status: 'authenticated',
    })

    render(<FooterSessionLink />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Terminar sessão',
      }),
    )

    expect(mocks.signOut).toHaveBeenCalledWith({
      callbackUrl: '/',
    })
  })
})
