import { createHash, randomUUID } from 'node:crypto'

import {
  parsePortugalPostalCode,
} from '../lib/portugal-postal-code'
import {
  CommercialSettingsConfigurationError,
  getCommercialSettings,
  type CommercialCheckoutRegion,
  type CommercialSettingsClient,
  type CommercialShippingClass,
} from './commercial-settings'
import { prisma } from './db'
import {
  calculateShippingPricing,
  ShippingPricingError,
} from './shipping-pricing'

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

type CheckoutProductShippingRateRecord = {
  region: 'PORTUGAL_MAINLAND'
  shippingCost: CheckoutPrice
}

type CheckoutProductRecord = {
  id: string
  name: string
  sku: string
  price: CheckoutPrice
  stockQuantity: number
  isActive: boolean
  shippingClass: CommercialShippingClass
  shippingRates: CheckoutProductShippingRateRecord[]
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

export type CheckoutFulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

export type CheckoutPaymentMethod =
  | 'CARD'
  | 'INSTALLMENTS'

export type CheckoutContactInput = {
  name: string
  phone: string
}

export type CheckoutShippingInput =
  CheckoutContactInput & {
    addressLine1: string
    addressLine2?: string | null
    city: string
    postalCode: string
    country: string
    region: CommercialCheckoutRegion
  }

export type CheckoutFulfillmentInput =
  | {
      fulfillmentMethod: 'DELIVERY'
      shipping: CheckoutShippingInput
    }
  | {
      fulfillmentMethod: 'PICKUP'
      shipping: CheckoutContactInput
    }

export type CheckoutPaymentInput =
  | {
      paymentMethod: 'CARD'
      installmentCount?: null
    }
  | {
      paymentMethod: 'INSTALLMENTS'
      installmentCount: number
    }

export type CheckoutInput =
  CheckoutFulfillmentInput &
    CheckoutPaymentInput

export type CheckoutShipping = {
  name: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  postalCode: string
  country: 'Portugal'
  region: 'PORTUGAL_MAINLAND'
}

type CheckoutContact = {
  name: string
  phone: string
}

type NormalizedFulfillmentInput =
  | {
      fulfillmentMethod: 'DELIVERY'
      shipping: CheckoutShipping
    }
  | {
      fulfillmentMethod: 'PICKUP'
      shipping: CheckoutContact
    }

type NormalizedPaymentInput =
  | {
      paymentMethod: 'CARD'
      installmentCount: null
    }
  | {
      paymentMethod: 'INSTALLMENTS'
      installmentCount: number
    }

type NormalizedCheckoutInput =
  NormalizedFulfillmentInput &
    NormalizedPaymentInput

export type CheckoutResult = {
  id: string
  orderNumber: string
  fulfillmentMethod: CheckoutFulfillmentMethod
  paymentMethod: CheckoutPaymentMethod
  installmentCount: number | null
  subtotal: number
  shippingCost: number
  tax: number
  total: number
  status: string
  paymentStatus: string
}

type CheckoutAmounts = {
  subtotal: number
  shippingCost: number
  tax: number
  total: number
}

export type CheckoutPreviewResult = CheckoutAmounts & {
  fingerprint: string
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

export class CheckoutPreviewChangedError extends Error {
  constructor(
    message =
      'O checkout foi alterado. Calcula novamente o total antes de criar a encomenda.',
  ) {
    super(message)
    this.name = 'CheckoutPreviewChangedError'
  }
}

type CheckoutTransactionClient =
  CommercialSettingsClient & {
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
              shippingClass: true
              shippingRates: {
                where: {
                  region:
                    'PORTUGAL_MAINLAND'
                }
                select: {
                  region: true
                  shippingCost: true
                }
              }
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
          paymentStatus: 'PENDING'
          paymentMethod: CheckoutPaymentMethod
          installmentCount: number | null
          paymentProvider: null
          paymentReference: null
          fulfillmentMethod: CheckoutFulfillmentMethod
          shippingName: string
          shippingEmail: string
          shippingPhone: string
          shippingAddressLine1:
            | string
            | null
          shippingAddressLine2:
            | string
            | null
          shippingCity:
            | string
            | null
          shippingPostalCode:
            | string
            | null
          shippingCountry:
            | string
            | null
          shippingRegion:
            | 'PORTUGAL_MAINLAND'
            | null
          shippingClassApplied:
            | CommercialShippingClass
            | null
          taxRatePercent: string
          pricesIncludeTax: true
          nonVolumousSubtotal: string
          nonVolumousShippingCost: string
          bulkyShippingCost: string
          freeShippingThreshold:
            | string
            | null
          freeShippingApplied: boolean
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
          shippingClassAtPurchase:
            CommercialShippingClass
          shippingCostAtPurchase:
            | string
            | null
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
  price: CheckoutPrice
  priceCents: number
  subtotalCents: number
  shippingClass:
    CommercialShippingClass
  mainlandShippingCost:
    | CheckoutPrice
    | null
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

function normalizeCountry(
  value: string,
): 'Portugal' {
  const country =
    normalizeRequiredText(
      value,
      'País',
      100,
    )

  if (
    country.toLocaleLowerCase(
      'pt-PT',
    ) !== 'portugal'
  ) {
    throw new CheckoutValidationError(
      'As entregas estão disponíveis apenas em Portugal Continental',
    )
  }

  return 'Portugal'
}

function normalizeRegion(
  value: CommercialCheckoutRegion,
): 'PORTUGAL_MAINLAND' {
  if (
    value !==
    'PORTUGAL_MAINLAND'
  ) {
    throw new CheckoutValidationError(
      'As entregas estão disponíveis apenas em Portugal Continental',
    )
  }

  return value
}

function normalizeMainlandPostalCode(
  value: string,
) {
  const postalCode =
    normalizeRequiredText(
      value,
      'Código postal',
      20,
    )

  const parsed =
    parsePortugalPostalCode(
      postalCode,
    )

  if (!parsed.valid) {
    throw new CheckoutValidationError(
      'Código postal inválido',
    )
  }

  if (
    parsed.region !==
    'PORTUGAL_MAINLAND'
  ) {
    throw new CheckoutValidationError(
      'As entregas estão disponíveis apenas em Portugal Continental',
    )
  }

  return parsed.postalCode
}

function normalizeContact(
  input: CheckoutContactInput,
): CheckoutContact {
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
  }
}

function normalizeShipping(
  input: CheckoutShippingInput,
): CheckoutShipping {
  const contact =
    normalizeContact(input)

  return {
    ...contact,
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
      normalizeMainlandPostalCode(
        input.postalCode,
      ),
    country: normalizeCountry(
      input.country,
    ),
    region: normalizeRegion(
      input.region,
    ),
  }
}

type CheckoutServiceInput =
  | CheckoutInput
  | CheckoutFulfillmentInput
  | CheckoutShippingInput

function isCheckoutFulfillmentInput(
  input: CheckoutServiceInput,
): input is
  | CheckoutInput
  | CheckoutFulfillmentInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'fulfillmentMethod' in input
  )
}

