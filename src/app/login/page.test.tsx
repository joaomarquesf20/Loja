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
import {
  GUEST_CART_STORAGE_KEY,
  readGuestCart,
  readGuestCartMergeAttempt,
} from '@/lib/guest-cart'

const mocks = vi.hoisted(
  () => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
    useSession: vi.fn(),
    update: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    fetch: vi.fn(),
  }),
)

vi.mock(
  'next-auth/react',
  () => ({
    signIn: mocks.signIn,
    signOut: mocks.signOut,
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

const successfulSignInResult = {
  error: null,
  status: 200,
  ok: true,
  url: null,
}

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

function setGuestCart() {
  const items = [
    {
      productId: 'product-1',
      quantity: 2,
    },
    {
      productId: 'product-2',
      quantity: 1,
    },
  ]

  window.localStorage.setItem(
    GUEST_CART_STORAGE_KEY,
    JSON.stringify(items),
  )

  return items
}

function submitLogin(
  password = 'segredo',
) {
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
        value: password,
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
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    window.localStorage.clear()

    vi.stubGlobal(
      'fetch',
      mocks.fetch,
    )

    mocks.signIn.mockResolvedValue(
      successfulSignInResult,
    )

    mocks.signOut.mockResolvedValue(
      undefined,
    )

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

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('inicia sessão sem fazer merge quando não existe carrinho convidado', async () => {
    render(<LoginPage />)

    submitLogin()

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

    await waitFor(() => {
      expect(
        mocks.update,
      ).toHaveBeenCalledTimes(1)
    })

    expect(
      mocks.fetch,
    ).not.toHaveBeenCalled()

    expect(
      mocks.signOut,
    ).not.toHaveBeenCalled()

    expect(
      mocks.replace,
    ).toHaveBeenCalledWith(
      '/',
    )

    expect(
      mocks.refresh,
    ).toHaveBeenCalledTimes(1)
  })

  test('faz merge do carrinho convidado antes de entrar na loja', async () => {
    const guestItems =
      setGuestCart()

    mocks.fetch.mockResolvedValue(
      createJsonResponse({
        mergedItemCount: 2,
      }),
    )

    render(<LoginPage />)

    submitLogin()

    await waitFor(() => {
      expect(
        mocks.fetch,
      ).toHaveBeenCalledTimes(1)
    })

    const [
      requestUrl,
      requestInit,
    ] = mocks.fetch.mock.calls[0]

    expect(requestUrl).toBe(
      '/api/cart/merge',
    )

    expect(requestInit).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type':
            'application/json',
        },
      }),
    )

    const requestBody =
      JSON.parse(
        String(
          requestInit.body,
        ),
      )

    expect(
      requestBody.mergeKey,
    ).toEqual(
      expect.any(String),
    )

    expect(
      requestBody.mergeKey.length,
    ).toBeGreaterThan(0)

    expect(
      requestBody.items,
    ).toEqual(guestItems)

    await waitFor(() => {
      expect(
        mocks.replace,
      ).toHaveBeenCalledWith(
        '/',
      )
    })

    expect(
      readGuestCart(),
    ).toEqual([])

    expect(
      readGuestCartMergeAttempt(),
    ).toBeNull()

    expect(
      mocks.signOut,
    ).not.toHaveBeenCalled()

    expect(
      mocks.update,
    ).toHaveBeenCalledTimes(1)

    expect(
      mocks.refresh,
    ).toHaveBeenCalledTimes(1)
  })

  test('preserva e reutiliza a mesma mergeKey depois de falha de rede', async () => {
    const guestItems =
      setGuestCart()

    mocks.fetch
      .mockRejectedValueOnce(
        new TypeError(
          'Network error',
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          mergedItemCount: 2,
        }),
      )

    render(<LoginPage />)

    submitLogin()

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Não foi possível confirmar a fusão do carrinho.',
    )

    await waitFor(() => {
      expect(
        mocks.signOut,
      ).toHaveBeenCalledTimes(1)
    })

    expect(
      mocks.fetch,
    ).toHaveBeenCalledTimes(1)

    const pendingAttempt =
      readGuestCartMergeAttempt()

    expect(
      pendingAttempt,
    ).not.toBeNull()

    expect(
      pendingAttempt?.items,
    ).toEqual(guestItems)

    expect(
      readGuestCart(),
    ).toEqual(guestItems)

    const firstRequestBody =
      JSON.parse(
        String(
          mocks.fetch.mock
            .calls[0][1].body,
        ),
      )

    expect(
      firstRequestBody.mergeKey,
    ).toBe(
      pendingAttempt?.mergeKey,
    )

    await waitFor(() => {
      expect(
        screen.getByRole(
          'button',
          {
            name: 'Entrar',
          },
        ),
      ).toBeEnabled()
    })

    submitLogin()

    await waitFor(() => {
      expect(
        mocks.fetch,
      ).toHaveBeenCalledTimes(2)
    })

    const secondRequestBody =
      JSON.parse(
        String(
          mocks.fetch.mock
            .calls[1][1].body,
        ),
      )

    expect(
      secondRequestBody.mergeKey,
    ).toBe(
      firstRequestBody.mergeKey,
    )

    expect(
      secondRequestBody.items,
    ).toEqual(guestItems)

    await waitFor(() => {
      expect(
        mocks.replace,
      ).toHaveBeenCalledWith(
        '/',
      )
    })

    expect(
      mocks.signIn,
    ).toHaveBeenCalledTimes(2)

    expect(
      mocks.signOut,
    ).toHaveBeenCalledTimes(1)

    expect(
      readGuestCart(),
    ).toEqual([])

    expect(
      readGuestCartMergeAttempt(),
    ).toBeNull()
  })

  test('preserva o carrinho e descarta a tentativa quando não existe stock suficiente', async () => {
    const guestItems =
      setGuestCart()

    mocks.fetch.mockResolvedValue(
      createJsonResponse(
        {
          error:
            'Stock insuficiente',
          code:
            'INSUFFICIENT_STOCK',
        },
        409,
      ),
    )

    render(<LoginPage />)

    submitLogin()

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'já não existe stock suficiente',
    )

    await waitFor(() => {
      expect(
        mocks.signOut,
      ).toHaveBeenCalledWith(
        {
          redirect: false,
        },
      )
    })

    expect(
      readGuestCart(),
    ).toEqual(guestItems)

    expect(
      readGuestCartMergeAttempt(),
    ).toBeNull()

    expect(
      mocks.update,
    ).not.toHaveBeenCalled()

    expect(
      mocks.replace,
    ).not.toHaveBeenCalled()

    expect(
      mocks.refresh,
    ).not.toHaveBeenCalled()
  })

  test('preserva a tentativa quando existe conflito da mergeKey', async () => {
    const guestItems =
      setGuestCart()

    mocks.fetch.mockResolvedValue(
      createJsonResponse(
        {
          error:
            'Identificador de merge já utilizado com dados diferentes',
          code:
            'MERGE_CONFLICT',
        },
        409,
      ),
    )

    render(<LoginPage />)

    submitLogin()

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Não foi possível confirmar com segurança',
    )

    await waitFor(() => {
      expect(
        mocks.signOut,
      ).toHaveBeenCalledTimes(1)
    })

    const pendingAttempt =
      readGuestCartMergeAttempt()

    expect(
      pendingAttempt,
    ).not.toBeNull()

    expect(
      pendingAttempt?.items,
    ).toEqual(guestItems)

    expect(
      readGuestCart(),
    ).toEqual(guestItems)

    const requestBody =
      JSON.parse(
        String(
          mocks.fetch.mock
            .calls[0][1].body,
        ),
      )

    expect(
      pendingAttempt?.mergeKey,
    ).toBe(
      requestBody.mergeKey,
    )

    expect(
      mocks.update,
    ).not.toHaveBeenCalled()

    expect(
      mocks.replace,
    ).not.toHaveBeenCalled()
  })

  test('mostra erro quando as credenciais são inválidas sem tocar no carrinho', async () => {
    const guestItems =
      setGuestCart()

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

    submitLogin('errada')

    expect(
      await screen.findByRole(
        'alert',
      ),
    ).toHaveTextContent(
      'Email ou password inválidos.',
    )

    expect(
      mocks.fetch,
    ).not.toHaveBeenCalled()

    expect(
      mocks.signOut,
    ).not.toHaveBeenCalled()

    expect(
      mocks.update,
    ).not.toHaveBeenCalled()

    expect(
      mocks.replace,
    ).not.toHaveBeenCalled()

    expect(
      readGuestCart(),
    ).toEqual(guestItems)

    expect(
      readGuestCartMergeAttempt(),
    ).toBeNull()
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

    expect(
      mocks.signIn,
    ).not.toHaveBeenCalled()

    expect(
      mocks.fetch,
    ).not.toHaveBeenCalled()
  })
})
