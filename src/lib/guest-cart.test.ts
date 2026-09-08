import {
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'
import {
  addGuestCartItem,
  GUEST_CART_STORAGE_KEY,
  GuestCartValidationError,
  readGuestCart,
} from './guest-cart'

describe('Guest cart', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('carrinho começa vazio', () => {
    expect(readGuestCart()).toEqual([])
  })

  test('adiciona novo produto', () => {
    const result =
      addGuestCartItem(
        ' product-1 ',
        2,
      )

    expect(result).toEqual([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ])

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

  test('incrementa produto existente', () => {
    addGuestCartItem(
      'product-1',
      2,
    )

    const result =
      addGuestCartItem(
        'product-1',
        3,
      )

    expect(result).toEqual([
      {
        productId: 'product-1',
        quantity: 5,
      },
    ])
  })

  test('mantém outros produtos', () => {
    addGuestCartItem(
      'product-1',
      1,
    )

    addGuestCartItem(
      'product-2',
      2,
    )

    expect(readGuestCart()).toEqual([
      {
        productId: 'product-1',
        quantity: 1,
      },
      {
        productId: 'product-2',
        quantity: 2,
      },
    ])
  })

  test('ignora armazenamento inválido', () => {
    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      '{',
    )

    expect(readGuestCart()).toEqual([])
  })

  test('ignora entradas inválidas guardadas', () => {
    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      JSON.stringify([
        {
          productId: 'product-1',
          quantity: 2,
        },
        {
          productId: '',
          quantity: 1,
        },
        {
          productId: 'product-2',
          quantity: 0,
        },
      ]),
    )

    expect(readGuestCart()).toEqual([
      {
        productId: 'product-1',
        quantity: 2,
      },
    ])
  })

  test('rejeita produto vazio', () => {
    expect(() =>
      addGuestCartItem(
        '   ',
        1,
      ),
    ).toThrow(
      GuestCartValidationError,
    )
  })

  test.each([
    0,
    -1,
    1.5,
    Number.NaN,
  ])(
    'rejeita quantidade inválida: %s',
    (quantity) => {
      expect(() =>
        addGuestCartItem(
          'product-1',
          quantity,
        ),
      ).toThrow(
        GuestCartValidationError,
      )
    },
  )
})