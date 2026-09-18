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

const mocks = vi.hoisted(
  () => ({
    fetch: vi.fn(),
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

import RegisterPage from './page'

function createJsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'content-type':
          'application/json',
      },
    },
  )
}

function submitRegistration() {
  fireEvent.change(
    screen.getByLabelText(
      'Nome',
    ),
    {
      target: {
        value: 'Buyer Teste',
      },
    },
  )

  fireEvent.change(
    screen.getByLabelText(
      'Email',
    ),
    {
      target: {
        value:
          'buyer@example.com',
      },
    },
  )

  fireEvent.change(
    screen.getByLabelText(
      'Password',
    ),
    {
      target: {
        value:
          'password123',
      },
    },
  )

  fireEvent.submit(
    screen
      .getByRole(
        'button',
        {
          name: 'Criar conta',
        },
      )
      .closest('form')!,
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    window.localStorage.clear()
    window.history.replaceState(
      {},
      '',
      '/registar',
    )

    vi.stubGlobal(
      'fetch',
      mocks.fetch,
    )

    mocks.useSession.mockReturnValue(
      {
        data: null,
        status:
          'unauthenticated',
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('mostra formulário de registo quando não existe sessão', () => {
    render(<RegisterPage />)

    expect(
      screen.getByRole(
        'heading',
        {
          name: 'Criar conta',
        },
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText(
        'Nome',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText(
        'Email',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText(
        'Password',
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
  })

  test('preserva callback interno no acesso ao login', async () => {
    window.history.replaceState(
      {},
      '',
      '/registar?callbackUrl=%2Fcheckout',
    )

    render(<RegisterPage />)

    await waitFor(() => {
      expect(
        screen.getByRole(
          'link',
          {
            name: 'Entrar',
          },
        ),
      ).toHaveAttribute(
        'href',
        '/login?callbackUrl=%2Fcheckout',
      )
    })
  })

  test.each([
    'https://example.com/checkout',
    '//example.com/checkout',
    '/\\example.com/checkout',
  ])(
    'não propaga callback externo ou ambíguo %s',
    async (unsafeCallbackUrl) => {
      window.history.replaceState(
        {},
        '',
        `/registar?callbackUrl=${encodeURIComponent(
          unsafeCallbackUrl,
        )}`,
      )

      render(<RegisterPage />)

      await waitFor(() => {
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
      })
    },
  )

  test('não apresenta formulário enquanto a sessão está a carregar', () => {
    mocks.useSession.mockReturnValue(
      {
        data: null,
        status: 'loading',
      },
    )

    render(<RegisterPage />)

    expect(
      screen.getByText(
        'A verificar sessão…',
      ),
    ).toBeInTheDocument()

    expect(
      screen.queryByLabelText(
        'Password',
      ),
    ).not.toBeInTheDocument()
  })

  test('não apresenta formulário a utilizador já autenticado', () => {
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

    render(<RegisterPage />)

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

    expect(
      mocks.fetch,
    ).not.toHaveBeenCalled()
  })

  test('cria conta através da API e encaminha o utilizador para o login', async () => {
    mocks.fetch.mockResolvedValue(
      createJsonResponse(
        {
          user: {
            id: 'user-1',
            email:
              'buyer@example.com',
            name: 'Buyer Teste',
          },
        },
        201,
      ),
    )

    window.history.replaceState(
      {},
      '',
      '/registar?callbackUrl=%2Fcheckout',
    )

    render(<RegisterPage />)

    submitRegistration()

    await waitFor(() => {
      expect(
        mocks.fetch,
      ).toHaveBeenCalledTimes(1)
    })

    expect(
      mocks.fetch,
    ).toHaveBeenCalledWith(
      '/api/auth/register',
      {
        method: 'POST',
        headers: {
          'content-type':
            'application/json',
        },
        body: JSON.stringify({
          name: 'Buyer Teste',
          email:
            'buyer@example.com',
          password:
            'password123',
        }),
      },
    )

    expect(
      await screen.findByRole(
        'heading',
        {
          name:
            'Conta criada com sucesso',
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
      '/login?callbackUrl=%2Fcheckout',
    )

    expect(
      screen.queryByLabelText(
        'Password',
      ),
    ).not.toBeInTheDocument()
  })

  test('preserva o carrinho convidado após criar a conta', async () => {
    const guestCart =
      JSON.stringify([
        {
          productId:
            'product-1',
          quantity: 2,
        },
      ])

    const mergeAttempt =
      JSON.stringify({
        mergeKey:
          'pending-key',
        items: [
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ],
      })

    window.localStorage.setItem(
      'pfautoparts:guest-cart',
      guestCart,
    )

    window.localStorage.setItem(
      'pfautoparts:guest-cart-merge',
      mergeAttempt,
    )

    mocks.fetch.mockResolvedValue(
      createJsonResponse(
        {
          user: {
            id: 'user-1',
            email:
              'buyer@example.com',
            name: 'Buyer Teste',
          },
        },
        201,
      ),
    )

    render(<RegisterPage />)

    submitRegistration()

    expect(
      await screen.findByRole(
        'heading',
        {
          name:
            'Conta criada com sucesso',
        },
      ),
    ).toBeInTheDocument()

    expect(
      window.localStorage.getItem(
        'pfautoparts:guest-cart',
      ),
    ).toBe(guestCart)

    expect(
      window.localStorage.getItem(
        'pfautoparts:guest-cart-merge',
      ),
    ).toBe(mergeAttempt)
  })

  test('mostra erro quando o email já está registado', async () => {
    mocks.fetch.mockResolvedValue(
      createJsonResponse(
        {
          error:
            'Já existe uma conta com este email',
          code:
            'EMAIL_ALREADY_REGISTERED',
        },
        409,
      ),
    )

    render(<RegisterPage />)

    submitRegistration()

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Já existe uma conta com este email.',
    )

    expect(
      screen.getByRole(
        'button',
        {
          name: 'Criar conta',
        },
      ),
    ).toBeEnabled()
  })

  test('mostra erro específico para password inválida', async () => {
    mocks.fetch.mockResolvedValue(
      createJsonResponse(
        {
          error:
            'A palavra-passe deve ter pelo menos 8 caracteres',
          code:
            'INVALID_PASSWORD',
        },
        400,
      ),
    )

    render(<RegisterPage />)

    fireEvent.change(
      screen.getByLabelText(
        'Nome',
      ),
      {
        target: {
          value:
            'Buyer Teste',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Email',
      ),
      {
        target: {
          value:
            'buyer@example.com',
        },
      },
    )

    fireEvent.change(
      screen.getByLabelText(
        'Password',
      ),
      {
        target: {
          value:
            '12345678',
        },
      },
    )

    fireEvent.submit(
      screen
        .getByRole(
          'button',
          {
            name:
              'Criar conta',
          },
        )
        .closest('form')!,
    )

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'A palavra-passe deve ter pelo menos 8 caracteres.',
    )
  })

  test('não expõe mensagem interna para erro desconhecido da API', async () => {
    mocks.fetch.mockResolvedValue(
      createJsonResponse(
        {
          error:
            'Mensagem interna sensível',
          code:
            'INTERNAL_ERROR',
        },
        500,
      ),
    )

    render(<RegisterPage />)

    submitRegistration()

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Não foi possível criar a conta. Tenta novamente.',
    )

    expect(
      screen.queryByText(
        'Mensagem interna sensível',
      ),
    ).not.toBeInTheDocument()
  })

  test('mostra erro seguro quando a rede falha', async () => {
    mocks.fetch.mockRejectedValue(
      new TypeError(
        'Network error',
      ),
    )

    render(<RegisterPage />)

    submitRegistration()

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Não foi possível criar a conta. Tenta novamente.',
    )

    expect(
      screen.getByRole(
        'button',
        {
          name: 'Criar conta',
        },
      ),
    ).toBeEnabled()
  })
})
