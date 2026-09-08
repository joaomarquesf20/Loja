import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  CheckoutCartChangedError,
  CheckoutEmptyCartError,
  CheckoutInsufficientStockError,
  CheckoutPricingError,
  CheckoutProductUnavailableError,
  CheckoutUserUnavailableError,
  CheckoutValidationError,
  createCheckoutOrder,
  type CheckoutClient,
  type CheckoutPricingPolicy,
  type CheckoutShippingInput,
} from './checkout'

const shipping:
  CheckoutShippingInput = {
    name: 'Maria Silva',
    phone: '+351 912 345 678',
    addressLine1:
      'Rua das Flores 10',
    addressLine2: '2.º Esq.',
    city: 'Porto',
    postalCode: '4000-123',
    country: 'Portugal',
  }

const defaultPricing:
  CheckoutPricingPolicy = () => ({
    shippingCostCents: 500,
    taxCents: 123,
  })

function createProduct(
  overrides?: Partial<{
    id: string
    name: string
    sku: string
    price: string
    stockQuantity: number
    isActive: boolean
  }>,
) {
  return {
    id:
      overrides?.id ??
      'product-1',
    name:
      overrides?.name ??
      'Produto 1',
    sku:
      overrides?.sku ??
      'SKU-1',
    price:
      overrides?.price ??
      '19.99',
    stockQuantity:
      overrides
        ?.stockQuantity ??
      10,
    isActive:
      overrides?.isActive ??
      true,
  }
}

function createCartItem(
  overrides?: Partial<{
    id: string
    productId: string
    quantity: number
    product:
      ReturnType<
        typeof createProduct
      >
  }>,
) {
  const product =
    overrides?.product ??
    createProduct()

  return {
    id:
      overrides?.id ??
      'cart-1',
    productId:
      overrides?.productId ??
      product.id,
    quantity:
      overrides?.quantity ??
      2,
    product,
  }
}

function createTransactionMock() {
  return {
    user: {
      findFirst: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
    },
    orderItem: {
      createMany: vi.fn(),
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
    } as unknown as CheckoutClient,
    transaction,
  }
}

function prepareSuccessfulCheckout(
  tx: ReturnType<
    typeof createTransactionMock
  >,
) {
  tx.user.findFirst.mockResolvedValue(
    {
      id: 'user-1',
      email:
        'cliente@example.com',
    },
  )

  tx.cartItem.findMany.mockResolvedValue(
    [
      createCartItem(),
    ],
  )

  tx.product.updateMany.mockResolvedValue(
    {
      count: 1,
    },
  )

  tx.order.create.mockImplementation(
    async ({
      data,
    }: {
      data: {
        orderNumber: string
      }
    }) => ({
      id: 'order-1',
      orderNumber:
        data.orderNumber,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    }),
  )

  tx.orderItem.createMany.mockResolvedValue(
    {
      count: 1,
    },
  )

  tx.cartItem.deleteMany.mockResolvedValue(
    {
      count: 1,
    },
  )
}

