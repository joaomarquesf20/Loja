import { createHash } from 'node:crypto'
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  CartInsufficientStockError,
  CartProductUnavailableError,
  CartValidationError,
} from './cart'
import {
  CartMergeConflictError,
  CartMergeUserUnavailableError,
  mergeGuestCartIntoUserCart,
  type CartMergeClient,
} from './cart-merge'
import {
  GuestCartServerValidationError,
  type GuestCartInputItem,
} from './guest-cart'

function createTransactionMock() {
  return {
    user: {
      findFirst: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    guestCartMerge: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
    },
  }
}

function createClient(
  tx: ReturnType<
    typeof createTransactionMock
  >,
) {
  const transaction = vi.fn(
    async (
      callback: (
        transactionClient:
          unknown,
      ) => Promise<unknown>,
    ) =>
      callback(tx),
  )

  return {
    client: {
      $transaction:
        transaction,
    } as unknown as CartMergeClient,
    transaction,
  }
}

function prepareUser(
  tx: ReturnType<
    typeof createTransactionMock
  >,
) {
  tx.user.findFirst.mockResolvedValue(
    {
      id: 'user-1',
    },
  )
}

function claimNewReceipt(
  tx: ReturnType<
    typeof createTransactionMock
  >,
) {
  tx.guestCartMerge.createMany.mockResolvedValue(
    {
      count: 1,
    },
  )
}

function createPayloadHash(
  items: GuestCartInputItem[],
) {
  const canonicalItems = [
    ...items,
  ].sort((left, right) => {
    if (
      left.productId ===
      right.productId
    ) {
      return 0
    }

    return left.productId <
      right.productId
      ? -1
      : 1
  })

  return createHash('sha256')
    .update(
      JSON.stringify(
        canonicalItems,
      ),
      'utf8',
    )
    .digest('hex')
}

