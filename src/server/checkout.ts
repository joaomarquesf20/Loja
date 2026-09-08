import { randomUUID } from 'node:crypto'
import { prisma } from './db'

type CheckoutPrice =
  | number
  | string
  | {
      toString(): string
    }

type CheckoutUserRecord = {
  id: string
  email: string
}

type CheckoutProductRecord = {
  id: string
  name: string
  sku: string
  price: CheckoutPrice
  stockQuantity: number
  isActive: boolean
}

type CheckoutCartItemRecord = {
  id: string
  productId: string
  quantity: number
  product: CheckoutProductRecord
}

type CheckoutOrderRecord = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
}

export type CheckoutShippingInput = {
  name: string
  phone: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  postalCode: string
  country: string
}

export type CheckoutShipping = {
  name: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  postalCode: string
  country: string
}

export type CheckoutPricing = {
  shippingCostCents: number
  taxCents: number
}

export type CheckoutPricingPolicy = (
  input: {
    subtotalCents: number
    shipping: CheckoutShipping
  },
) => CheckoutPricing

export type CheckoutResult = {
  id: string
  orderNumber: string
  subtotal: number
  shippingCost: number
  tax: number
  total: number
  status: string
  paymentStatus: string
}

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name =
      'CheckoutValidationError'
  }
}

export class CheckoutUserUnavailableError extends Error {
  constructor(
    message =
      'Utilizador indisponível',
  ) {
    super(message)
    this.name =
      'CheckoutUserUnavailableError'
  }
}

export class CheckoutEmptyCartError extends Error {
  constructor(
    message = 'O carrinho está vazio',
  ) {
    super(message)
    this.name =
      'CheckoutEmptyCartError'
  }
}

export class CheckoutProductUnavailableError extends Error {
  constructor(
    message =
      'Existe um produto indisponível no carrinho',
  ) {
    super(message)
    this.name =
      'CheckoutProductUnavailableError'
  }
}

export class CheckoutInsufficientStockError extends Error {
  constructor(
    message =
      'Existe stock insuficiente para um produto do carrinho',
  ) {
    super(message)
    this.name =
      'CheckoutInsufficientStockError'
  }
}

export class CheckoutCartChangedError extends Error {
  constructor(
    message =
      'O carrinho ou o stock foi alterado durante o checkout',
  ) {
    super(message)
    this.name =
      'CheckoutCartChangedError'
  }
}

export class CheckoutPricingError extends Error {
  constructor(
    message =
      'Configuração de preços do checkout inválida',
  ) {
    super(message)
    this.name =
      'CheckoutPricingError'
  }
}

type CheckoutTransactionClient = {
  user: {
    findFirst(args: {
      where: {
        id: string
        isActive: true
      }
      select: {
        id: true
        email: true
      }
    }): Promise<
      CheckoutUserRecord | null
    >
  }

  cartItem: {
    findMany(args: {
      where: {
        userId: string
      }
      orderBy: {
        id: 'asc'
      }
      select: {
        id: true
        productId: true
        quantity: true
        product: {
          select: {
            id: true
            name: true
            sku: true
            price: true
            stockQuantity: true
            isActive: true
          }
        }
      }
    }): Promise<
      CheckoutCartItemRecord[]
    >

    deleteMany(args: {
      where: {
        userId: string
        id: {
          in: string[]
        }
      }
    }): Promise<{
      count: number
    }>
  }

  product: {
    updateMany(args: {
      where: {
        id: string
        isActive: true
        stockQuantity: {
          gte: number
        }
      }
      data: {
        stockQuantity: {
          decrement: number
        }
      }
    }): Promise<{
      count: number
    }>
  }

  order: {
    create(args: {
      data: {
        orderNumber: string
        userId: string
        subtotal: string
        shippingCost: string
        tax: string
        total: string
        shippingName: string
        shippingEmail: string
        shippingPhone: string
        shippingAddressLine1: string
        shippingAddressLine2: string | null
        shippingCity: string
        shippingPostalCode: string
        shippingCountry: string
      }
      select: {
        id: true
        orderNumber: true
        status: true
        paymentStatus: true
      }
    }): Promise<CheckoutOrderRecord>
  }

  orderItem: {
    createMany(args: {
      data: Array<{
        orderId: string
        productId: string
        productNameAtPurchase: string
        productSkuAtPurchase: string
        priceAtPurchase: string
        quantity: number
        subtotalAtPurchase: string
      }>
    }): Promise<{
      count: number
    }>
  }
}

export interface CheckoutClient {
  $transaction<T>(
    callback: (
      tx: CheckoutTransactionClient,
    ) => Promise<T>,
    options: {
      isolationLevel:
        'Serializable'
    },
  ): Promise<T>
}

type PreparedCheckoutItem = {
  cartItemId: string
  productId: string
  name: string
  sku: string
  quantity: number
  priceCents: number
  subtotalCents: number
}

