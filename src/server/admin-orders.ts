import { prisma } from './db'

type MoneyValue =
  | string
  | number
  | {
      toString(): string
    }

export type AdminOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'

export type AdminPaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

export type AdminPaymentMethod =
  | 'CARD'
  | 'INSTALLMENTS'

export type AdminFulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

export type AdminOrderItem = {
  id: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: string
  quantity: number
  subtotalAtPurchase: string
}

export type AdminOrder = {
  id: string
  orderNumber: string
  subtotal: string
  shippingCost: string
  tax: string
  total: string
  status: AdminOrderStatus
  paymentStatus: AdminPaymentStatus
  paymentMethod: AdminPaymentMethod | null
  installmentCount: number | null
  paymentProvider: string | null
  paymentReference: string | null
  fulfillmentMethod: AdminFulfillmentMethod
  shippingName: string
  shippingEmail: string
  shippingPhone: string
  shippingAddressLine1: string | null
  shippingAddressLine2: string | null
  shippingCity: string | null
  shippingPostalCode: string | null
  shippingCountry: string | null
  createdAt: Date
  items: AdminOrderItem[]
}

type AdminOrderItemRecord = {
  id: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: MoneyValue
  quantity: number
  subtotalAtPurchase: MoneyValue
}

type AdminOrderRecord = {
  id: string
  orderNumber: string
  subtotal: MoneyValue
  shippingCost: MoneyValue
  tax: MoneyValue
  total: MoneyValue
  status: AdminOrderStatus
  paymentStatus: AdminPaymentStatus
  paymentMethod: AdminPaymentMethod | null
  installmentCount: number | null
  paymentProvider: string | null
  paymentReference: string | null
  fulfillmentMethod: AdminFulfillmentMethod
  shippingName: string
  shippingEmail: string
  shippingPhone: string
  shippingAddressLine1: string | null
  shippingAddressLine2: string | null
  shippingCity: string | null
  shippingPostalCode: string | null
  shippingCountry: string | null
  createdAt: Date
  items: AdminOrderItemRecord[]
}

type AdminOrderItemSelect = {
  id: true
  productNameAtPurchase: true
  productSkuAtPurchase: true
  priceAtPurchase: true
  quantity: true
  subtotalAtPurchase: true
}

type AdminOrderSelect = {
  id: true
  orderNumber: true
  subtotal: true
  shippingCost: true
  tax: true
  total: true
  status: true
  paymentStatus: true
  paymentMethod: true
  installmentCount: true
  paymentProvider: true
  paymentReference: true
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
    select: AdminOrderItemSelect
  }
}

export interface AdminOrderClient {
  order: {
    findMany(args: {
      orderBy: {
        createdAt: 'desc'
      }
      select: AdminOrderSelect
    }): Promise<AdminOrderRecord[]>
  }
}

const adminOrderItemSelect:
  AdminOrderItemSelect = {
  id: true,
  productNameAtPurchase: true,
  productSkuAtPurchase: true,
  priceAtPurchase: true,
  quantity: true,
  subtotalAtPurchase: true,
}

const adminOrderSelect:
  AdminOrderSelect = {
  id: true,
  orderNumber: true,
  subtotal: true,
  shippingCost: true,
  tax: true,
  total: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  installmentCount: true,
  paymentProvider: true,
  paymentReference: true,
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
    select:
      adminOrderItemSelect,
  },
}

function getClient(
  client?: AdminOrderClient,
): AdminOrderClient {
  return (
    client ??
    (prisma as unknown as AdminOrderClient)
  )
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
  item: AdminOrderItemRecord,
): AdminOrderItem {
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
  order: AdminOrderRecord,
): AdminOrder {
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
    status: order.status,
    paymentStatus:
      order.paymentStatus,
    paymentMethod:
      order.paymentMethod,
    installmentCount:
      order.installmentCount,
    paymentProvider:
      order.paymentProvider,
    paymentReference:
      order.paymentReference,
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
  }
}

export async function listAdminOrders(
  client?: AdminOrderClient,
): Promise<AdminOrder[]> {
  const db =
    getClient(client)

  const orders =
    await db.order.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select:
        adminOrderSelect,
    })

  return orders.map(
    mapOrder,
  )
}
