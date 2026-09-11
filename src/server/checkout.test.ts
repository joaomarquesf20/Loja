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
    region:
      'PORTUGAL_MAINLAND',
  }

const checkoutRegions = [
  'PORTUGAL_MAINLAND',
  'MADEIRA',
  'AZORES',
  'INTERNATIONAL',
] as const

const shippingClasses = [
  'SMALL',
  'STANDARD',
  'BULKY',
  'HEAVY',
  'QUOTE_REQUIRED',
  'UNASSIGNED',
] as const

function createRegionRules() {
  return checkoutRegions.map(
    (region) => ({
      region,
      checkoutEnabled:
        region ===
        'PORTUGAL_MAINLAND',
      taxRatePercent:
        region ===
        'PORTUGAL_MAINLAND'
          ? '23.00'
          : null,
    }),
  )
}

function createShippingRules() {
  return checkoutRegions.flatMap(
    (region) =>
      shippingClasses.map(
        (shippingClass) => {
          if (
            region !==
            'PORTUGAL_MAINLAND'
          ) {
            return {
              id:
                `${region}-${shippingClass}`,
              region,
              shippingClass,
              checkoutEnabled: false,
              shippingCost: null,
              maximumShippingCost:
                null,
              freeShippingThreshold:
                null,
            }
          }

          if (
            shippingClass ===
            'SMALL'
          ) {
            return {
              id: 'mainland-small',
              region,
              shippingClass,
              checkoutEnabled: true,
              shippingCost: '5.90',
              maximumShippingCost:
                null,
              freeShippingThreshold:
                '150.00',
            }
          }

          if (
            shippingClass ===
            'STANDARD'
          ) {
            return {
              id:
                'mainland-standard',
              region,
              shippingClass,
              checkoutEnabled: true,
              shippingCost: '8.90',
              maximumShippingCost:
                null,
              freeShippingThreshold:
                '150.00',
            }
          }

          if (
            shippingClass ===
            'BULKY'
          ) {
            return {
              id: 'mainland-bulky',
              region,
              shippingClass,
              checkoutEnabled: true,
              shippingCost: '19.90',
              maximumShippingCost:
                '29.90',
              freeShippingThreshold:
                null,
            }
          }

          return {
            id:
              `mainland-${shippingClass}`,
            region,
            shippingClass,
            checkoutEnabled: false,
            shippingCost: null,
            maximumShippingCost:
              null,
            freeShippingThreshold:
              null,
          }
        },
      ),
  )
}

function createProduct(
  overrides?: Partial<{
    id: string
    name: string
    sku: string
    price: string
    stockQuantity: number
    isActive: boolean
    shippingClass:
      | 'SMALL'
      | 'STANDARD'
      | 'BULKY'
      | 'HEAVY'
      | 'QUOTE_REQUIRED'
      | 'UNASSIGNED'
    shippingRates: Array<{
      region:
        'PORTUGAL_MAINLAND'
      shippingCost: string
    }>
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
    shippingClass:
      overrides
        ?.shippingClass ??
      'SMALL',
    shippingRates:
      overrides
        ?.shippingRates ??
      [],
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
    storeSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    checkoutRegionRule: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    shippingRule: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
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

function prepareCommercialSettings(
  tx: ReturnType<
    typeof createTransactionMock
  >,
) {
  tx.storeSettings.findUnique.mockResolvedValue(
    {
      id: 'store',
      pricesIncludeTax: true,
    },
  )

  tx.checkoutRegionRule.findMany.mockResolvedValue(
    createRegionRules(),
  )

  tx.shippingRule.findMany.mockResolvedValue(
    createShippingRules(),
  )
}

function prepareSuccessfulCheckout(
  tx: ReturnType<
    typeof createTransactionMock
  >,
  cartItems = [
    createCartItem(),
  ],
) {
  tx.user.findFirst.mockResolvedValue(
    {
      id: 'user-1',
      email:
        'cliente@example.com',
    },
  )

  tx.cartItem.findMany.mockResolvedValue(
    cartItems,
  )

  prepareCommercialSettings(tx)

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
      count: cartItems.length,
    },
  )

  tx.cartItem.deleteMany.mockResolvedValue(
    {
      count: cartItems.length,
    },
  )
}