const MAX_TRANSACTION_ATTEMPTS = 3

function getClient(
  client?: CheckoutClient,
): CheckoutClient {
  return (
    client ??
    (prisma as unknown as CheckoutClient)
  )
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
  maxLength: number,
) {
  const normalizedValue =
    value.trim()

  if (!normalizedValue) {
    throw new CheckoutValidationError(
      `${fieldName} é obrigatório`,
    )
  }

  if (
    normalizedValue.length >
    maxLength
  ) {
    throw new CheckoutValidationError(
      `${fieldName} é demasiado longo`,
    )
  }

  return normalizedValue
}

function normalizeOptionalText(
  value: string | null | undefined,
  fieldName: string,
  maxLength: number,
) {
  if (value == null) {
    return null
  }

  const normalizedValue =
    value.trim()

  if (!normalizedValue) {
    return null
  }

  if (
    normalizedValue.length >
    maxLength
  ) {
    throw new CheckoutValidationError(
      `${fieldName} é demasiado longo`,
    )
  }

  return normalizedValue
}

function normalizeShipping(
  input: CheckoutShippingInput,
): CheckoutShipping {
  return {
    name: normalizeRequiredText(
      input.name,
      'Nome',
      120,
    ),
    phone: normalizeRequiredText(
      input.phone,
      'Telefone',
      30,
    ),
    addressLine1:
      normalizeRequiredText(
        input.addressLine1,
        'Morada',
        200,
      ),
    addressLine2:
      normalizeOptionalText(
        input.addressLine2,
        'Complemento da morada',
        200,
      ),
    city: normalizeRequiredText(
      input.city,
      'Localidade',
      100,
    ),
    postalCode:
      normalizeRequiredText(
        input.postalCode,
        'Código postal',
        20,
      ),
    country: normalizeRequiredText(
      input.country,
      'País',
      100,
    ),
  }
}

function normalizeUserId(
  userId: string,
) {
  return normalizeRequiredText(
    userId,
    'Utilizador',
    200,
  )
}

function priceToCents(
  value: CheckoutPrice,
) {
  const rawValue =
    value.toString().trim()

  const match =
    /^(\d+)(?:\.(\d{1,2}))?$/.exec(
      rawValue,
    )

  if (!match) {
    throw new CheckoutProductUnavailableError(
      'Existe um produto com preço inválido no carrinho',
    )
  }

  const wholePart =
    Number(match[1])

  const decimalPart =
    (match[2] ?? '')
      .padEnd(2, '0')

  const cents =
    wholePart * 100 +
    Number(decimalPart)

  if (
    !Number.isSafeInteger(cents) ||
    cents < 0
  ) {
    throw new CheckoutProductUnavailableError(
      'Existe um produto com preço inválido no carrinho',
    )
  }

  return cents
}

function multiplyCents(
  cents: number,
  quantity: number,
) {
  const result =
    cents * quantity

  if (
    !Number.isSafeInteger(result) ||
    result < 0
  ) {
    throw new CheckoutPricingError()
  }

  return result
}

function addCents(
  first: number,
  second: number,
) {
  const result =
    first + second

  if (
    !Number.isSafeInteger(result) ||
    result < 0
  ) {
    throw new CheckoutPricingError()
  }

  return result
}

function validatePricingCents(
  value: number,
) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0
  )
}

function validatePricing(
  pricing: CheckoutPricing,
) {
  if (
    !pricing ||
    !validatePricingCents(
      pricing.shippingCostCents,
    ) ||
    !validatePricingCents(
      pricing.taxCents,
    )
  ) {
    throw new CheckoutPricingError()
  }

  return pricing
}

function centsToString(
  cents: number,
) {
  const whole =
    Math.floor(cents / 100)

  const decimal =
    String(cents % 100).padStart(
      2,
      '0',
    )

  return `${whole}.${decimal}`
}

function centsToNumber(
  cents: number,
) {
  return cents / 100
}

function createOrderNumber() {
  const randomPart =
    randomUUID()
      .replaceAll('-', '')
      .slice(0, 12)
      .toUpperCase()

  return `PFA-${randomPart}`
}

function isRetryableTransactionError(
  error: unknown,
) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error)
  ) {
    return false
  }

  return (
    (
      error as {
        code?: unknown
      }
    ).code === 'P2034'
  )
}

async function runSerializableTransaction<T>(
  client: CheckoutClient,
  callback: (
    tx: CheckoutTransactionClient,
  ) => Promise<T>,
) {
  for (
    let attempt = 1;
    attempt <=
    MAX_TRANSACTION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await client.$transaction(
        callback,
        {
          isolationLevel:
            'Serializable',
        },
      )
    } catch (error) {
      if (
        !isRetryableTransactionError(
          error,
        ) ||
        attempt ===
          MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error
      }
    }
  }

  throw new Error(
    'Falha inesperada na transação',
  )
}

