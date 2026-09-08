import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  '@/server/guest-cart',
  () => {
    class GuestCartServerValidationError extends Error {
      constructor(message: string) {
        super(message)
        this.name =
          'GuestCartServerValidationError'
      }
    }

    return {
      resolveGuestCartItems:
        vi.fn(),
      GuestCartServerValidationError,
    }
  },
)

import {
  GuestCartServerValidationError,
  resolveGuestCartItems,
} from '@/server/guest-cart'
import { POST } from './route'

const mockResolveGuestCartItems =
  vi.mocked(resolveGuestCartItems)

function createRequest(
  body: string,
) {
  return new Request(
    'http://localhost/api/cart/guest',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body,
    },
  )
}

describe('/api/cart/guest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveGuestCartItems.mockReset()
  })

  test('rejeita JSON inválido', async () => {
    const response = await POST(
      createRequest('{'),
    )

    expect(response.status).toBe(400)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error: 'JSON inválido',
    })
  })

  test('rejeita corpo que não é objeto', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify([]),
      ),
    )

    expect(response.status).toBe(400)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error: 'Pedido inválido',
    })
  })

  test('rejeita items em falta', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify({}),
      ),
    )

    expect(response.status).toBe(400)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error: 'Itens inválidos',
    })
  })

  test('rejeita item com estrutura inválida', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify({
          items: [
            {
              productId:
                'product-1',
              quantity: '2',
            },
          ],
        }),
      ),
    )

    expect(response.status).toBe(400)

    expect(
      mockResolveGuestCartItems,
    ).not.toHaveBeenCalled()
  })

  test('resolve carrinho vazio', async () => {
    mockResolveGuestCartItems.mockResolvedValue(
      [],
    )

    const response = await POST(
      createRequest(
        JSON.stringify({
          items: [],
        }),
      ),
    )

    expect(response.status).toBe(200)

    expect(
      mockResolveGuestCartItems,
    ).toHaveBeenCalledWith([])

    await expect(
      response.json(),
    ).resolves.toEqual({
      items: [],
    })
  })

  test('resolve produtos do carrinho convidado', async () => {
    const resolvedItems = [
      {
        productId: 'product-1',
        quantity: 2,
        product: {
          id: 'product-1',
          name: 'Produto 1',
          slug: 'produto-1',
          price: 19.99,
          images: [],
        },
        inStock: true,
        isAvailable: true,
        canIncrease: true,
      },
    ]

    mockResolveGuestCartItems.mockResolvedValue(
      resolvedItems,
    )

    const response = await POST(
      createRequest(
        JSON.stringify({
          items: [
            {
              productId:
                'product-1',
              quantity: 2,
            },
          ],
        }),
      ),
    )

    expect(response.status).toBe(200)

    expect(
      mockResolveGuestCartItems,
    ).toHaveBeenCalledWith([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ])

    await expect(
      response.json(),
    ).resolves.toEqual({
      items: resolvedItems,
    })
  })

  test('devolve 400 para erro de validação', async () => {
    mockResolveGuestCartItems.mockRejectedValue(
      new GuestCartServerValidationError(
        'Quantidade inválida',
      ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({
          items: [
            {
              productId:
                'product-1',
              quantity: 0,
            },
          ],
        }),
      ),
    )

    expect(response.status).toBe(400)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error: 'Quantidade inválida',
    })
  })

  test('devolve 500 em erro inesperado', async () => {
    const consoleError =
      vi.spyOn(
        console,
        'error',
      ).mockImplementation(() => {})

    mockResolveGuestCartItems.mockRejectedValue(
      new Error('Erro inesperado'),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({
          items: [],
        }),
      ),
    )

    expect(response.status).toBe(500)

    await expect(
      response.json(),
    ).resolves.toEqual({
      error:
        'Erro interno do servidor',
    })

    expect(
      consoleError,
    ).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})