function normalizeFulfillmentInput(
  input: CheckoutServiceInput,
): NormalizedFulfillmentInput {
  if (!isCheckoutFulfillmentInput(input)) {
    return {
      fulfillmentMethod: 'DELIVERY',
      shipping: normalizeShipping(
        input,
      ),
    }
  }

  if (
    input.fulfillmentMethod ===
    'DELIVERY'
  ) {
    return {
      fulfillmentMethod: 'DELIVERY',
      shipping: normalizeShipping(
        input.shipping as CheckoutShippingInput,
      ),
    }
  }

  if (
    input.fulfillmentMethod ===
    'PICKUP'
  ) {
    return {
      fulfillmentMethod: 'PICKUP',
      shipping: normalizeContact(
        input.shipping as CheckoutContactInput,
      ),
    }
  }

  throw new CheckoutValidationError(
    'Método de entrega inválido',
  )
}

function normalizePaymentInput(
  input: CheckoutServiceInput,
): NormalizedPaymentInput {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('paymentMethod' in input)
  ) {
    return {
      paymentMethod: 'CARD',
      installmentCount: null,
    }
  }

  const paymentMethod =
    (input as {
      paymentMethod?: unknown
    }).paymentMethod

  const installmentCount =
    (input as {
      installmentCount?: unknown
    }).installmentCount

  if (paymentMethod === 'CARD') {
    if (
      installmentCount !== undefined &&
      installmentCount !== null
    ) {
      throw new CheckoutValidationError(
        'O pagamento por cartão não aceita número de prestações',
      )
    }

    return {
      paymentMethod: 'CARD',
      installmentCount: null,
    }
  }

  if (
    paymentMethod === 'INSTALLMENTS'
  ) {
    if (
      typeof installmentCount !==
        'number' ||
      !Number.isSafeInteger(
        installmentCount,
      ) ||
      installmentCount < 2 ||
      installmentCount >
        12
    ) {
      throw new CheckoutValidationError(
        'Número de prestações inválido',
      )
    }

    return {
      paymentMethod: 'INSTALLMENTS',
      installmentCount,
    }
  }

  throw new CheckoutValidationError(
    'Método de pagamento inválido',
  )
}