export async function createCheckoutOrder(
  userId: string,
  shippingInput:
    CheckoutShippingInput,
  pricingPolicy:
    CheckoutPricingPolicy,
  client?: CheckoutClient,
): Promise<CheckoutResult> {
  const normalizedUserId =
    normalizeUserId(userId)

  const shipping =
    normalizeShipping(
      shippingInput,
    )

  if (
    typeof pricingPolicy !==
    'function'
  ) {
    throw new CheckoutPricingError()
  }

  const db = getClient(client)

  return runSerializableTransaction(
    db,
    async (tx) => {
      const user =
        await tx.user.findFirst({
          where: {
            id: normalizedUserId,
            isActive: true,
          },
          select: {
            id: true,
            email: true,
          },
        })

      if (!user) {
        throw new CheckoutUserUnavailableError()
      }

      const shippingEmail =
        user.email.trim()

      if (!shippingEmail) {
        throw new CheckoutUserUnavailableError(
          'O utilizador não tem um email válido',
        )
      }

      const cartItems =
        await tx.cartItem.findMany({
          where: {
            userId: user.id,
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
              },
            },
          },
        })

      if (
        cartItems.length === 0
      ) {
        throw new CheckoutEmptyCartError()
      }

      const preparedItems:
        PreparedCheckoutItem[] = []

      let subtotalCents = 0

      for (
        const item of cartItems
      ) {
        if (
          !Number.isSafeInteger(
            item.quantity,
          ) ||
          item.quantity <= 0
        ) {
          throw new CheckoutCartChangedError(
            'Existe uma quantidade inválida no carrinho',
          )
        }

        if (
          !item.product.isActive
        ) {
          throw new CheckoutProductUnavailableError()
        }

        if (
          item.product.stockQuantity <
          item.quantity
        ) {
          throw new CheckoutInsufficientStockError()
        }

        const priceCents =
          priceToCents(
            item.product.price,
          )

        const itemSubtotalCents =
          multiplyCents(
            priceCents,
            item.quantity,
          )

        subtotalCents =
          addCents(
            subtotalCents,
            itemSubtotalCents,
          )

        preparedItems.push({
          cartItemId: item.id,
          productId:
            item.productId,
          name: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          priceCents,
          subtotalCents:
            itemSubtotalCents,
        })
      }

      const pricing =
        validatePricing(
          pricingPolicy({
            subtotalCents,
            shipping,
          }),
        )

      const subtotalWithShipping =
        addCents(
          subtotalCents,
          pricing.shippingCostCents,
        )

      const totalCents =
        addCents(
          subtotalWithShipping,
          pricing.taxCents,
        )

      for (
        const item of preparedItems
      ) {
        const updateResult =
          await tx.product.updateMany({
            where: {
              id: item.productId,
              isActive: true,
              stockQuantity: {
                gte: item.quantity,
              },
            },
            data: {
              stockQuantity: {
                decrement:
                  item.quantity,
              },
            },
          })

        if (
          updateResult.count !== 1
        ) {
          throw new CheckoutCartChangedError()
        }
      }

      const orderNumber =
        createOrderNumber()

      const order =
        await tx.order.create({
          data: {
            orderNumber,
            userId: user.id,
            subtotal:
              centsToString(
                subtotalCents,
              ),
            shippingCost:
              centsToString(
                pricing.shippingCostCents,
              ),
            tax: centsToString(
              pricing.taxCents,
            ),
            total:
              centsToString(
                totalCents,
              ),
            shippingName:
              shipping.name,
            shippingEmail,
            shippingPhone:
              shipping.phone,
            shippingAddressLine1:
              shipping.addressLine1,
            shippingAddressLine2:
              shipping.addressLine2,
            shippingCity:
              shipping.city,
            shippingPostalCode:
              shipping.postalCode,
            shippingCountry:
              shipping.country,
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
          },
        })

      await tx.orderItem.createMany({
        data: preparedItems.map(
          (item) => ({
            orderId: order.id,
            productId:
              item.productId,
            productNameAtPurchase:
              item.name,
            productSkuAtPurchase:
              item.sku,
            priceAtPurchase:
              centsToString(
                item.priceCents,
              ),
            quantity:
              item.quantity,
            subtotalAtPurchase:
              centsToString(
                item.subtotalCents,
              ),
          }),
        ),
      })

      await tx.cartItem.deleteMany({
        where: {
          userId: user.id,
          id: {
            in: preparedItems.map(
              (item) =>
                item.cartItemId,
            ),
          },
        },
      })

      return {
        id: order.id,
        orderNumber:
          order.orderNumber,
        subtotal:
          centsToNumber(
            subtotalCents,
          ),
        shippingCost:
          centsToNumber(
            pricing.shippingCostCents,
          ),
        tax: centsToNumber(
          pricing.taxCents,
        ),
        total:
          centsToNumber(
            totalCents,
          ),
        status: order.status,
        paymentStatus:
          order.paymentStatus,
      }
    },
  )
}
