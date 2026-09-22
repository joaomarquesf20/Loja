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
  CheckoutPreviewChangedError,
  CheckoutPricingError,
  CheckoutProductUnavailableError,
  CheckoutUserUnavailableError,
  CheckoutValidationError,
  createCheckoutOrder,
  previewCheckout,
  type CheckoutClient,
  type CheckoutShippingInput,
} from './checkout'

const validFingerprint = 'a'.repeat(64)

async function previewFingerprint(
  tx: ReturnType<typeof createTransactionMock>,
  shippingInput = shipping,
) {
  const preview = await previewCheckout(
    'user-1', shippingInput, createClient(tx).client,
  )
  return preview.fingerprint
}

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
    price: string | number | { toString(): string }
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
      shippingCost: string | number | { toString(): string }
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

  const productId =
    overrides?.productId ??
    product.id

  return {
    id:
      overrides?.id ??
      'cart-1',
    productId,
    productVariantId:
      `variant-${productId}`,
    quantity:
      overrides?.quantity ??
      2,
    product,
    variant: {
      id: `variant-${productId}`,
      productId,
      sku: product.sku,
      price: product.price,
      stockQuantity:
        product.stockQuantity,
      isActive: true,
      selections: [] as Array<{
        optionValue: {
          value: string
          option: {
            code: string
            name: string
            position: number
          }
        }
      }>,
    },
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
    productVariant: {
      updateMany: vi.fn(),
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
      options: {
        isolationLevel:
          'Serializable'
      },
    ) => {
      void options

      return callback(tx)
    },
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

  tx.productVariant.updateMany.mockResolvedValue(
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
      paymentStatus: 'PENDING',
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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
          await previewFingerprint(tx, { ...shipping, addressLine2: null }),
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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
            await previewFingerprint(tx),
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
            'PENDING',
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
            productVariantId: true,
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
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
            variant: {
              select: {
                id: true,
                productId: true,
                sku: true,
                price: true,
                stockQuantity: true,
                isActive: true,
                selections: {
                  select: {
                    optionValue: {
                      select: {
                        value: true,
                        option: {
                          select: {
                            code: true,
                            name: true,
                            position: true,
                          },
                        },
                      },
                    },
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
      'usa SKU, preço, stock e snapshot da variante no checkout',
      async () => {
        const baseTx =
          createTransactionMock()

        const variantUpdateMany =
          vi.fn().mockResolvedValue({
            count: 1,
          })

        const tx = {
          ...baseTx,
          productVariant: {
            updateMany:
              variantUpdateMany,
          },
        }

        const product =
          createProduct({
            sku: 'LEGACY-SKU',
            price: '999.00',
            stockQuantity: 50,
          })

        const variantCartItem = {
          ...createCartItem({
            product,
            quantity: 2,
          }),
          productVariantId:
            'variant-1',
          variant: {
            id: 'variant-1',
            productId:
              product.id,
            sku: 'VAR-SKU-19',
            optionKey:
              'default',
            price: '25.50',
            stockQuantity: 3,
            isActive: true,
            selections: [
              {
                optionValue: {
                  value: '19"',
                  option: {
                    code:
                      'diameter',
                    name:
                      'Diâmetro',
                    position: 0,
                  },
                },
              },
            ],
          },
        }

        prepareSuccessfulCheckout(
          tx,
          [variantCartItem],
        )

        const { client } =
          createClient(tx)

        const fingerprint =
          await previewFingerprint(
            tx,
          )

        const result =
          await createCheckoutOrder(
            'user-1',
            shipping,
            fingerprint,
            client,
          )

        expect(
          result.subtotal,
        ).toBe(51)

        expect(
          variantUpdateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'variant-1',
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
        })

        expect(
          tx.product.updateMany,
        ).not.toHaveBeenCalled()

        expect(
          tx.orderItem.createMany,
        ).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({
              productId:
                'product-1',
              productVariantId:
                'variant-1',
              productNameAtPurchase:
                'Produto 1',
              productSkuAtPurchase:
                'VAR-SKU-19',
              priceAtPurchase:
                '25.50',
              quantity: 2,
              subtotalAtPurchase:
                '51.00',
              variantOptionsAtPurchase:
                [
                  {
                    code:
                      'diameter',
                    name:
                      'Diâmetro',
                    value: '19"',
                  },
                ],
            }),
          ],
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
            await previewFingerprint(tx),
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
            await previewFingerprint(tx),
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
            await previewFingerprint(tx),
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
            validFingerprint,
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
            validFingerprint,
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
            validFingerprint,
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

        tx.productVariant.updateMany.mockResolvedValue(
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
            await previewFingerprint(tx),
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
            await previewFingerprint(tx),
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
            validFingerprint,
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

describe(
  'previewCheckout',
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
          previewCheckout(
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
      'devolve os mesmos totais comerciais do checkout real sem alterar carrinho, stock ou encomendas',
      async () => {
        const previewTx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          previewTx,
        )

        const {
          client: previewClient,
          transaction:
            previewTransaction,
        } = createClient(
          previewTx,
        )

        const orderTx =
          createTransactionMock()

        prepareSuccessfulCheckout(
          orderTx,
        )

        const { client: orderClient } =
          createClient(orderTx)

        const preview =
          await previewCheckout(
            'user-1',
            shipping,
            previewClient,
          )

        const order =
          await createCheckoutOrder(
            'user-1',
            shipping,
            preview.fingerprint,
            orderClient,
          )

        expect(preview).toEqual({
          fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
          subtotal: order.subtotal,
          shippingCost:
            order.shippingCost,
          tax: order.tax,
          total: order.total,
        })

        expect(preview).toEqual({
          fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
          subtotal: 39.98,
          shippingCost: 5.9,
          tax: 8.58,
          total: 45.88,
        })

        expect(order).not.toHaveProperty('fingerprint')

        expect(
          previewTransaction,
        ).toHaveBeenCalledOnce()

        expect(
          previewTransaction.mock
            .calls[0][1],
        ).toEqual({
          isolationLevel:
            'Serializable',
        })

        expect(
          previewTx.product
            .updateMany,
        ).not.toHaveBeenCalled()

        expect(
          previewTx.order.create,
        ).not.toHaveBeenCalled()

        expect(
          previewTx.orderItem
            .createMany,
        ).not.toHaveBeenCalled()

        expect(
          previewTx.cartItem
            .deleteMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'calcula carrinho misto com portes grátis apenas na componente não volumosa sem alterar stock, carrinho ou encomendas',
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

        await expect(
          previewCheckout(
            'user-1',
            shipping,
            client,
          ),
        ).resolves.toEqual({
          fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
          subtotal: 260,
          shippingCost: 24.9,
          tax: 53.27,
          total: 284.9,
        })

        expect(
          tx.product.updateMany,
        ).not.toHaveBeenCalled()

        expect(
          tx.order.create,
        ).not.toHaveBeenCalled()

        expect(
          tx.orderItem.createMany,
        ).not.toHaveBeenCalled()

        expect(
          tx.cartItem.deleteMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'bloqueia preview para produto sem checkout automático antes de qualquer escrita comercial',
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
                    'UNASSIGNED',
                }),
            }),
          ],
        )

        const { client } =
          createClient(tx)

        await expect(
          previewCheckout(
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

        expect(
          tx.orderItem.createMany,
        ).not.toHaveBeenCalled()

        expect(
          tx.cartItem.deleteMany,
        ).not.toHaveBeenCalled()
      },
    )
  },
)

function checkoutScenario(cartItems = [createCartItem()]) {
  const previewTx = createTransactionMock()
  const orderTx = createTransactionMock()
  prepareSuccessfulCheckout(previewTx, cartItems)
  prepareSuccessfulCheckout(orderTx, cartItems)
  return {
    previewTx,
    orderTx,
    previewClient: createClient(previewTx).client,
    ...createClient(orderTx),
  }
}

function expectNoCheckoutWrites(tx: ReturnType<typeof createTransactionMock>) {
  expect(tx.productVariant.updateMany).not.toHaveBeenCalled()
  expect(tx.product.updateMany).not.toHaveBeenCalled()
  expect(tx.order.create).not.toHaveBeenCalled()
  expect(tx.orderItem.createMany).not.toHaveBeenCalled()
  expect(tx.cartItem.deleteMany).not.toHaveBeenCalled()
}

describe('integridade do preview de checkout', () => {
  test.each([
    undefined, null, 123, {}, [], '', 'a'.repeat(63), 'a'.repeat(65),
    'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(64) + '\n',
    ' ' + 'a'.repeat(64),
  ])('rejeita fingerprint inválido %j antes da transação', async (fingerprint) => {
    const { client, transaction } = createClient(createTransactionMock())
    await expect(createCheckoutOrder(
      'user-1', shipping, fingerprint as string, client,
    )).rejects.toThrow('Referência de preview inválida. Calcula novamente o total.')
    expect(transaction).not.toHaveBeenCalled()
  })

  test('preview devolve fingerprint determinístico sem mutações de checkout', async () => {
    const { previewTx, previewClient } = checkoutScenario()
    const first = await previewCheckout('user-1', shipping, previewClient)
    const second = await previewCheckout('user-1', shipping, previewClient)
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(first.fingerprint).toHaveLength(64)
    expect(second).toEqual(first)
    expectNoCheckoutWrites(previewTx)
  })

  test.each([
    ['produto diferente', [createCartItem({ product: createProduct({ id: 'product-2' }) })]],
    ['quantidade e preço compensados', [createCartItem({
      quantity: 1, product: createProduct({ price: '39.98' }),
    })]],
    ['nome guardado na encomenda', [createCartItem({ product: createProduct({ name: 'Novo nome' }) })]],
    ['SKU guardado na encomenda', [createCartItem({ product: createProduct({ sku: 'SKU-2' }) })]],
    ['artigo adicional gratuito', [createCartItem(), createCartItem({
      id: 'cart-2', quantity: 1, product: createProduct({ id: 'gift', price: '0.00' }),
    })]],
  ] as const)('rejeita %s apesar de todos os totais serem iguais', async (_label, items) => {
    const { previewClient, orderTx, client, transaction } = checkoutScenario()
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    orderTx.cartItem.findMany.mockResolvedValue(items)
    const current = await previewCheckout('user-1', shipping, createClient(orderTx).client)
    expect(current).toMatchObject({
      subtotal: accepted.subtotal, shippingCost: accepted.shippingCost,
      tax: accepted.tax, total: accepted.total,
    })
    await expect(createCheckoutOrder(
      'user-1', shipping, accepted.fingerprint, client,
    )).rejects.toBeInstanceOf(CheckoutPreviewChangedError)
    expect(transaction).toHaveBeenCalledOnce()
    expectNoCheckoutWrites(orderTx)
  })

  test.each([
    { name: 'Outra pessoa' }, { phone: '910000001' },
    { addressLine1: 'Rua Central 20' }, { addressLine2: null },
    { city: 'Lisboa' }, { postalCode: '4000-124' },
  ])('rejeita alteração na entrega %j com o mesmo preço', async (change) => {
    const { previewClient, orderTx, client } = checkoutScenario()
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    const changedShipping = { ...shipping, ...change }
    const current = await previewCheckout('user-1', changedShipping, createClient(orderTx).client)
    expect(current.total).toBe(accepted.total)
    await expect(createCheckoutOrder(
      'user-1', changedShipping, accepted.fingerprint, client,
    )).rejects.toBeInstanceOf(CheckoutPreviewChangedError)
    expectNoCheckoutWrites(orderTx)
  })

  test.each(['taxa de IVA', 'limiar de portes grátis'])(
    'rejeita mudança de %s mesmo sem mudar os valores arredondados', async (term) => {
      const { previewClient, orderTx, client } = checkoutScenario()
      const accepted = await previewCheckout('user-1', shipping, previewClient)
      if (term === 'taxa de IVA') {
        orderTx.checkoutRegionRule.findMany.mockResolvedValue(createRegionRules().map(rule =>
          rule.region === 'PORTUGAL_MAINLAND' ? { ...rule, taxRatePercent: '23.01' } : rule,
        ))
      } else {
        orderTx.shippingRule.findMany.mockResolvedValue(createShippingRules().map(rule =>
          rule.id === 'mainland-small' ? { ...rule, freeShippingThreshold: '151.00' } : rule,
        ))
      }
      const current = await previewCheckout('user-1', shipping, createClient(orderTx).client)
      expect(current).toMatchObject({
        subtotal: accepted.subtotal, shippingCost: accepted.shippingCost,
        tax: accepted.tax, total: accepted.total,
      })
      await expect(createCheckoutOrder(
        'user-1', shipping, accepted.fingerprint, client,
      )).rejects.toBeInstanceOf(CheckoutPreviewChangedError)
      expectNoCheckoutWrites(orderTx)
    },
  )

  test('rejeita alteração da classe mesmo com portes idênticos', async () => {
    const { previewClient, orderTx, client } = checkoutScenario()
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    orderTx.cartItem.findMany.mockResolvedValue([
      createCartItem({ product: createProduct({ shippingClass: 'STANDARD' }) }),
    ])
    orderTx.shippingRule.findMany.mockResolvedValue(createShippingRules().map(rule =>
      rule.id === 'mainland-standard' ? { ...rule, shippingCost: '5.90' } : rule,
    ))
    const current = await previewCheckout('user-1', shipping, createClient(orderTx).client)
    expect(current.total).toBe(accepted.total)
    await expect(createCheckoutOrder(
      'user-1', shipping, accepted.fingerprint, client,
    )).rejects.toBeInstanceOf(CheckoutPreviewChangedError)
    expectNoCheckoutWrites(orderTx)
  })

  test('rejeita tarifas volumosas por artigo que se compensam no total', async () => {
    const items = ['20.00', '25.00'].map((shippingCost, index) => createCartItem({
      id: 'cart-' + index, quantity: 1,
      product: createProduct({
        id: 'product-' + index, shippingClass: 'BULKY',
        shippingRates: [{ region: 'PORTUGAL_MAINLAND', shippingCost }],
      }),
    }))
    const { previewClient, orderTx, client } = checkoutScenario(items)
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    orderTx.cartItem.findMany.mockResolvedValue(items.map((item, index) => ({
      ...item, product: { ...item.product, shippingRates: [{
        region: 'PORTUGAL_MAINLAND', shippingCost: index === 0 ? '21.00' : '24.00',
      }] },
    })))
    const current = await previewCheckout('user-1', shipping, createClient(orderTx).client)
    expect(current.shippingCost).toBe(accepted.shippingCost)
    expect(current.total).toBe(accepted.total)
    await expect(createCheckoutOrder(
      'user-1', shipping, accepted.fingerprint, client,
    )).rejects.toBeInstanceOf(CheckoutPreviewChangedError)
    expectNoCheckoutWrites(orderTx)
  })

  test('stock ainda suficiente não invalida o preview', async () => {
    const { previewClient, orderTx, client } = checkoutScenario()
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    orderTx.cartItem.findMany.mockResolvedValue([
      createCartItem({ product: createProduct({ stockQuantity: 2 }) }),
    ])
    await expect(createCheckoutOrder(
      'user-1', shipping, accepted.fingerprint, client,
    )).resolves.toMatchObject({ total: accepted.total })
    expect(orderTx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'variant-product-1', isActive: true, stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } },
    })
  })

  test.each([
    ['stock insuficiente', [createCartItem({ product: createProduct({ stockQuantity: 1 }) })], CheckoutInsufficientStockError],
    ['produto inativo', [createCartItem({ product: createProduct({ isActive: false }) })], CheckoutProductUnavailableError],
    ['carrinho vazio', [], CheckoutEmptyCartError],
  ] as const)('preserva falha por %s depois do preview', async (_label, items, errorClass) => {
    const { previewClient, orderTx, client } = checkoutScenario()
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    orderTx.cartItem.findMany.mockResolvedValue(items)
    await expect(createCheckoutOrder(
      'user-1', shipping, accepted.fingerprint, client,
    )).rejects.toBeInstanceOf(errorClass)
    expectNoCheckoutWrites(orderTx)
  })

  test.each([
    { id: 'user-2', email: 'cliente@example.com' },
    { id: 'user-1', email: 'novo@example.com' },
  ])('vincula o preview à conta e ao email autoritativo %j', async (user) => {
    const { previewClient, orderTx, client } = checkoutScenario()
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    orderTx.user.findFirst.mockResolvedValue(user)
    await expect(createCheckoutOrder(
      user.id, shipping, accepted.fingerprint, client,
    )).rejects.toBeInstanceOf(CheckoutPreviewChangedError)
    expectNoCheckoutWrites(orderTx)
  })

  test('aceita linhas recriadas e ordem diferente dos mesmos artigos', async () => {
    const items = [createCartItem(), createCartItem({
      id: 'cart-2', product: createProduct({ id: 'product-2' }),
    })]
    const { previewClient, orderTx, client } = checkoutScenario(items)
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    orderTx.cartItem.findMany.mockResolvedValue([...items].reverse().map(item => ({
      ...item, id: 'new-' + item.id,
    })))
    const current = await previewCheckout('user-1', shipping, createClient(orderTx).client)
    expect(current.fingerprint).toBe(accepted.fingerprint)
    await createCheckoutOrder('user-1', shipping, accepted.fingerprint, client)
    expect(orderTx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', id: { in: ['new-cart-2', 'new-cart-1'] } },
    })
  })

  test.each([undefined, null, '', '   '])(
    'normaliza morada, email, Decimal e taxa antes de comparar (%j)', async (addressLine2) => {
      const items = [createCartItem({ product: createProduct({
        price: '19.90', shippingClass: 'BULKY',
        shippingRates: [{ region: 'PORTUGAL_MAINLAND', shippingCost: '24.90' }],
      }) })]
      const { previewClient, orderTx, client } = checkoutScenario(items)
      const accepted = await previewCheckout('user-1', { ...shipping, addressLine2: null }, previewClient)
      orderTx.cartItem.findMany.mockResolvedValue([createCartItem({ product: createProduct({
        price: { toString: () => '19.9' }, shippingClass: 'BULKY',
        shippingRates: [{ region: 'PORTUGAL_MAINLAND', shippingCost: 24.9 }],
      }) })])
      orderTx.user.findFirst.mockResolvedValue({ id: 'user-1', email: ' cliente@example.com ' })
      orderTx.checkoutRegionRule.findMany.mockResolvedValue(createRegionRules().map(rule =>
        rule.region === 'PORTUGAL_MAINLAND'
          ? { ...rule, taxRatePercent: { toString: (): string => '23' } } : rule,
      ))
      await expect(createCheckoutOrder(' user-1 ', {
        ...shipping, name: ' Maria Silva ', postalCode: ' 4000-123 ',
        country: ' portugal ', addressLine2,
      }, accepted.fingerprint, client)).resolves.toMatchObject({ total: accepted.total })
    },
  )

  test('ignora alterações de configuração sem efeito nos termos aplicados', async () => {
    const { previewClient, orderTx, client } = checkoutScenario([
      createCartItem({ quantity: 1, product: createProduct({ price: '200.00' }) }),
    ])
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    expect(accepted.shippingCost).toBe(0)
    orderTx.shippingRule.findMany.mockResolvedValue(createShippingRules().map(rule =>
      rule.id === 'mainland-small' ? { ...rule, shippingCost: '6.90' } : rule,
    ))
    orderTx.checkoutRegionRule.findMany.mockResolvedValue(createRegionRules().map(rule =>
      rule.region === 'MADEIRA' ? { ...rule, taxRatePercent: '22.00' } : rule,
    ))
    await expect(createCheckoutOrder(
      'user-1', shipping, accepted.fingerprint, client,
    )).resolves.toMatchObject({ total: accepted.total })
  })

  test('compara o fingerprint original após P2034 com estado alterado na repetição', async () => {
    const { previewClient, orderTx } = checkoutScenario()
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    const retryTx = createTransactionMock()
    prepareSuccessfulCheckout(retryTx, [createCartItem({ product: createProduct({ price: '20.00' }) })])
    const transaction = vi.fn()
      .mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        await callback(orderTx)
        // Simulate a commit conflict; PostgreSQL rolls this attempt back.
        throw { code: 'P2034' }
      })
      .mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => callback(retryTx))
    const client = { $transaction: transaction } as unknown as CheckoutClient

    await expect(createCheckoutOrder(
      'user-1', shipping, accepted.fingerprint, client,
    )).rejects.toBeInstanceOf(CheckoutPreviewChangedError)
    expect(transaction).toHaveBeenCalledTimes(2)
    for (const call of transaction.mock.calls) {
      expect(call[1]).toEqual({ isolationLevel: 'Serializable' })
    }
    expect(orderTx.order.create).toHaveBeenCalledOnce()
    expectNoCheckoutWrites(retryTx)
  })

  test('preserva o limite de três tentativas P2034', async () => {
    const { previewClient } = checkoutScenario()
    const accepted = await previewCheckout('user-1', shipping, previewClient)
    const transaction = vi.fn().mockRejectedValue({ code: 'P2034' })
    const client = { $transaction: transaction } as unknown as CheckoutClient
    await expect(createCheckoutOrder(
      'user-1', shipping, accepted.fingerprint, client,
    )).rejects.toEqual({ code: 'P2034' })
    expect(transaction).toHaveBeenCalledTimes(3)
  })
})