function normalizeCheckoutInput(
  input: CheckoutServiceInput,
): NormalizedCheckoutInput {
  return {
    ...normalizeFulfillmentInput(
      input,
    ),
    ...normalizePaymentInput(input),
  } as NormalizedCheckoutInput
}

function getCheckoutContact(
  input: NormalizedCheckoutInput,
) {
  return input.shipping
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

function validateExpectedFingerprint(
  value: unknown,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(value)
  ) {
    throw new CheckoutValidationError(
      'Referência de preview inválida. Calcula novamente o total.',
    )
  }
}

function decimalValueToCents(
  value: CheckoutPrice,
  createError: () => Error,
) {
  const rawValue =
    value.toString().trim()

  const match =
    /^(\d+)(?:\.(\d{1,2}))?$/.exec(
      rawValue,
    )

  if (!match) {
    throw createError()
  }

  const wholePart =
    Number(match[1])

  const decimalPart =
    Number(
      (match[2] ?? '')
        .padEnd(2, '0'),
    )

  const cents =
    wholePart * 100 +
    decimalPart

  if (
    !Number.isSafeInteger(cents) ||
    cents < 0
  ) {
    throw createError()
  }

  return cents
}

function priceToCents(
  value: CheckoutPrice,
) {
  return decimalValueToCents(
    value,
    () =>
      new CheckoutProductUnavailableError(
        'Existe um produto com preço inválido no carrinho',
      ),
  )
}

