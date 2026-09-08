import {
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'
import {
  addGuestCartItem,
  GUEST_CART_STORAGE_KEY,
  GuestCartItemNotFoundError,
  GuestCartValidationError,
  readGuestCart,
  removeGuestCartItem,
  updateGuestCartItemQuantity,
} from './guest-cart'

describe('Guest cart', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('readGuestCart', () => {
    test('devolve carrinho vazio quando não existe storage', () => {
      expect(readGuestCart()).toEqual(
        [],
      )
    })

    test('devolve carrinho vazio quando JSON é inválido', () => {
      window.localStorage.setItem(
        GUEST_CART_STORAGE_KEY,
        '{',
      )

      expect(readGuestCart()).toEqual(
        [],
      )
    })

    test('ignora entradas inválidas e normaliza productId', () => {
      window.localStorage.setItem(
        GUEST_CART_STORAGE_KEY,
        JSON.stringify([
          {
            productId:
              ' product-1 ',
            quantity: 2,
          },
          {
            productId: '',
            quantity: 1,
          },
          {
            productId:
              'product-2',
            quantity: 0,
          },
          {
            productId:
              'product-3',
            quantity: 1.5,
          },
          null,
        ]),
      )

      expect(readGuestCart()).toEqual([
        {
          productId: 'product-1',
          quantity: 2,
        },
      ])
    })
  })

  describe('addGuestCartItem', () => {
    test('adiciona novo produto ao carrinho', () => {
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
      ).toEqual(result)
    })

    test('incrementa quantidade de produto existente', () => {
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

    test('preserva os restantes produtos', () => {
      window.localStorage.setItem(
        GUEST_CART_STORAGE_KEY,
        JSON.stringify([
          {
            productId:
              'product-1',
            quantity: 1,
          },
          {
            productId:
              'product-2',
            quantity: 4,
          },
        ]),
      )

      const result =
        addGuestCartItem(
          'product-1',
          2,
        )

      expect(result).toEqual([
        {
          productId: 'product-1',
          quantity: 3,
        },
        {
          productId: 'product-2',
          quantity: 4,
        },
      ])
    })

    test('rejeita productId vazio', () => {
      expect(() =>
        addGuestCartItem(
          '   ',
          1,
        ),
      ).toThrow(
        GuestCartValidationError,
      )

      expect(readGuestCart()).toEqual(
        [],
      )
    })

    test.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
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

        expect(
          readGuestCart(),
        ).toEqual([])
      },
    )

    test('rejeita incremento que deixa de ser um inteiro seguro', () => {
      window.localStorage.setItem(
        GUEST_CART_STORAGE_KEY,
        JSON.stringify([
          {
            productId:
              'product-1',
            quantity:
              Number.MAX_SAFE_INTEGER,
          },
        ]),
      )

      expect(() =>
        addGuestCartItem(
          'product-1',
          1,
        ),
      ).toThrow(
        GuestCartValidationError,
      )

      expect(readGuestCart()).toEqual([
        {
          productId: 'product-1',
          quantity:
            Number.MAX_SAFE_INTEGER,
        },
      ])
    })
  })

  describe('updateGuestCartItemQuantity', () => {
    test('substitui a quantidade atual', () => {
      window.localStorage.setItem(
        GUEST_CART_STORAGE_KEY,
        JSON.stringify([
          {
            productId:
              'product-1',
            quantity: 4,
          },
        ]),
      )

      const result =
        updateGuestCartItemQuantity(
          ' product-1 ',
          2,
        )

      expect(result).toEqual([
        {
          productId: 'product-1',
          quantity: 2,
        },
      ])

      expect(readGuestCart()).toEqual(
        result,
      )
    })

    test('preserva os restantes produtos ao alterar quantidade', () => {
      window.localStorage.setItem(
        GUEST_CART_STORAGE_KEY,
        JSON.stringify([
          {
            productId:
              'product-1',
            quantity: 1,
          },
          {
            productId:
              'product-2',
            quantity: 3,
          },
        ]),
      )

      const result =
        updateGuestCartItemQuantity(
          'product-1',
          5,
        )

      expect(result).toEqual([
        {
          productId: 'product-1',
          quantity: 5,
        },
        {
          productId: 'product-2',
          quantity: 3,
        },
      ])
    })

    test('rejeita produto que não está no carrinho', () => {
      expect(() =>
        updateGuestCartItemQuantity(
          'product-1',
          2,
        ),
      ).toThrow(
        GuestCartItemNotFoundError,
      )

      expect(readGuestCart()).toEqual(
        [],
      )
    })

    test('rejeita productId vazio', () => {
      expect(() =>
        updateGuestCartItemQuantity(
          '   ',
          2,
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
      Number.POSITIVE_INFINITY,
    ])(
      'rejeita nova quantidade inválida: %s',
      (quantity) => {
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

        expect(() =>
          updateGuestCartItemQuantity(
            'product-1',
            quantity,
          ),
        ).toThrow(
          GuestCartValidationError,
        )

        expect(readGuestCart()).toEqual([
          {
            productId:
              'product-1',
            quantity: 1,
          },
        ])
      },
    )
  })

  describe('removeGuestCartItem', () => {
    test('remove produto do carrinho', () => {
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

      const result =
        removeGuestCartItem(
          ' product-1 ',
        )

      expect(result).toEqual([])

      expect(readGuestCart()).toEqual(
        [],
      )
    })

    test('preserva os restantes produtos ao remover', () => {
      window.localStorage.setItem(
        GUEST_CART_STORAGE_KEY,
        JSON.stringify([
          {
            productId:
              'product-1',
            quantity: 2,
          },
          {
            productId:
              'product-2',
            quantity: 3,
          },
        ]),
      )

      const result =
        removeGuestCartItem(
          'product-1',
        )

      expect(result).toEqual([
        {
          productId: 'product-2',
          quantity: 3,
        },
      ])
    })

    test('rejeita produto que não está no carrinho', () => {
      expect(() =>
        removeGuestCartItem(
          'product-1',
        ),
      ).toThrow(
        GuestCartItemNotFoundError,
      )
    })

    test('rejeita productId vazio', () => {
      expect(() =>
        removeGuestCartItem('   '),
      ).toThrow(
        GuestCartValidationError,
      )
    })
  })
})
