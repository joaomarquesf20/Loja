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
  GUEST_CART_MERGE_STORAGE_KEY,
  GUEST_CART_STORAGE_KEY,
} from '@/lib/guest-cart'
import AddToCartButton from './add-to-cart-button'

const fetchMock = vi.fn()

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

describe(
  'AddToCartButton',
  () => {
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

    test('adiciona produto ao carrinho autenticado', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          item: {
            productId:
              'product-1',
            quantity: 1,
          },
        }),
      )

      render(
        <AddToCartButton
          productId="product-1"
          inStock
        />,
      )

      fireEvent.click(
        screen.getByRole(
          'button',
          {
            name:
              'Adicionar ao carrinho',
          },
        ),
      )

      expect(
        await screen.findByRole(
          'status',
        ),
      ).toHaveTextContent(
        'Produto adicionado ao carrinho.',
      )

      expect(
        fetchMock,
      ).toHaveBeenCalledWith(
        '/api/cart',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            productId:
              'product-1',
            quantity: 1,
          }),
        }),
      )

      expect(
        window.localStorage.getItem(
          GUEST_CART_STORAGE_KEY,
        ),
      ).toBeNull()
    })

    test('guarda produto no carrinho convidado quando API devolve 401', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Não autenticado',
          },
          401,
        ),
      )

      render(
        <AddToCartButton
          productId="product-1"
          inStock
        />,
      )

      fireEvent.click(
        screen.getByRole(
          'button',
          {
            name:
              'Adicionar ao carrinho',
          },
        ),
      )

      expect(
        await screen.findByRole(
          'status',
        ),
      ).toHaveTextContent(
        'Produto adicionado ao carrinho neste dispositivo.',
      )

      expect(
        JSON.parse(
          window.localStorage.getItem(
            GUEST_CART_STORAGE_KEY,
          ) ?? 'null',
        ),
      ).toEqual([
        {
          productId:
            'product-1',
          quantity: 1,
        },
      ])
    })

    test('mostra mensagem específica e não altera carrinho quando existe merge pendente', async () => {
      const guestItems = [
        {
          productId:
            'product-1',
          quantity: 1,
        },
      ]

      window.localStorage.setItem(
        GUEST_CART_STORAGE_KEY,
        JSON.stringify(
          guestItems,
        ),
      )

      window.localStorage.setItem(
        GUEST_CART_MERGE_STORAGE_KEY,
        JSON.stringify({
          mergeKey:
            'merge-key-1',
          items: guestItems,
        }),
      )

      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Não autenticado',
          },
          401,
        ),
      )

      render(
        <AddToCartButton
          productId="product-1"
          inStock
        />,
      )

      fireEvent.click(
        screen.getByRole(
          'button',
          {
            name:
              'Adicionar ao carrinho',
          },
        ),
      )

      expect(
        await screen.findByRole(
          'alert',
        ),
      ).toHaveTextContent(
        'Existe uma fusão do carrinho pendente. Inicia sessão novamente para a concluir.',
      )

      expect(
        JSON.parse(
          window.localStorage.getItem(
            GUEST_CART_STORAGE_KEY,
          ) ?? 'null',
        ),
      ).toEqual(
        guestItems,
      )

      expect(
        JSON.parse(
          window.localStorage.getItem(
            GUEST_CART_MERGE_STORAGE_KEY,
          ) ?? 'null',
        ),
      ).toEqual({
        mergeKey:
          'merge-key-1',
        items: guestItems,
      })

      expect(
        screen.queryByRole(
          'status',
        ),
      ).not.toBeInTheDocument()
    })

    test('mostra erro devolvido pela API', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Stock insuficiente',
          },
          409,
        ),
      )

      render(
        <AddToCartButton
          productId="product-1"
          inStock
        />,
      )

      fireEvent.click(
        screen.getByRole(
          'button',
          {
            name:
              'Adicionar ao carrinho',
          },
        ),
      )

      expect(
        await screen.findByRole(
          'alert',
        ),
      ).toHaveTextContent(
        'Stock insuficiente',
      )

      expect(
        window.localStorage.getItem(
          GUEST_CART_STORAGE_KEY,
        ),
      ).toBeNull()
    })

    test('mostra erro genérico quando a chamada falha', async () => {
      fetchMock.mockRejectedValueOnce(
        new TypeError(
          'Network error',
        ),
      )

      render(
        <AddToCartButton
          productId="product-1"
          inStock
        />,
      )

      fireEvent.click(
        screen.getByRole(
          'button',
          {
            name:
              'Adicionar ao carrinho',
          },
        ),
      )

      expect(
        await screen.findByRole(
          'alert',
        ),
      ).toHaveTextContent(
        'Não foi possível adicionar o produto ao carrinho',
      )

      await waitFor(() => {
        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Adicionar ao carrinho',
            },
          ),
        ).toBeEnabled()
      })
    })
  },
)
