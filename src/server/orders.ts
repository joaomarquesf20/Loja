import { prisma } from './db'

export type OrderField =
  | 'userId'

export type OrderFulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

export class OrderValidationError extends Error {
  constructor(
    public readonly field: OrderField,
    message: string,
  ) {
    super(message)
    this.name =
      'OrderValidationError'
  }
}

type MoneyValue =
  | string
  | number
  | {
      toString(): string
    }

export type OrderVariantOptionSnapshot = {
  code: string
  name: string
  value: string
}

export type UserOrderItem = {
  id: string
  productVariantId: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: string
  quantity: number
  subtotalAtPurchase: string
  variantOptionsAtPurchase:
    OrderVariantOptionSnapshot[]
}

export type UserOrderEvent = {
  id: string
  type: string
  fromOrderStatus:
    string | null
  toOrderStatus:
    string | null
  fromPaymentStatus:
    string | null
  toPaymentStatus:
    string | null
  createdAt: Date
}

export type UserOrder = {
  id: string
  orderNumber: string
  subtotal: string
  shippingCost: string
  tax: string
  total: string
  status: string
  paymentStatus: string
  fulfillmentMethod:
    OrderFulfillmentMethod
  shippingName: string
  shippingEmail: string
  shippingPhone: string
  shippingAddressLine1:
    string | null
  shippingAddressLine2:
    string | null
  shippingCity:
    string | null
  shippingPostalCode:
    string | null
  shippingCountry:
    string | null
  createdAt: Date
  items: UserOrderItem[]
  events: UserOrderEvent[]
}

type OrderItemRecord = {
  id: string
  productVariantId: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: MoneyValue
  quantity: number
  subtotalAtPurchase: MoneyValue
  variantOptionsAtPurchase: unknown
}

type OrderEventRecord = {
  id: string
  type: string
  fromOrderStatus:
    string | null
  toOrderStatus:
    string | null
  fromPaymentStatus:
    string | null
  toPaymentStatus:
    string | null
  createdAt: Date
}

type OrderRecord = {
  id: string
  orderNumber: string
  subtotal: MoneyValue
  shippingCost: MoneyValue
  tax: MoneyValue
  total: MoneyValue
  status: string
  paymentStatus: string
  fulfillmentMethod:
    OrderFulfillmentMethod
  shippingName: string
  shippingEmail: string
  shippingPhone: string
  shippingAddressLine1:
    string | null
  shippingAddressLine2:
    string | null
  shippingCity:
    string | null
  shippingPostalCode:
    string | null
  shippingCountry:
    string | null
  createdAt: Date
  items: OrderItemRecord[]
  events: OrderEventRecord[]
}

type OrderItemSelect = {
  id: true
  productVariantId: true
  productNameAtPurchase: true
  productSkuAtPurchase: true
  priceAtPurchase: true
  quantity: true
  subtotalAtPurchase: true
  variantOptionsAtPurchase: true
}

type OrderEventSelect = {
  id: true
  type: true
  fromOrderStatus: true
  toOrderStatus: true
  fromPaymentStatus: true
  toPaymentStatus: true
  createdAt: true
}

type OrderSelect = {
  id: true
  orderNumber: true
  subtotal: true
  shippingCost: true
  tax: true
  total: true
  status: true
  paymentStatus: true
  fulfillmentMethod: true
  shippingName: true
  shippingEmail: true
  shippingPhone: true
  shippingAddressLine1: true
  shippingAddressLine2: true
  shippingCity: true
  shippingPostalCode: true
  shippingCountry: true
  createdAt: true
  items: {
    orderBy: {
      id: 'asc'
    }
    select: OrderItemSelect
  }
  events: {
    orderBy: [
      {
        createdAt: 'asc'
      },
      {
        id: 'asc'
      },
    ]
    select: OrderEventSelect
  }
}

export interface OrderClient {
  order: {
    findMany(args: {
      where: {
        userId: string
      }
      orderBy: {
        createdAt: 'desc'
      }
      select: OrderSelect
    }): Promise<OrderRecord[]>
  }
}

const orderItemSelect: OrderItemSelect = {
  id: true,
  productVariantId: true,
  productNameAtPurchase: true,
  productSkuAtPurchase: true,
  priceAtPurchase: true,
  quantity: true,
  subtotalAtPurchase: true,
  variantOptionsAtPurchase: true,
}

const orderEventSelect: OrderEventSelect = {
  id: true,
  type: true,
  fromOrderStatus: true,
  toOrderStatus: true,
  fromPaymentStatus: true,
  toPaymentStatus: true,
  createdAt: true,
}