function shippingCostToCents(
  value: CheckoutPrice,
) {
  return decimalValueToCents(
    value,
    () =>
      new CheckoutPricingError(
        'Existe uma tarifa de transporte inválida no carrinho',
      ),
  )
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

function calculateIncludedTaxCents(
  totalCents: number,
  taxRatePercent: CheckoutPrice,
) {
  const taxRateBasisPoints =
    decimalValueToCents(
      taxRatePercent,
      () =>
        new CheckoutPricingError(
          'Taxa de IVA inválida',
        ),
    )

  if (taxRateBasisPoints === 0) {
    return 0
  }

  const numerator =
    totalCents *
    taxRateBasisPoints

  if (
    !Number.isSafeInteger(numerator) ||
    numerator < 0
  ) {
    throw new CheckoutPricingError()
  }

  const denominator =
    10_000 + taxRateBasisPoints
  const result = Math.round(
    numerator / denominator,
  )

  if (
    !Number.isSafeInteger(result) ||
    result < 0
  ) {
    throw new CheckoutPricingError()
  }

  return result
}

type CheckoutPricing = ReturnType<
  typeof calculateShippingPricing
>

function createPickupPricing(
  pricing: CheckoutPricing,
): CheckoutPricing {
  const productsSubtotalCents =
    pricing.productsSubtotalCents

  return {
    ...pricing,
    nonVolumousSubtotalCents:
      productsSubtotalCents,
    nonVolumousShippingCents: 0,
    bulkyShippingCents: 0,
    shippingTotalCents: 0,
    includedTaxCents:
      calculateIncludedTaxCents(
        productsSubtotalCents,
        pricing.taxRatePercent,
      ),
    totalCents: productsSubtotalCents,
    freeShippingApplied: false,
    freeShippingThresholdCents: null,
  }
}

function getMainlandShippingCost(
  product: CheckoutProductRecord,
) {
  return (
    product.shippingRates.find(
      (rate) =>
        rate.region ===
        'PORTUGAL_MAINLAND',
    )?.shippingCost ?? null
  )
}

function getShippingCostSnapshot(
  item: PreparedCheckoutItem,
) {
  if (
    item.shippingClass !== 'BULKY'
  ) {
    return null
  }

  if (
    item.mainlandShippingCost ===
    null
  ) {
    throw new CheckoutPricingError(
      `O produto ${item.productId} não tem tarifa de transporte para Portugal Continental`,
    )
  }

  return centsToString(
    shippingCostToCents(
      item.mainlandShippingCost,
    ),
  )
}

function getSingleShippingClass(
  items: PreparedCheckoutItem[],
): CommercialShippingClass | null {
  const firstClass =
    items[0]?.shippingClass

  if (!firstClass) {
    return null
  }

  return items.every(
    (item) =>
      item.shippingClass ===
      firstClass,
  )
    ? firstClass
    : null
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

async function prepareCheckout(
  tx: CheckoutTransactionClient,
  normalizedUserId: string,
  fulfillment: NormalizedCheckoutInput,
) {
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
      price: item.product.price,
      priceCents,
      subtotalCents:
        itemSubtotalCents,
      shippingClass:
        item.product
          .shippingClass,
      mainlandShippingCost:
        getMainlandShippingCost(
          item.product,
        ),
    })
  }

  let pricing: CheckoutPricing

  try {
    const settings =
      await getCommercialSettings(
        tx,
      )

    if (
      fulfillment.fulfillmentMethod ===
      'DELIVERY'
    ) {
      pricing =
        calculateShippingPricing({
          settings,
          region:
            fulfillment.shipping.region,
          items:
            preparedItems.map(
              (item) => ({
                productId:
                  item.productId,
                quantity:
                  item.quantity,
                unitPrice:
                  item.price,
                shippingClass:
                  item.shippingClass,
                mainlandShippingCost:
                  item.mainlandShippingCost,
              }),
            ),
        })
    } else {
      const pickupPricing =
        calculateShippingPricing({
          settings,
          region:
            'PORTUGAL_MAINLAND',
          items:
            preparedItems.map(
              (item) => ({
                productId:
                  item.productId,
                quantity:
                  item.quantity,
                unitPrice:
                  item.price,
                shippingClass:
                  'SMALL' as const,
                mainlandShippingCost:
                  null,
              }),
            ),
        })

      pricing =
        createPickupPricing(
          pickupPricing,
        )
    }
  } catch (error) {
    if (
      error instanceof
        ShippingPricingError ||
      error instanceof
        CommercialSettingsConfigurationError
    ) {
      throw new CheckoutPricingError(
        error.message,
      )
    }

    throw error
  }

  if (
    pricing.productsSubtotalCents !==
    subtotalCents
  ) {
    throw new CheckoutPricingError(
      'O subtotal comercial não corresponde ao subtotal do carrinho',
    )
  }

  return {
    user,
    shippingEmail,
    preparedItems,
    pricing,
  }
}

