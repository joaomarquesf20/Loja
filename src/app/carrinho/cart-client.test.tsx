import {
  cleanup,
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
} from '@/lib/guest-cart'
import { CartClient } from './cart-client'

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

function createItem(
  quantity = 1,
  overrides?: Partial<{
    inStock: boolean
    isAvailable: boolean
    canIncrease: boolean
  }>,
) {
  return {
    id: 'cart-item-1',
    productId: 'product-1',
    quantity,
    product: {
      id: 'product-1',
      name: 'Produto 1',
      slug: 'produto-1',
      price: 19.99,
      images: [],
    },
    inStock:
      overrides?.inStock ??
      true,
    isAvailable:
      overrides?.isAvailable ??
      true,
    canIncrease:
      overrides?.canIncrease ??
      true,
  }
}

const fetchMock = vi.fn()

describe('CartClient', () => {
  beforeEach(() => {
    fetchMock.mockReset()

    vi.stubGlobal(
      'fetch',
      fetchMock,
    )

    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('carrega carrinho autenticado', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          createItem(),
        ],
      }),
    )

    render(<CartClient />)

    expect(
      await screen.findByText(
        'Produto 1',
      ),
    ).toBeTruthy()

    expect(
      screen.getByText(
        'Carrinho associado à tua conta.',
      ),
    ).toBeTruthy()

    expect(
      screen.getByText(
        'Quantidade: 1',
      ),
    ).toBeTruthy()

    expect(
      fetchMock,
    ).toHaveBeenCalledWith(
      '/api/cart',
      {
        method: 'GET',
        cache: 'no-store',
      },
    )
  })

  test('usa carrinho convidado quando API autenticada devolve 401', async () => {
    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      JSON.stringify([
        {
          productId:
            'product-1',
          quantity: 2,
        },
      ]),
    )

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Não autenticado',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            createItem(2),
          ],
        }),
      )

    render(<CartClient />)

    expect(
      await screen.findByText(
        'Carrinho guardado neste dispositivo.',
      ),
    ).toBeTruthy()

    expect(
      screen.getByText(
        'Quantidade: 2',
      ),
    ).toBeTruthy()

    expect(
      fetchMock.mock.calls[1]?.[0],
    ).toBe(
      '/api/cart/guest',
    )
  })

  test('não transforma erro da API autenticada em carrinho convidado', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error:
            'Erro interno do servidor',
        },
        500,
      ),
    )

    render(<CartClient />)

    const alert =
      await screen.findByRole(
        'alert',
      )

    expect(
      alert.textContent,
    ).toContain(
      'Não foi possível carregar o carrinho',
    )

    expect(
      alert.textContent,
    ).toContain(
      'Erro interno do servidor',
    )

    expect(
      screen.queryByText(
        'Carrinho guardado neste dispositivo.',
      ),
    ).toBeNull()

    expect(
      fetchMock,
    ).toHaveBeenCalledTimes(1)
  })

  test('aumenta quantidade no carrinho autenticado', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            createItem(1),
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          item: createItem(2),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            createItem(2),
          ],
        }),
      )

    render(<CartClient />)

    const increaseButton =
      await screen.findByRole(
        'button',
        {
          name: 'Aumentar quantidade de Produto 1',
        },
      )

    fireEvent.click(
      increaseButton,
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Quantidade: 2',
        ),
      ).toBeTruthy()
    })

    expect(
      fetchMock.mock.calls[1]?.[0],
    ).toBe('/api/cart')

    expect(
      fetchMock.mock.calls[1]?.[1],
    ).toMatchObject({
      method: 'PATCH',
    })

    const patchOptions =
      fetchMock.mock
        .calls[1]?.[1] as
        | RequestInit
        | undefined

    expect(
      JSON.parse(
        String(
          patchOptions?.body,
        ),
      ),
    ).toEqual({
      productId: 'product-1',
      quantity: 2,
    })
  })

  test('aumenta quantidade no carrinho convidado e persiste no localStorage', async () => {
    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      JSON.stringify([
        {
          productId:
            'product-1',
          quantity: 1,
        },
      ]),
    )

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Não autenticado',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            createItem(1),
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            createItem(2),
          ],
        }),
      )

    render(<CartClient />)

    const increaseButton =
      await screen.findByRole(
        'button',
        {
          name: 'Aumentar quantidade de Produto 1',
        },
      )

    fireEvent.click(
      increaseButton,
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Quantidade: 2',
        ),
      ).toBeTruthy()
    })

    expect(
      JSON.parse(
        window.localStorage.getItem(
          GUEST_CART_STORAGE_KEY,
        ) ?? 'null',
      ),
    ).toEqual([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ])
  })

  test('remove produto do carrinho convidado', async () => {
    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      JSON.stringify([
        {
          productId:
            'product-1',
          quantity: 1,
        },
      ]),
    )

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Não autenticado',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            createItem(),
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [],
        }),
      )

    render(<CartClient />)

    const removeButton =
      await screen.findByRole(
        'button',
        {
          name: 'Remover',
        },
      )

    fireEvent.click(
      removeButton,
    )

    expect(
      await screen.findByText(
        'O carrinho está vazio',
      ),
    ).toBeTruthy()

    expect(
      JSON.parse(
        window.localStorage.getItem(
          GUEST_CART_STORAGE_KEY,
        ) ?? 'null',
      ),
    ).toEqual([])
  })

  test('desativa aumento quando não existe stock suficiente', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          createItem(
            3,
            {
              inStock: true,
              isAvailable: false,
              canIncrease: false,
            },
          ),
        ],
      }),
    )

    render(<CartClient />)

    const increaseButton =
      await screen.findByRole(
        'button',
        {
          name: 'Aumentar quantidade de Produto 1',
        },
      )

    expect(
      increaseButton,
    ).toBeDisabled()

    expect(
      screen.getByText(
        /superior ao stock disponível/,
      ),
    ).toBeTruthy()
  })
})