const orderSelect: OrderSelect = {
  id: true,
  orderNumber: true,
  subtotal: true,
  shippingCost: true,
  tax: true,
  total: true,
  status: true,
  paymentStatus: true,
  fulfillmentMethod: true,
  shippingName: true,
  shippingEmail: true,
  shippingPhone: true,
  shippingAddressLine1: true,
  shippingAddressLine2: true,
  shippingCity: true,
  shippingPostalCode: true,
  shippingCountry: true,
  createdAt: true,
  items: {
    orderBy: {
      id: 'asc',
    },
    select: orderItemSelect,
  },
  events: {
    orderBy: [
      {
        createdAt: 'asc',
      },
      {
        id: 'asc',
      },
    ],
    select: orderEventSelect,
  },
}

function getClient(
  client?: OrderClient,
): OrderClient {
  return (
    client ??
    (prisma as unknown as OrderClient)
  )
}

function normalizeUserId(
  value: unknown,
) {
  if (typeof value !== 'string') {
    throw new OrderValidationError(
      'userId',
      'Utilizador inválido',
    )
  }

  const normalizedValue =
    value.trim()

  if (!normalizedValue) {
    throw new OrderValidationError(
      'userId',
      'Utilizador é obrigatório',
    )
  }

  return normalizedValue
}

function moneyToString(
  value: MoneyValue,
) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return value.toString()
}

function normalizeVariantOptions(
  value: unknown,
): OrderVariantOptionSnapshot[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      Array.isArray(entry)
    ) {
      return []
    }

    const record =
      entry as Record<string, unknown>

    if (
      typeof record.code !== 'string' ||
      typeof record.name !== 'string' ||
      typeof record.value !== 'string'
    ) {
      return []
    }

    return [
      {
        code: record.code,
        name: record.name,
        value: record.value,
      },
    ]
  })
}

function mapOrderItem(
  item: OrderItemRecord,
): UserOrderItem {
  return {
    id: item.id,
    productVariantId:
      item.productVariantId,
    productNameAtPurchase:
      item.productNameAtPurchase,
    productSkuAtPurchase:
      item.productSkuAtPurchase,
    priceAtPurchase:
      moneyToString(
        item.priceAtPurchase,
      ),
    quantity: item.quantity,
    subtotalAtPurchase:
      moneyToString(
        item.subtotalAtPurchase,
      ),
    variantOptionsAtPurchase:
      normalizeVariantOptions(
        item.variantOptionsAtPurchase,
      ),
  }
}

function mapOrderEvent(
  event: OrderEventRecord,
): UserOrderEvent {
  return {
    id: event.id,
    type: event.type,
    fromOrderStatus:
      event.fromOrderStatus,
    toOrderStatus:
      event.toOrderStatus,
    fromPaymentStatus:
      event.fromPaymentStatus,
    toPaymentStatus:
      event.toPaymentStatus,
    createdAt:
      event.createdAt,
  }
}

function mapOrder(
  order: OrderRecord,
): UserOrder {
  return {
    id: order.id,
    orderNumber:
      order.orderNumber,
    subtotal:
      moneyToString(
        order.subtotal,
      ),
    shippingCost:
      moneyToString(
        order.shippingCost,
      ),
    tax:
      moneyToString(
        order.tax,
      ),
    total:
      moneyToString(
        order.total,
      ),
    status:
      order.status,
    paymentStatus:
      order.paymentStatus,
    fulfillmentMethod:
      order.fulfillmentMethod,
    shippingName:
      order.shippingName,
    shippingEmail:
      order.shippingEmail,
    shippingPhone:
      order.shippingPhone,
    shippingAddressLine1:
      order.shippingAddressLine1,
    shippingAddressLine2:
      order.shippingAddressLine2,
    shippingCity:
      order.shippingCity,
    shippingPostalCode:
      order.shippingPostalCode,
    shippingCountry:
      order.shippingCountry,
    createdAt:
      order.createdAt,
    items:
      order.items.map(
        mapOrderItem,
      ),
    events:
      order.events.map(
        mapOrderEvent,
      ),
  }
}

export async function listUserOrders(
  userId: string,
  client?: OrderClient,
): Promise<UserOrder[]> {
  const normalizedUserId =
    normalizeUserId(userId)

  const db =
    getClient(client)

  const orders =
    await db.order.findMany({
      where: {
        userId:
          normalizedUserId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: orderSelect,
    })

  return orders.map(
    mapOrder,
  )
}