describe(
  'createCheckoutOrder',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('rejeita utilizador vazio antes de iniciar transação', async () => {
      const tx =
        createTransactionMock()

      const {
        client,
        transaction,
      } = createClient(tx)

      await expect(
        createCheckoutOrder(
          '   ',
          shipping,
          defaultPricing,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CheckoutValidationError,
      )

      expect(
        transaction,
      ).not.toHaveBeenCalled()
    })

    test('rejeita dados de entrega inválidos antes de iniciar transação', async () => {
      const tx =
        createTransactionMock()

      const {
        client,
        transaction,
      } = createClient(tx)

      await expect(
        createCheckoutOrder(
          'user-1',
          {
            ...shipping,
            name: '   ',
          },
          defaultPricing,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CheckoutValidationError,
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
        createCheckoutOrder(
          'user-1',
          shipping,
          defaultPricing,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CheckoutUserUnavailableError,
      )

      expect(
        tx.cartItem.findMany,
      ).not.toHaveBeenCalled()
    })

    test('rejeita carrinho vazio', async () => {
      const tx =
        createTransactionMock()

      tx.user.findFirst.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'cliente@example.com',
        },
      )

      tx.cartItem.findMany.mockResolvedValue(
        [],
      )

      const { client } =
        createClient(tx)

      await expect(
        createCheckoutOrder(
          'user-1',
          shipping,
          defaultPricing,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CheckoutEmptyCartError,
      )

      expect(
        tx.product.updateMany,
      ).not.toHaveBeenCalled()
    })

    test('rejeita produto inativo', async () => {
      const tx =
        createTransactionMock()

      tx.user.findFirst.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'cliente@example.com',
        },
      )

      tx.cartItem.findMany.mockResolvedValue(
        [
          createCartItem({
            product:
              createProduct({
                isActive: false,
              }),
          }),
        ],
      )

      const { client } =
        createClient(tx)

      await expect(
        createCheckoutOrder(
          'user-1',
          shipping,
          defaultPricing,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CheckoutProductUnavailableError,
      )

      expect(
        tx.product.updateMany,
      ).not.toHaveBeenCalled()
    })

    test('rejeita quantidade superior ao stock', async () => {
      const tx =
        createTransactionMock()

      tx.user.findFirst.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'cliente@example.com',
        },
      )

      tx.cartItem.findMany.mockResolvedValue(
        [
          createCartItem({
            quantity: 3,
            product:
              createProduct({
                stockQuantity: 2,
              }),
          }),
        ],
      )

      const { client } =
        createClient(tx)

      await expect(
        createCheckoutOrder(
          'user-1',
          shipping,
          defaultPricing,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CheckoutInsufficientStockError,
      )

      expect(
        tx.order.create,
      ).not.toHaveBeenCalled()
    })

    test('rejeita política de preços inválida sem alterar stock', async () => {
      const tx =
        createTransactionMock()

      prepareSuccessfulCheckout(
        tx,
      )

      const invalidPricing:
        CheckoutPricingPolicy =
        () => ({
          shippingCostCents: -1,
          taxCents: 0,
        })

      const { client } =
        createClient(tx)

      await expect(
        createCheckoutOrder(
          'user-1',
          shipping,
          invalidPricing,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CheckoutPricingError,
      )

      expect(
        tx.product.updateMany,
      ).not.toHaveBeenCalled()

      expect(
        tx.order.create,
      ).not.toHaveBeenCalled()
    })

    test('cria encomenda com preços do servidor, snapshots e limpa apenas os itens processados', async () => {
      const tx =
        createTransactionMock()

      tx.user.findFirst.mockResolvedValue(
        {
          id: 'user-1',
          email:
            'cliente@example.com',
        },
      )

      tx.cartItem.findMany.mockResolvedValue(
        [
          createCartItem({
            id: 'cart-1',
            quantity: 2,
            product:
              createProduct({
                id: 'product-1',
                name: 'Produto 1',
                sku: 'SKU-1',
                price: '19.99',
              }),
          }),
          createCartItem({
            id: 'cart-2',
            productId:
              'product-2',
            quantity: 1,
            product:
              createProduct({
                id: 'product-2',
                name: 'Produto 2',
                sku: 'SKU-2',
                price: '10.00',
              }),
          }),
        ],
      )

      tx.product.updateMany.mockResolvedValue(
        {
          count: 1,
        },
      )

      tx.order.create.mockImplementation(
        async ({
          data,
        }: {
          data: {
            orderNumber: string
          }
        }) => ({
          id: 'order-1',
          orderNumber:
            data.orderNumber,
          status: 'PENDING',
          paymentStatus:
            'UNPAID',
        }),
      )

      tx.orderItem.createMany.mockResolvedValue(
        {
          count: 2,
        },
      )

      tx.cartItem.deleteMany.mockResolvedValue(
        {
          count: 2,
        },
      )

      const pricingPolicy =
        vi.fn<
          CheckoutPricingPolicy
        >(() => ({
          shippingCostCents: 500,
          taxCents: 123,
        }))

      const {
        client,
        transaction,
      } = createClient(tx)

      const result =
        await createCheckoutOrder(
          ' user-1 ',
          {
            ...shipping,
            name: ' Maria Silva ',
          },
          pricingPolicy,
          client,
        )

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
        pricingPolicy,
      ).toHaveBeenCalledWith({
        subtotalCents: 4998,
        shipping: {
          name: 'Maria Silva',
          phone:
            '+351 912 345 678',
          addressLine1:
            'Rua das Flores 10',
          addressLine2:
            '2.º Esq.',
          city: 'Porto',
          postalCode:
            '4000-123',
          country: 'Portugal',
        },
      })

      expect(
        tx.product.updateMany,
      ).toHaveBeenNthCalledWith(
        1,
        {
          where: {
            id: 'product-1',
            isActive: true,
            stockQuantity: {
              gte: 2,
            },
          },
          data: {
            stockQuantity: {
              decrement: 2,
            },
          },
        },
      )

      expect(
        tx.product.updateMany,
      ).toHaveBeenNthCalledWith(
        2,
        {
          where: {
            id: 'product-2',
            isActive: true,
            stockQuantity: {
              gte: 1,
            },
          },
          data: {
            stockQuantity: {
              decrement: 1,
            },
          },
        },
      )

      expect(
        tx.order.create,
      ).toHaveBeenCalledWith({
        data: {
          orderNumber:
            expect.stringMatching(
              /^PFA-[A-F0-9]{12}$/,
            ),
          userId: 'user-1',
          subtotal: '49.98',
          shippingCost: '5.00',
          tax: '1.23',
          total: '56.21',
          shippingName:
            'Maria Silva',
          shippingEmail:
            'cliente@example.com',
          shippingPhone:
            '+351 912 345 678',
          shippingAddressLine1:
            'Rua das Flores 10',
          shippingAddressLine2:
            '2.º Esq.',
          shippingCity: 'Porto',
          shippingPostalCode:
            '4000-123',
          shippingCountry:
            'Portugal',
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
        },
      })

      expect(
        tx.orderItem.createMany,
      ).toHaveBeenCalledWith({
        data: [
          {
            orderId: 'order-1',
            productId:
              'product-1',
            productNameAtPurchase:
              'Produto 1',
            productSkuAtPurchase:
              'SKU-1',
            priceAtPurchase:
              '19.99',
            quantity: 2,
            subtotalAtPurchase:
              '39.98',
          },
          {
            orderId: 'order-1',
            productId:
              'product-2',
            productNameAtPurchase:
              'Produto 2',
            productSkuAtPurchase:
              'SKU-2',
            priceAtPurchase:
              '10.00',
            quantity: 1,
            subtotalAtPurchase:
              '10.00',
          },
        ],
      })

      expect(
        tx.cartItem.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          id: {
            in: [
              'cart-1',
              'cart-2',
            ],
          },
        },
      })

      expect(result).toEqual({
        id: 'order-1',
        orderNumber:
          expect.stringMatching(
            /^PFA-[A-F0-9]{12}$/,
          ),
        subtotal: 49.98,
        shippingCost: 5,
        tax: 1.23,
        total: 56.21,
        status: 'PENDING',
        paymentStatus:
          'UNPAID',
      })
    })

    test('converte complemento vazio para null', async () => {
      const tx =
        createTransactionMock()

      prepareSuccessfulCheckout(
        tx,
      )

      const { client } =
        createClient(tx)

      await createCheckoutOrder(
        'user-1',
        {
          ...shipping,
          addressLine2: '   ',
        },
        defaultPricing,
        client,
      )

      expect(
        tx.order.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data:
            expect.objectContaining({
              shippingAddressLine2:
                null,
            }),
        }),
      )
    })

    test('rejeita alteração concorrente de stock antes de criar encomenda', async () => {
      const tx =
        createTransactionMock()

      prepareSuccessfulCheckout(
        tx,
      )

      tx.product.updateMany.mockResolvedValueOnce(
        {
          count: 0,
        },
      )

      const { client } =
        createClient(tx)

      await expect(
        createCheckoutOrder(
          'user-1',
          shipping,
          defaultPricing,
          client,
        ),
      ).rejects.toBeInstanceOf(
        CheckoutCartChangedError,
      )

      expect(
        tx.order.create,
      ).not.toHaveBeenCalled()

      expect(
        tx.cartItem.deleteMany,
      ).not.toHaveBeenCalled()
    })

    test('repete transação serializable em erro P2034', async () => {
      const tx =
        createTransactionMock()

      prepareSuccessfulCheckout(
        tx,
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
      } as unknown as CheckoutClient

      const result =
        await createCheckoutOrder(
          'user-1',
          shipping,
          defaultPricing,
          client,
        )

      expect(
        transaction,
      ).toHaveBeenCalledTimes(2)

      expect(
        transaction,
      ).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        {
          isolationLevel:
            'Serializable',
        },
      )

      expect(
        transaction,
      ).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        {
          isolationLevel:
            'Serializable',
        },
      )

      expect(result.id).toBe(
        'order-1',
      )
    })
  },
)