describe(
  'mergeGuestCartIntoUserCart',
  () => {
    test('rejeita utilizador vazio antes de iniciar transação', async () => {
      const tx =
        createTransactionMock()

      const {
        client,
        transaction,
      } = createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          '   ',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        transaction,
      ).not.toHaveBeenCalled()
    })

    test('rejeita mergeKey vazio antes de iniciar transação', async () => {
      const tx =
        createTransactionMock()

      const {
        client,
        transaction,
      } = createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          '   ',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        transaction,
      ).not.toHaveBeenCalled()
    })

    test('rejeita mergeKey demasiado longo antes de iniciar transação', async () => {
      const tx =
        createTransactionMock()

      const {
        client,
        transaction,
      } = createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          'a'.repeat(129),
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        transaction,
      ).not.toHaveBeenCalled()
    })

    test('carrinho convidado vazio não inicia transação', async () => {
      const tx =
        createTransactionMock()

      const {
        client,
        transaction,
      } = createClient(tx)

      const result =
        await mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [],
          client,
        )

      expect(result).toEqual({
        mergedItemCount: 0,
      })

      expect(
        transaction,
      ).not.toHaveBeenCalled()
    })

    test('rejeita dados inválidos do carrinho convidado antes da transação', async () => {
      const tx =
        createTransactionMock()

      const {
        client,
        transaction,
      } = createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 0,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        GuestCartServerValidationError,
      )

      expect(
        transaction,
      ).not.toHaveBeenCalled()
    })

    test('rejeita utilizador inexistente ou inativo', async () => {
      const tx =
        createTransactionMock()

      tx.user.findFirst.mockResolvedValue(
        null,
      )

      const { client } =
        createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartMergeUserUnavailableError,
      )

      expect(
        tx.guestCartMerge
          .createMany,
      ).not.toHaveBeenCalled()

      expect(
        tx.product.findMany,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.findMany,
      ).not.toHaveBeenCalled()
    })

    test('devolve receipt existente quando o mesmo merge é repetido', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)

      const items = [
        {
          productId:
            'product-1',
          quantity: 2,
        },
      ]

      tx.guestCartMerge.createMany.mockResolvedValue(
        {
          count: 0,
        },
      )

      tx.guestCartMerge.findUnique.mockResolvedValue(
        {
          userId: 'user-1',
          payloadHash:
            createPayloadHash(
              items,
            ),
          mergedItemCount: 1,
        },
      )

      const { client } =
        createClient(tx)

      const result =
        await mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          items,
          client,
        )

      expect(result).toEqual({
        mergedItemCount: 1,
      })

      expect(
        tx.guestCartMerge.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          mergeKey:
            'merge-key-1',
        },
        select: {
          userId: true,
          payloadHash: true,
          mergedItemCount: true,
        },
      })

      expect(
        tx.product.findMany,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.findMany,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.update,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita reutilização da mesma mergeKey com payload diferente', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)

      tx.guestCartMerge.createMany.mockResolvedValue(
        {
          count: 0,
        },
      )

      tx.guestCartMerge.findUnique.mockResolvedValue(
        {
          userId: 'user-1',
          payloadHash:
            'different-payload-hash',
          mergedItemCount: 1,
        },
      )

      const { client } =
        createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartMergeConflictError,
      )

      expect(
        tx.product.findMany,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.update,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita reutilização da mergeKey por outro utilizador', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)

      const items = [
        {
          productId:
            'product-1',
          quantity: 1,
        },
      ]

      tx.guestCartMerge.createMany.mockResolvedValue(
        {
          count: 0,
        },
      )

      tx.guestCartMerge.findUnique.mockResolvedValue(
        {
          userId: 'other-user',
          payloadHash:
            createPayloadHash(
              items,
            ),
          mergedItemCount: 1,
        },
      )

      const { client } =
        createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          items,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartMergeConflictError,
      )

      expect(
        tx.product.findMany,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.update,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita produto inexistente ou inativo sem alterar carrinho', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)
      claimNewReceipt(tx)

      tx.product.findMany.mockResolvedValue(
        [],
      )

      tx.cartItem.findMany.mockResolvedValue(
        [],
      )

      const { client } =
        createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartProductUnavailableError,
      )

      expect(
        tx.cartItem.update,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita stock insuficiente considerando a quantidade já existente sem fazer fusão parcial', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)
      claimNewReceipt(tx)

      tx.product.findMany.mockResolvedValue(
        [
          {
            id: 'product-1',
            stockQuantity: 10,
            isActive: true,
          },
          {
            id: 'product-2',
            stockQuantity: 3,
            isActive: true,
          },
        ],
      )

      tx.cartItem.findMany.mockResolvedValue(
        [
          {
            id: 'cart-1',
            productId:
              'product-1',
            quantity: 2,
          },
          {
            id: 'cart-2',
            productId:
              'product-2',
            quantity: 2,
          },
        ],
      )

      const { client } =
        createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 2,
            },
            {
              productId:
                'product-2',
              quantity: 2,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartInsufficientStockError,
      )

      expect(
        tx.cartItem.update,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.create,
      ).not.toHaveBeenCalled()
    })

    test('combina duplicados, incrementa itens existentes, cria novos itens e regista receipt', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)
      claimNewReceipt(tx)

      tx.product.findMany.mockResolvedValue(
        [
          {
            id: 'product-1',
            stockQuantity: 10,
            isActive: true,
          },
          {
            id: 'product-2',
            stockQuantity: 5,
            isActive: true,
          },
        ],
      )

      tx.cartItem.findMany.mockResolvedValue(
        [
          {
            id: 'cart-1',
            productId:
              'product-1',
            quantity: 4,
          },
        ],
      )

      tx.cartItem.update.mockResolvedValue(
        {
          id: 'cart-1',
        },
      )

      tx.cartItem.create.mockResolvedValue(
        {
          id: 'cart-2',
        },
      )

      const {
        client,
        transaction,
      } = createClient(tx)

      const result =
        await mergeGuestCartIntoUserCart(
          ' user-1 ',
          ' merge-key-1 ',
          [
            {
              productId:
                'product-1',
              quantity: 2,
            },
            {
              productId:
                ' product-1 ',
              quantity: 1,
            },
            {
              productId:
                'product-2',
              quantity: 2,
            },
          ],
          client,
        )

      const normalizedItems = [
        {
          productId:
            'product-1',
          quantity: 3,
        },
        {
          productId:
            'product-2',
          quantity: 2,
        },
      ]

      expect(
        transaction,
      ).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel:
            'Serializable',
        },
      )

      expect(
        tx.guestCartMerge
          .createMany,
      ).toHaveBeenCalledWith({
        data: [
          {
            mergeKey:
              'merge-key-1',
            userId: 'user-1',
            payloadHash:
              createPayloadHash(
                normalizedItems,
              ),
            mergedItemCount: 2,
          },
        ],
        skipDuplicates: true,
      })

      expect(
        tx.product.findMany,
      ).toHaveBeenCalledWith({
        where: {
          id: {
            in: [
              'product-1',
              'product-2',
            ],
          },
        },
        select: {
          id: true,
          stockQuantity: true,
          isActive: true,
        },
      })

      expect(
        tx.cartItem.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          productId: {
            in: [
              'product-1',
              'product-2',
            ],
          },
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
        },
      })

      expect(
        tx.cartItem.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'cart-1',
        },
        data: {
          quantity: 7,
        },
        select: {
          id: true,
        },
      })

      expect(
        tx.cartItem.create,
      ).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          productId:
            'product-2',
          quantity: 2,
        },
        select: {
          id: true,
        },
      })

      expect(result).toEqual({
        mergedItemCount: 2,
      })
    })

    test('rejeita quantidade inválida já existente no carrinho', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)
      claimNewReceipt(tx)

      tx.product.findMany.mockResolvedValue(
        [
          {
            id: 'product-1',
            stockQuantity: 10,
            isActive: true,
          },
        ],
      )

      tx.cartItem.findMany.mockResolvedValue(
        [
          {
            id: 'cart-1',
            productId:
              'product-1',
            quantity: 0,
          },
        ],
      )

      const { client } =
        createClient(tx)

      await expect(
        mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        ),
      ).rejects.toBeInstanceOf(
        CartValidationError,
      )

      expect(
        tx.cartItem.update,
      ).not.toHaveBeenCalled()
    })

    test('repete transação serializable em erro P2034', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)
      claimNewReceipt(tx)

      tx.product.findMany.mockResolvedValue(
        [
          {
            id: 'product-1',
            stockQuantity: 10,
            isActive: true,
          },
        ],
      )

      tx.cartItem.findMany.mockResolvedValue(
        [],
      )

      tx.cartItem.create.mockResolvedValue(
        {
          id: 'cart-1',
        },
      )

      const transaction =
        vi.fn()

      transaction
        .mockRejectedValueOnce({
          code: 'P2034',
        })
        .mockImplementationOnce(
          async (
            callback: (
              transactionClient:
                unknown,
            ) => Promise<unknown>,
          ) =>
            callback(tx),
        )

      const client = {
        $transaction:
          transaction,
      } as unknown as CartMergeClient

      const result =
        await mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        )

      expect(
        transaction,
      ).toHaveBeenCalledTimes(2)

      expect(result).toEqual({
        mergedItemCount: 1,
      })
    })

    test('repete transação quando ocorre conflito único P2002', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)
      claimNewReceipt(tx)

      tx.product.findMany.mockResolvedValue(
        [
          {
            id: 'product-1',
            stockQuantity: 10,
            isActive: true,
          },
        ],
      )

      tx.cartItem.findMany.mockResolvedValue(
        [],
      )

      tx.cartItem.create.mockResolvedValue(
        {
          id: 'cart-1',
        },
      )

      const transaction =
        vi.fn()

      transaction
        .mockRejectedValueOnce({
          code: 'P2002',
        })
        .mockImplementationOnce(
          async (
            callback: (
              transactionClient:
                unknown,
            ) => Promise<unknown>,
          ) =>
            callback(tx),
        )

      const client = {
        $transaction:
          transaction,
      } as unknown as CartMergeClient

      const result =
        await mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        )

      expect(
        transaction,
      ).toHaveBeenCalledTimes(2)

      expect(result).toEqual({
        mergedItemCount: 1,
      })
    })

    test('repete transação quando o receipt concorrente ainda não está visível', async () => {
      const tx =
        createTransactionMock()

      prepareUser(tx)

      tx.guestCartMerge.createMany
        .mockResolvedValueOnce({
          count: 0,
        })
        .mockResolvedValueOnce({
          count: 1,
        })

      tx.guestCartMerge.findUnique.mockResolvedValue(
        null,
      )

      tx.product.findMany.mockResolvedValue(
        [
          {
            id: 'product-1',
            stockQuantity: 10,
            isActive: true,
          },
        ],
      )

      tx.cartItem.findMany.mockResolvedValue(
        [],
      )

      tx.cartItem.create.mockResolvedValue(
        {
          id: 'cart-1',
        },
      )

      const {
        client,
        transaction,
      } = createClient(tx)

      const result =
        await mergeGuestCartIntoUserCart(
          'user-1',
          'merge-key-1',
          [
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ],
          client,
        )

      expect(
        transaction,
      ).toHaveBeenCalledTimes(2)

      expect(
        tx.guestCartMerge
          .findUnique,
      ).toHaveBeenCalledTimes(1)

      expect(result).toEqual({
        mergedItemCount: 1,
      })
    })
  },
)
