import { prisma } from './db'

export type OrderField =
  | 'userId'

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

export type UserOrderItem = {
  id: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: string
  quantity: number
  subtotalAtPurchase: string
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
  shippingName: string
  shippingEmail: string
  shippingPhone: string
  shippingAddressLine1: string
  shippingAddressLine2: string | null
  shippingCity: string
  shippingPostalCode: string
  shippingCountry: string
  createdAt: Date
  items: UserOrderItem[]
}

type OrderItemRecord = {
  id: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: MoneyValue
  quantity: number
  subtotalAtPurchase: MoneyValue
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
  shippingName: string
  shippingEmail: string
  shippingPhone: string
  shippingAddressLine1: string
  shippingAddressLine2: string | null
  shippingCity: string
  shippingPostalCode: string
  shippingCountry: string
  createdAt: Date
  items: OrderItemRecord[]
}

type OrderItemSelect = {
  id: true
  productNameAtPurchase: true
  productSkuAtPurchase: true
  priceAtPurchase: true
  quantity: true
  subtotalAtPurchase: true
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
  productNameAtPurchase: true,
  productSkuAtPurchase: true,
  priceAtPurchase: true,
  quantity: true,
  subtotalAtPurchase: true,
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

function mapOrderItem(
  item: OrderItemRecord,
): UserOrderItem {
  return {
    id: item.id,
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
    tax: moneyToString(
      order.tax,
    ),
    total:
      moneyToString(
        order.total,
      ),
    status: order.status,
    paymentStatus:
      order.paymentStatus,
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