describe(
  'createCheckoutOrder',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'rejeita utilizador vazio antes de iniciar transação',
      async () => {
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
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutValidationError,
        )

        expect(
          transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita dados de entrega inválidos antes de iniciar transação',
      async () => {
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
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutValidationError,
        )

        expect(
          transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita código postal português com formato inválido antes de iniciar transação',
      async () => {
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
              postalCode:
                '4000123',
            },
            client,
          ),
        ).rejects.toThrow(
          'Código postal inválido',
        )

        expect(
          transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test.each([
      '9000-001',
      '9500-001',
    ])(
      'rejeita código postal insular %s mesmo quando a região enviada é Continental',
      async (postalCode) => {
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
              postalCode,
              region:
                'PORTUGAL_MAINLAND',
            },
            client,
          ),
        ).rejects.toThrow(
          /Portugal Continental/,
        )

        expect(
          transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita região diferente de Portugal Continental antes de iniciar transação',
      async () => {
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
              region: 'MADEIRA',
            },
            client,
          ),
        ).rejects.toThrow(
          /Portugal Continental/,
        )

        expect(
          transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita país diferente de Portugal antes de iniciar transação',
      async () => {
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
              country: 'Espanha',
            },
            client,
          ),
        ).rejects.toThrow(
          /Portugal Continental/,
        )

        expect(
          transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'converte complemento vazio para null',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(tx)

        const { client } =
          createClient(tx)

        await createCheckoutOrder(
          'user-1',
          {
            ...shipping,
            addressLine2: '   ',
          },
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
      },
    )

    test(
      'rejeita utilizador indisponível',
      async () => {
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
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutUserUnavailableError,
        )

        expect(
          tx.cartItem.findMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita carrinho vazio',
      async () => {
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
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutEmptyCartError,
        )

        expect(
          tx.storeSettings
            .findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita quantidade inválida no carrinho',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          tx,
          [
            createCartItem({
              quantity: 0,
            }),
          ],
        )

        const { client } =
          createClient(tx)

        await expect(
          createCheckoutOrder(
            'user-1',
            shipping,
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutCartChangedError,
        )

        expect(
          tx.product.updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita produto inativo',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          tx,
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
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutProductUnavailableError,
        )

        expect(
          tx.product.updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita produto sem stock suficiente',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          tx,
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
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutInsufficientStockError,
        )

        expect(
          tx.product.updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita preço inválido do produto',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          tx,
          [
            createCartItem({
              product:
                createProduct({
                  price: '19.999',
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
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutProductUnavailableError,
        )

        expect(
          tx.product.updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'cria encomenda Pequena com portes e IVA incluído sem somar IVA ao total',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(tx)

        const { client } =
          createClient(tx)

        const result =
          await createCheckoutOrder(
            'user-1',
            shipping,
            client,
          )

        expect(result).toMatchObject({
          id: 'order-1',
          subtotal: 39.98,
          shippingCost: 5.9,
          tax: 8.58,
          total: 45.88,
          status: 'PENDING',
          paymentStatus:
            'UNPAID',
        })

        expect(
          result.total,
        ).toBeCloseTo(
          result.subtotal +
            result.shippingCost,
          2,
        )

        expect(
          tx.cartItem.findMany,
        ).toHaveBeenCalledWith({
          where: {
            userId: 'user-1',
          },
          orderBy: {
            id: 'asc',
          },
          select: {
            id: true,
            productId: true,
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                stockQuantity: true,
                isActive: true,
                shippingClass: true,
                shippingRates: {
                  where: {
                    region:
                      'PORTUGAL_MAINLAND',
                  },
                  select: {
                    region: true,
                    shippingCost: true,
                  },
                },
              },
            },
          },
        })

        expect(
          tx.order.create,
        ).toHaveBeenCalledOnce()

        const orderCall =
          tx.order.create.mock
            .calls[0][0]

        expect(
          orderCall.data,
        ).toMatchObject({
          userId: 'user-1',
          subtotal: '39.98',
          shippingCost: '5.90',
          tax: '8.58',
          total: '45.88',
          shippingName:
            'Maria Silva',
          shippingEmail:
            'cliente@example.com',
          shippingCountry:
            'Portugal',
          shippingRegion:
            'PORTUGAL_MAINLAND',
          shippingClassApplied:
            'SMALL',
          taxRatePercent:
            '23.00',
          pricesIncludeTax: true,
          nonVolumousSubtotal:
            '39.98',
          nonVolumousShippingCost:
            '5.90',
          bulkyShippingCost:
            '0.00',
          freeShippingThreshold:
            '150.00',
          freeShippingApplied:
            false,
        })

        expect(
          tx.orderItem.createMany,
        ).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({
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
              shippingClassAtPurchase:
                'SMALL',
              shippingCostAtPurchase:
                null,
            }),
          ],
        })

        expect(
          tx.cartItem.deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            userId: 'user-1',
            id: {
              in: ['cart-1'],
            },
          },
        })
      },
    )

    test(
      'grava a tarifa específica por unidade de produto Volumoso',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          tx,
          [
            createCartItem({
              quantity: 2,
              product:
                createProduct({
                  shippingClass:
                    'BULKY',
                  price: '100.00',
                  shippingRates: [
                    {
                      region:
                        'PORTUGAL_MAINLAND',
                      shippingCost:
                        '24.90',
                    },
                  ],
                }),
            }),
          ],
        )

        const { client } =
          createClient(tx)

        const result =
          await createCheckoutOrder(
            'user-1',
            shipping,
            client,
          )

        expect(
          result.subtotal,
        ).toBe(200)

        expect(
          result.shippingCost,
        ).toBe(49.8)

        expect(
          result.total,
        ).toBe(249.8)

        expect(
          result.tax,
        ).toBe(46.71)

        const orderCall =
          tx.order.create.mock
            .calls[0][0]

        expect(
          orderCall.data,
        ).toMatchObject({
          subtotal: '200.00',
          shippingCost: '49.80',
          total: '249.80',
          shippingClassApplied:
            'BULKY',
          nonVolumousSubtotal:
            '0.00',
          nonVolumousShippingCost:
            '0.00',
          bulkyShippingCost:
            '49.80',
          freeShippingThreshold:
            null,
          freeShippingApplied:
            false,
        })

        const itemCall =
          tx.orderItem.createMany
            .mock.calls[0][0]

        expect(
          itemCall.data[0],
        ).toMatchObject({
          shippingClassAtPurchase:
            'BULKY',
          shippingCostAtPurchase:
            '24.90',
        })
      },
    )

    test(
      'carrinho misto aplica portes grátis apenas à componente não volumosa',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          tx,
          [
            createCartItem({
              id: 'cart-standard',
              productId:
                'standard',
              quantity: 1,
              product:
                createProduct({
                  id: 'standard',
                  sku: 'STD-1',
                  price: '160.00',
                  shippingClass:
                    'STANDARD',
                }),
            }),
            createCartItem({
              id: 'cart-bulky',
              productId: 'bulky',
              quantity: 1,
              product:
                createProduct({
                  id: 'bulky',
                  sku: 'BLK-1',
                  price: '100.00',
                  shippingClass:
                    'BULKY',
                  shippingRates: [
                    {
                      region:
                        'PORTUGAL_MAINLAND',
                      shippingCost:
                        '24.90',
                    },
                  ],
                }),
            }),
          ],
        )

        const { client } =
          createClient(tx)

        const result =
          await createCheckoutOrder(
            'user-1',
            shipping,
            client,
          )

        expect(result).toMatchObject({
          subtotal: 260,
          shippingCost: 24.9,
          total: 284.9,
        })

        const orderCall =
          tx.order.create.mock
            .calls[0][0]

        expect(
          orderCall.data,
        ).toMatchObject({
          subtotal: '260.00',
          shippingCost: '24.90',
          total: '284.90',
          shippingClassApplied:
            null,
          nonVolumousSubtotal:
            '160.00',
          nonVolumousShippingCost:
            '0.00',
          bulkyShippingCost:
            '24.90',
          freeShippingThreshold:
            '150.00',
          freeShippingApplied:
            true,
        })
      },
    )

    test(
      'usa a configuração comercial guardada em vez de tarifa fixa no checkout',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(tx)

        const rules =
          createShippingRules()

        const smallRule =
          rules.find(
            (rule) =>
              rule.region ===
                'PORTUGAL_MAINLAND' &&
              rule.shippingClass ===
                'SMALL',
          )

        if (!smallRule) {
          throw new Error(
            'Regra SMALL não encontrada no teste',
          )
        }

        smallRule.shippingCost =
          '6.40'

        tx.shippingRule.findMany.mockResolvedValue(
          rules,
        )

        const { client } =
          createClient(tx)

        const result =
          await createCheckoutOrder(
            'user-1',
            shipping,
            client,
          )

        expect(
          result.shippingCost,
        ).toBe(6.4)

        expect(
          result.total,
        ).toBe(46.38)

        expect(
          tx.order.create.mock
            .calls[0][0].data,
        ).toMatchObject({
          shippingCost: '6.40',
          total: '46.38',
        })
      },
    )

    test.each([
      'HEAVY',
      'QUOTE_REQUIRED',
      'UNASSIGNED',
    ] as const)(
      'bloqueia checkout automático para produto %s',
      async (shippingClass) => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          tx,
          [
            createCartItem({
              product:
                createProduct({
                  shippingClass,
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
      },
    )

    test(
      'bloqueia produto Volumoso sem tarifa Mainland antes de alterar stock',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          tx,
          [
            createCartItem({
              product:
                createProduct({
                  shippingClass:
                    'BULKY',
                  shippingRates: [],
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
            client,
          ),
        ).rejects.toThrow(
          /não tem tarifa de transporte/,
        )

        expect(
          tx.product.updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'bloqueia checkout quando Portugal Continental está comercialmente desativado',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(tx)

        const regions =
          createRegionRules()

        const mainland =
          regions.find(
            (region) =>
              region.region ===
              'PORTUGAL_MAINLAND',
          )

        if (!mainland) {
          throw new Error(
            'Portugal Continental não encontrado no teste',
          )
        }

        mainland.checkoutEnabled =
          false

        tx.checkoutRegionRule.findMany.mockResolvedValue(
          regions,
        )

        const { client } =
          createClient(tx)

        await expect(
          createCheckoutOrder(
            'user-1',
            shipping,
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutPricingError,
        )

        expect(
          tx.product.updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita alteração concorrente de stock antes de criar encomenda',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(tx)

        tx.product.updateMany.mockResolvedValue(
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
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutCartChangedError,
        )

        expect(
          tx.order.create,
        ).not.toHaveBeenCalled()

        expect(
          tx.orderItem.createMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'repete transação serializável em conflito P2034',
      async () => {
        const tx =
          createTransactionMock()

        prepareSuccessfulCheckout(tx)

        const transaction =
          vi.fn()

        transaction.mockRejectedValueOnce(
          {
            code: 'P2034',
          },
        )

        transaction.mockImplementationOnce(
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

        await expect(
          createCheckoutOrder(
            'user-1',
            shipping,
            client,
          ),
        ).resolves.toMatchObject({
          id: 'order-1',
          subtotal: 39.98,
          shippingCost: 5.9,
          total: 45.88,
        })

        expect(
          transaction,
        ).toHaveBeenCalledTimes(2)

        expect(
          transaction.mock
            .calls[0][1],
        ).toEqual({
          isolationLevel:
            'Serializable',
        })

        expect(
          transaction.mock
            .calls[1][1],
        ).toEqual({
          isolationLevel:
            'Serializable',
        })
      },
    )

    test(
      'não repete erro transacional que não seja P2034',
      async () => {
        const transaction =
          vi.fn().mockRejectedValue(
            new Error(
              'Falha de base de dados',
            ),
          )

        const client = {
          $transaction:
            transaction,
        } as unknown as CheckoutClient

        await expect(
          createCheckoutOrder(
            'user-1',
            shipping,
            client,
          ),
        ).rejects.toThrow(
          'Falha de base de dados',
        )

        expect(
          transaction,
        ).toHaveBeenCalledOnce()
      },
    )
  },
)
