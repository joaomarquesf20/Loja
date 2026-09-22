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
  CheckoutPreviewChangedError,
  CheckoutValidationError,
  createCheckoutOrder,
  previewCheckout,
  type CheckoutClient,
  type CheckoutInput,
  type CheckoutShippingInput,
} from './checkout'

const shipping: CheckoutShippingInput = {
  name: 'Maria Silva',
  phone: '+351 912 345 678',
  addressLine1: 'Rua das Flores 10',
  addressLine2: null,
  city: 'Porto',
  postalCode: '4000-123',
  country: 'Portugal',
  region: 'PORTUGAL_MAINLAND',
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

function createCartItem() {
  return {
    id: 'cart-1',
    productId: 'product-1',
    productVariantId: 'variant-1',
    quantity: 2,
    product: {
      id: 'product-1',
      name: 'Produto 1',
      sku: 'SKU-1',
      price: '19.99',
      stockQuantity: 10,
      isActive: true,
      shippingClass:
        'SMALL' as const,
      shippingRates: [],
    },
    variant: {
      id: 'variant-1',
      productId: 'product-1',
      sku: 'SKU-1',
      price: '19.99',
      stockQuantity: 10,
      isActive: true,
      selections: [],
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

function prepareSuccessfulCheckout(
  tx: ReturnType<
    typeof createTransactionMock
  >,
) {
  tx.user.findFirst.mockResolvedValue({
    id: 'user-1',
    email: 'cliente@example.com',
  })

  tx.cartItem.findMany.mockResolvedValue([
    createCartItem(),
  ])

  tx.storeSettings.findUnique.mockResolvedValue({
    id: 'store',
    pricesIncludeTax: true,
  })

  tx.checkoutRegionRule.findMany.mockResolvedValue(
    createRegionRules(),
  )

  tx.shippingRule.findMany.mockResolvedValue(
    createShippingRules(),
  )

  tx.productVariant.updateMany.mockResolvedValue({
    count: 1,
  })

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

  tx.orderItem.createMany.mockResolvedValue({
    count: 1,
  })

  tx.cartItem.deleteMany.mockResolvedValue({
    count: 1,
  })
}

function cardInput(): CheckoutInput {
  return {
    fulfillmentMethod: 'DELIVERY',
    shipping,
    paymentMethod: 'CARD',
    installmentCount: null,
  }
}

function installmentInput(
  installmentCount: number,
): CheckoutInput {
  return {
    fulfillmentMethod: 'DELIVERY',
    shipping,
    paymentMethod: 'INSTALLMENTS',
    installmentCount,
  }
}

describe('checkout payment terms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('método de pagamento altera o fingerprint mesmo com os mesmos totais', async () => {
    const tx = createTransactionMock()
    prepareSuccessfulCheckout(tx)
    const { client } = createClient(tx)

    const card = await previewCheckout(
      'user-1',
      cardInput(),
      client,
    )
    const installments = await previewCheckout(
      'user-1',
      installmentInput(3),
      client,
    )

    expect(installments).toMatchObject({
      subtotal: card.subtotal,
      shippingCost: card.shippingCost,
      tax: card.tax,
      total: card.total,
    })
    expect(installments.fingerprint).not.toBe(
      card.fingerprint,
    )
  })

  test('número de prestações altera o fingerprint', async () => {
    const tx = createTransactionMock()
    prepareSuccessfulCheckout(tx)
    const { client } = createClient(tx)

    const three = await previewCheckout(
      'user-1',
      installmentInput(3),
      client,
    )
    const four = await previewCheckout(
      'user-1',
      installmentInput(4),
      client,
    )

    expect(four.fingerprint).not.toBe(
      three.fingerprint,
    )
  })

  test('rejeita alteração de CARD para prestações depois do preview', async () => {
    const previewTx =
      createTransactionMock()
    prepareSuccessfulCheckout(previewTx)

    const orderTx =
      createTransactionMock()
    prepareSuccessfulCheckout(orderTx)

    const preview = await previewCheckout(
      'user-1',
      cardInput(),
      createClient(previewTx).client,
    )

    await expect(
      createCheckoutOrder(
        'user-1',
        installmentInput(3),
        preview.fingerprint,
        createClient(orderTx).client,
      ),
    ).rejects.toBeInstanceOf(
      CheckoutPreviewChangedError,
    )

    expect(
      orderTx.productVariant.updateMany,
    ).not.toHaveBeenCalled()
    expect(
      orderTx.order.create,
    ).not.toHaveBeenCalled()
  })

  test('grava pagamento pendente e não aceita fornecedor ou referência do cliente', async () => {
    const tx = createTransactionMock()
    prepareSuccessfulCheckout(tx)
    const { client } = createClient(tx)

    const input = installmentInput(3)
    const preview = await previewCheckout(
      'user-1',
      input,
      client,
    )

    const result = await createCheckoutOrder(
      'user-1',
      input,
      preview.fingerprint,
      client,
    )

    expect(result).toMatchObject({
      paymentMethod: 'INSTALLMENTS',
      installmentCount: 3,
      paymentStatus: 'PENDING',
    })

    expect(
      tx.order.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data:
          expect.objectContaining({
            paymentStatus: 'PENDING',
            paymentMethod:
              'INSTALLMENTS',
            installmentCount: 3,
            paymentProvider: null,
            paymentReference: null,
          }),
      }),
    )
  })

  test('rejeita prestações em CARD antes de abrir transação', async () => {
    const tx = createTransactionMock()
    const { client, transaction } =
      createClient(tx)

    const invalid = {
      ...cardInput(),
      installmentCount: 2,
    } as unknown as CheckoutInput

    await expect(
      previewCheckout(
        'user-1',
        invalid,
        client,
      ),
    ).rejects.toBeInstanceOf(
      CheckoutValidationError,
    )

    expect(transaction).not.toHaveBeenCalled()
  })

  test.each([
    undefined,
    null,
    1,
    2.5,
    '3',
  ])('rejeita número de prestações inválido %j antes da transação', async (installmentCount) => {
    const tx = createTransactionMock()
    const { client, transaction } =
      createClient(tx)

    const invalid = {
      fulfillmentMethod: 'DELIVERY',
      shipping,
      paymentMethod: 'INSTALLMENTS',
      installmentCount,
    } as unknown as CheckoutInput

    await expect(
      previewCheckout(
        'user-1',
        invalid,
        client,
      ),
    ).rejects.toBeInstanceOf(
      CheckoutValidationError,
    )

    expect(transaction).not.toHaveBeenCalled()
  })

  test('mantém compatibilidade interna: chamadas antigas usam CARD sem prestações', async () => {
    const tx = createTransactionMock()
    prepareSuccessfulCheckout(tx)
    const { client } = createClient(tx)

    const preview = await previewCheckout(
      'user-1',
      shipping,
      client,
    )

    const result = await createCheckoutOrder(
      'user-1',
      shipping,
      preview.fingerprint,
      client,
    )

    expect(result).toMatchObject({
      paymentMethod: 'CARD',
      installmentCount: null,
    })

    expect(
      tx.order.create.mock.calls[0][0]
        .data,
    ).toMatchObject({
      paymentStatus: 'PENDING',
      paymentMethod: 'CARD',
      installmentCount: null,
      paymentProvider: null,
      paymentReference: null,
    })
  })
})