function createCheckoutFingerprint(
  prepared: Awaited<
    ReturnType<
      typeof prepareCheckout
    >
  >,
  fulfillment: NormalizedCheckoutInput,
) {
  const {
    user,
    shippingEmail,
    preparedItems,
    pricing,
  } = prepared

  const contact =
    getCheckoutContact(
      fulfillment,
    )

  const delivery =
    fulfillment.fulfillmentMethod ===
    'DELIVERY'
      ? fulfillment.shipping
      : null

  const snapshot = {
    schemaVersion: 3,
    userId: user.id,
    shippingEmail,
    fulfillmentMethod:
      fulfillment.fulfillmentMethod,
    payment: {
      method:
        fulfillment.paymentMethod,
      installmentCount:
        fulfillment.installmentCount,
    },
    contact: {
      name: contact.name,
      phone: contact.phone,
    },
    delivery:
      delivery === null
        ? null
        : {
            addressLine1:
              delivery.addressLine1,
            addressLine2:
              delivery.addressLine2,
            city: delivery.city,
            postalCode:
              delivery.postalCode,
            country:
              delivery.country,
            region: delivery.region,
          },
    items: [...preparedItems]
      .sort((first, second) => {
        if (
          first.productId ===
          second.productId
        ) {
          return 0
        }

        return first.productId <
          second.productId
          ? -1
          : 1
      })
      .map((item) => {
        const shippingCost =
          fulfillment.fulfillmentMethod ===
          'DELIVERY'
            ? getShippingCostSnapshot(
                item,
              )
            : null

        return {
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPriceCents:
            item.priceCents,
          subtotalCents:
            item.subtotalCents,
          shippingClass:
            item.shippingClass,
          bulkyShippingUnitCostCents:
            shippingCost === null
              ? null
              : shippingCostToCents(
                  shippingCost,
                ),
        }
      }),
    pricing: {
      region: pricing.region,
      pricesIncludeTax:
        pricing.pricesIncludeTax,
      taxRatePercent:
        centsToString(
          decimalValueToCents(
            pricing.taxRatePercent,
            () =>
              new CheckoutPricingError(),
          ),
        ),
      productsSubtotalCents:
        pricing.productsSubtotalCents,
      nonVolumousSubtotalCents:
        pricing.nonVolumousSubtotalCents,
      nonVolumousShippingCents:
        pricing.nonVolumousShippingCents,
      bulkyShippingCents:
        pricing.bulkyShippingCents,
      shippingTotalCents:
        pricing.shippingTotalCents,
      includedTaxCents:
        pricing.includedTaxCents,
      totalCents:
        pricing.totalCents,
      freeShippingApplied:
        pricing.freeShippingApplied,
      freeShippingThresholdCents:
        pricing.freeShippingThresholdCents,
    },
  }

  return createHash('sha256')
    .update(
      JSON.stringify(snapshot),
      'utf8',
    )
    .digest('hex')
}

function createCheckoutAmounts(
  pricing: CheckoutPricing,
): CheckoutAmounts {
  return {
    subtotal:
      centsToNumber(
        pricing.productsSubtotalCents,
      ),
    shippingCost:
      centsToNumber(
        pricing.shippingTotalCents,
      ),
    tax: centsToNumber(
      pricing.includedTaxCents,
    ),
    total:
      centsToNumber(
        pricing.totalCents,
      ),
  }
}

export async function previewCheckout(
  userId: string,
  input: CheckoutServiceInput,
  client?: CheckoutClient,
): Promise<CheckoutPreviewResult> {
  const normalizedUserId =
    normalizeUserId(userId)

  const fulfillment =
    normalizeCheckoutInput(input)

  const db = getClient(client)

  return runSerializableTransaction(
    db,
    async (tx) => {
      const prepared =
        await prepareCheckout(
          tx,
          normalizedUserId,
          fulfillment,
        )

      return {
        ...createCheckoutAmounts(
          prepared.pricing,
        ),
        fingerprint:
          createCheckoutFingerprint(
            prepared,
            fulfillment,
          ),
      }
    },
  )
}

