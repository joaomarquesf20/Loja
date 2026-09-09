import {
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'
import {
  addGuestCartItem,
  completeGuestCartMerge,
  discardGuestCartMergeAttempt,
  getOrCreateGuestCartMergeAttempt,
  GUEST_CART_MERGE_STORAGE_KEY,
  GUEST_CART_STORAGE_KEY,
  GuestCartItemNotFoundError,
  GuestCartMergePendingError,
  GuestCartValidationError,
  readGuestCart,
  readGuestCartMergeAttempt,
  removeGuestCartItem,
  updateGuestCartItemQuantity,
  writeGuestCart,
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

  describe(
    'readGuestCartMergeAttempt',
    () => {
      test('devolve null quando não existe tentativa pendente', () => {
        expect(
          readGuestCartMergeAttempt(),
        ).toBeNull()
      })

      test('rejeita JSON inválido da tentativa de merge', () => {
        window.localStorage.setItem(
          GUEST_CART_MERGE_STORAGE_KEY,
          '{',
        )

        expect(() =>
          readGuestCartMergeAttempt(),
        ).toThrow(
          GuestCartValidationError,
        )
      })

      test('normaliza uma tentativa válida guardada', () => {
        window.localStorage.setItem(
          GUEST_CART_MERGE_STORAGE_KEY,
          JSON.stringify({
            mergeKey:
              ' merge-key-1 ',
            items: [
              {
                productId:
                  ' product-1 ',
                quantity: 2,
              },
            ],
          }),
        )

        expect(
          readGuestCartMergeAttempt(),
        ).toEqual({
          mergeKey: 'merge-key-1',
          items: [
            {
              productId:
                'product-1',
              quantity: 2,
            },
          ],
        })
      })
    },
  )

  describe(
    'getOrCreateGuestCartMergeAttempt',
    () => {
      test('devolve null quando o carrinho está vazio', () => {
        expect(
          getOrCreateGuestCartMergeAttempt(),
        ).toBeNull()

        expect(
          window.localStorage.getItem(
            GUEST_CART_MERGE_STORAGE_KEY,
          ),
        ).toBeNull()
      })

      test('cria e persiste uma tentativa para o carrinho atual', () => {
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
              quantity: 1,
            },
          ]),
        )

        const attempt =
          getOrCreateGuestCartMergeAttempt()

        expect(attempt).not.toBeNull()

        expect(
          attempt?.mergeKey,
        ).toEqual(
          expect.any(String),
        )

        expect(
          attempt?.mergeKey.length,
        ).toBeGreaterThan(0)

        expect(attempt?.items).toEqual(
          [
            {
              productId:
                'product-1',
              quantity: 2,
            },
            {
              productId:
                'product-2',
              quantity: 1,
            },
          ],
        )

        expect(
          JSON.parse(
            window.localStorage.getItem(
              GUEST_CART_MERGE_STORAGE_KEY,
            ) ?? 'null',
          ),
        ).toEqual(attempt)
      })

      test('reutiliza a mesma mergeKey enquanto a tentativa estiver pendente', () => {
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

        const firstAttempt =
          getOrCreateGuestCartMergeAttempt()

        const secondAttempt =
          getOrCreateGuestCartMergeAttempt()

        expect(firstAttempt).not.toBeNull()

        expect(secondAttempt).toEqual(
          firstAttempt,
        )

        expect(
          secondAttempt?.mergeKey,
        ).toBe(
          firstAttempt?.mergeKey,
        )
      })
    },
  )

  describe(
    'bloqueio durante merge pendente',
    () => {
      function createPendingAttempt() {
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

        const attempt =
          getOrCreateGuestCartMergeAttempt()

        if (!attempt) {
          throw new Error(
            'Tentativa de merge não criada',
          )
        }

        return attempt
      }

      test('impede substituir o carrinho enquanto existe merge pendente', () => {
        createPendingAttempt()

        expect(() =>
          writeGuestCart([
            {
              productId:
                'product-2',
              quantity: 1,
            },
          ]),
        ).toThrow(
          GuestCartMergePendingError,
        )

        expect(readGuestCart()).toEqual([
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ])
      })

      test('impede adicionar produto enquanto existe merge pendente', () => {
        createPendingAttempt()

        expect(() =>
          addGuestCartItem(
            'product-2',
            1,
          ),
        ).toThrow(
          GuestCartMergePendingError,
        )

        expect(readGuestCart()).toEqual([
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ])
      })

      test('impede alterar quantidade enquanto existe merge pendente', () => {
        createPendingAttempt()

        expect(() =>
          updateGuestCartItemQuantity(
            'product-1',
            4,
          ),
        ).toThrow(
          GuestCartMergePendingError,
        )

        expect(readGuestCart()).toEqual([
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ])
      })

      test('impede remover produto enquanto existe merge pendente', () => {
        createPendingAttempt()

        expect(() =>
          removeGuestCartItem(
            'product-1',
          ),
        ).toThrow(
          GuestCartMergePendingError,
        )

        expect(readGuestCart()).toEqual([
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ])
      })
    },
  )

  describe(
    'conclusão da tentativa de merge',
    () => {
      function createPendingAttempt() {
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

        const attempt =
          getOrCreateGuestCartMergeAttempt()

        if (!attempt) {
          throw new Error(
            'Tentativa de merge não criada',
          )
        }

        return attempt
      }

      test('remove carrinho e tentativa depois de merge confirmado', () => {
        const attempt =
          createPendingAttempt()

        completeGuestCartMerge(
          attempt.mergeKey,
        )

        expect(readGuestCart()).toEqual(
          [],
        )

        expect(
          readGuestCartMergeAttempt(),
        ).toBeNull()

        expect(
          window.localStorage.getItem(
            GUEST_CART_STORAGE_KEY,
          ),
        ).toBeNull()

        expect(
          window.localStorage.getItem(
            GUEST_CART_MERGE_STORAGE_KEY,
          ),
        ).toBeNull()
      })

      test('não conclui tentativa com mergeKey diferente', () => {
        const attempt =
          createPendingAttempt()

        expect(() =>
          completeGuestCartMerge(
            'different-key',
          ),
        ).toThrow(
          GuestCartValidationError,
        )

        expect(readGuestCart()).toEqual([
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ])

        expect(
          readGuestCartMergeAttempt(),
        ).toEqual(attempt)
      })

      test('descarta apenas a tentativa e preserva o carrinho', () => {
        const attempt =
          createPendingAttempt()

        discardGuestCartMergeAttempt(
          attempt.mergeKey,
        )

        expect(readGuestCart()).toEqual([
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ])

        expect(
          readGuestCartMergeAttempt(),
        ).toBeNull()
      })

      test('não descarta tentativa com mergeKey diferente', () => {
        const attempt =
          createPendingAttempt()

        expect(() =>
          discardGuestCartMergeAttempt(
            'different-key',
          ),
        ).toThrow(
          GuestCartValidationError,
        )

        expect(readGuestCart()).toEqual([
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ])

        expect(
          readGuestCartMergeAttempt(),
        ).toEqual(attempt)
      })
    },
  )

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

  describe(
    'updateGuestCartItemQuantity',
    () => {
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
    },
  )

  describe(
    'removeGuestCartItem',
    () => {
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
    },
  )
})