export async function createCheckoutOrder(
  userId: string,
  input: CheckoutServiceInput,
  expectedFingerprint: string,
  client?: CheckoutClient,
): Promise<CheckoutResult> {
  const normalizedUserId =
    normalizeUserId(userId)

  const fulfillment =
    normalizeCheckoutInput(input)

  validateExpectedFingerprint(
    expectedFingerprint,
  )

  const db = getClient(client)

  return runSerializableTransaction(
    db,
    async (tx) => {
      const prepared =
        await prepareCheckout(
          tx,
          normalizedUserId,
          fulfillment,
        )

      if (
        createCheckoutFingerprint(
          prepared,
          fulfillment,
        ) !== expectedFingerprint
      ) {
        throw new CheckoutPreviewChangedError()
      }

      const {
        user,
        shippingEmail,
        preparedItems,
        pricing,
      } = prepared

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
      const contact =
        getCheckoutContact(
          fulfillment,
        )
      const delivery =
        fulfillment.fulfillmentMethod ===
        'DELIVERY'
          ? fulfillment.shipping
          : null

      const order =
        await tx.order.create({
          data: {
            orderNumber,
            userId: user.id,
            subtotal:
              centsToString(
                pricing
                  .productsSubtotalCents,
              ),
            shippingCost:
              centsToString(
                pricing
                  .shippingTotalCents,
              ),
            tax:
              centsToString(
                pricing
                  .includedTaxCents,
              ),
            total:
              centsToString(
                pricing.totalCents,
              ),
            paymentStatus:
              'PENDING',
            paymentMethod:
              fulfillment.paymentMethod,
            installmentCount:
              fulfillment.installmentCount,
            paymentProvider: null,
            paymentReference: null,
            fulfillmentMethod:
              fulfillment
                .fulfillmentMethod,
            shippingName:
              contact.name,
            shippingEmail,
            shippingPhone:
              contact.phone,
            shippingAddressLine1:
              delivery?.addressLine1 ??
              null,
            shippingAddressLine2:
              delivery?.addressLine2 ??
              null,
            shippingCity:
              delivery?.city ?? null,
            shippingPostalCode:
              delivery?.postalCode ??
              null,
            shippingCountry:
              delivery?.country ?? null,
            shippingRegion:
              delivery?.region ?? null,
            shippingClassApplied:
              delivery === null
                ? null
                : getSingleShippingClass(
                    preparedItems,
                  ),
            taxRatePercent:
              centsToString(
                decimalValueToCents(
                  pricing.taxRatePercent,
                  () =>
                    new CheckoutPricingError(),
                ),
              ),
            pricesIncludeTax:
              pricing.pricesIncludeTax,
            nonVolumousSubtotal:
              centsToString(
                pricing
                  .nonVolumousSubtotalCents,
              ),
            nonVolumousShippingCost:
              centsToString(
                pricing
                  .nonVolumousShippingCents,
              ),
            bulkyShippingCost:
              centsToString(
                pricing
                  .bulkyShippingCents,
              ),
            freeShippingThreshold:
              pricing
                .freeShippingThresholdCents ===
              null
                ? null
                : centsToString(
                    pricing
                      .freeShippingThresholdCents,
                  ),
            freeShippingApplied:
              pricing
                .freeShippingApplied,
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
            shippingClassAtPurchase:
              item.shippingClass,
            shippingCostAtPurchase:
              fulfillment
                .fulfillmentMethod ===
              'DELIVERY'
                ? getShippingCostSnapshot(
                    item,
                  )
                : null,
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
        fulfillmentMethod:
          fulfillment
            .fulfillmentMethod,
        paymentMethod:
          fulfillment.paymentMethod,
        installmentCount:
          fulfillment.installmentCount,
        ...createCheckoutAmounts(
          pricing,
        ),
        status: order.status,
        paymentStatus:
          order.paymentStatus,
      }
    },
  )
}
