import { prisma } from './db'

type MoneyValue =
  | string
  | number
  | {
      toString(): string
    }

type NullableMoneyValue =
  | MoneyValue
  | null

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

export type AdminCheckoutRegion =
  | 'PORTUGAL_MAINLAND'
  | 'MADEIRA'
  | 'AZORES'
  | 'INTERNATIONAL'

export type AdminShippingClass =
  | 'UNASSIGNED'
  | 'SMALL'
  | 'STANDARD'
  | 'BULKY'
  | 'HEAVY'
  | 'QUOTE_REQUIRED'

export type AdminOrderEventType =
  | 'PAYMENT_CONFIRMED'
  | 'STATUS_CHANGED'
  | 'PAYMENT_REFUNDED'
  | 'CANCELLED'

export type AdminOrderEvent = {
  id: string
  type: AdminOrderEventType
  fromOrderStatus:
    AdminOrderStatus | null
  toOrderStatus:
    AdminOrderStatus | null
  fromPaymentStatus:
    AdminPaymentStatus | null
  toPaymentStatus:
    AdminPaymentStatus | null
  createdAt: Date
}

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

export type AdminOrderDetailItem =
  AdminOrderItem & {
    productId: string
    shippingClassAtPurchase:
      AdminShippingClass | null
    shippingCostAtPurchase:
      string | null
  }

export type AdminOrderDetail =
  Omit<AdminOrder, 'items'> & {
    updatedAt: Date
    shippingRegion:
      AdminCheckoutRegion | null
    shippingClassApplied:
      AdminShippingClass | null
    taxRatePercent:
      string | null
    pricesIncludeTax:
      boolean | null
    nonVolumousSubtotal:
      string | null
    nonVolumousShippingCost:
      string | null
    bulkyShippingCost:
      string | null
    freeShippingThreshold:
      string | null
    freeShippingApplied:
      boolean | null
    items: AdminOrderDetailItem[]
    events: AdminOrderEvent[]
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

type AdminOrderDetailItemRecord =
  AdminOrderItemRecord & {
    productId: string
    shippingClassAtPurchase:
      AdminShippingClass | null
    shippingCostAtPurchase:
      NullableMoneyValue
  }

type AdminOrderEventRecord = {
  id: string
  type: AdminOrderEventType
  fromOrderStatus:
    AdminOrderStatus | null
  toOrderStatus:
    AdminOrderStatus | null
  fromPaymentStatus:
    AdminPaymentStatus | null
  toPaymentStatus:
    AdminPaymentStatus | null
  createdAt: Date
}

type AdminOrderDetailRecord =
  Omit<AdminOrderRecord, 'items'> & {
    updatedAt: Date
    shippingRegion:
      AdminCheckoutRegion | null
    shippingClassApplied:
      AdminShippingClass | null
    taxRatePercent:
      NullableMoneyValue
    pricesIncludeTax:
      boolean | null
    nonVolumousSubtotal:
      NullableMoneyValue
    nonVolumousShippingCost:
      NullableMoneyValue
    bulkyShippingCost:
      NullableMoneyValue
    freeShippingThreshold:
      NullableMoneyValue
    freeShippingApplied:
      boolean | null
    items:
      AdminOrderDetailItemRecord[]
    events:
      AdminOrderEventRecord[]
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

type AdminOrderDetailItemSelect =
  AdminOrderItemSelect & {
    productId: true
    shippingClassAtPurchase: true
    shippingCostAtPurchase: true
  }

type AdminOrderEventSelect = {
  id: true
  type: true
  fromOrderStatus: true
  toOrderStatus: true
  fromPaymentStatus: true
  toPaymentStatus: true
  createdAt: true
}

type AdminOrderDetailSelect = {
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
  shippingRegion: true
  shippingClassApplied: true
  taxRatePercent: true
  pricesIncludeTax: true
  nonVolumousSubtotal: true
  nonVolumousShippingCost: true
  bulkyShippingCost: true
  freeShippingThreshold: true
  freeShippingApplied: true
  createdAt: true
  updatedAt: true
  items: {
    orderBy: {
      id: 'asc'
    }
    select: AdminOrderDetailItemSelect
  }
  events: {
    orderBy: {
      createdAt: 'asc'
    }
    select: AdminOrderEventSelect
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
    findUnique(args: {
      where: {
        id: string
      }
      select: AdminOrderDetailSelect
    }): Promise<
      AdminOrderDetailRecord | null
    >
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

const adminOrderDetailItemSelect:
  AdminOrderDetailItemSelect = {
  ...adminOrderItemSelect,
  productId: true,
  shippingClassAtPurchase:
    true,
  shippingCostAtPurchase:
    true,
}

const adminOrderEventSelect:
  AdminOrderEventSelect = {
  id: true,
  type: true,
  fromOrderStatus: true,
  toOrderStatus: true,
  fromPaymentStatus: true,
  toPaymentStatus: true,
  createdAt: true,
}

const adminOrderDetailSelect:
  AdminOrderDetailSelect = {
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
  shippingRegion: true,
  shippingClassApplied: true,
  taxRatePercent: true,
  pricesIncludeTax: true,
  nonVolumousSubtotal: true,
  nonVolumousShippingCost: true,
  bulkyShippingCost: true,
  freeShippingThreshold: true,
  freeShippingApplied: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: {
      id: 'asc',
    },
    select:
      adminOrderDetailItemSelect,
  },
  events: {
    orderBy: {
      createdAt: 'asc',
    },
    select:
      adminOrderEventSelect,
  },
}

function getClient(
  client?: AdminOrderClient,
): AdminOrderClient {
  return (
    client ??
    (prisma as unknown as
      AdminOrderClient)
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

function nullableMoneyToString(
  value: NullableMoneyValue,
) {
  return value === null
    ? null
    : moneyToString(value)
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

function mapOrderDetailItem(
  item: AdminOrderDetailItemRecord,
): AdminOrderDetailItem {
  return {
    ...mapOrderItem(item),
    productId:
      item.productId,
    shippingClassAtPurchase:
      item.shippingClassAtPurchase,
    shippingCostAtPurchase:
      nullableMoneyToString(
        item.shippingCostAtPurchase,
      ),
  }
}

function mapOrderEvent(
  event: AdminOrderEventRecord,
): AdminOrderEvent {
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

function mapOrderDetail(
  order: AdminOrderDetailRecord,
): AdminOrderDetail {
  return {
    ...mapOrder(order),
    updatedAt:
      order.updatedAt,
    shippingRegion:
      order.shippingRegion,
    shippingClassApplied:
      order.shippingClassApplied,
    taxRatePercent:
      nullableMoneyToString(
        order.taxRatePercent,
      ),
    pricesIncludeTax:
      order.pricesIncludeTax,
    nonVolumousSubtotal:
      nullableMoneyToString(
        order.nonVolumousSubtotal,
      ),
    nonVolumousShippingCost:
      nullableMoneyToString(
        order.nonVolumousShippingCost,
      ),
    bulkyShippingCost:
      nullableMoneyToString(
        order.bulkyShippingCost,
      ),
    freeShippingThreshold:
      nullableMoneyToString(
        order.freeShippingThreshold,
      ),
    freeShippingApplied:
      order.freeShippingApplied,
    items:
      order.items.map(
        mapOrderDetailItem,
      ),
    events:
      order.events.map(
        mapOrderEvent,
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

export async function getAdminOrderById(
  orderIdInput: string,
  client?: AdminOrderClient,
): Promise<
  AdminOrderDetail | null
> {
  const orderId =
    orderIdInput.trim()

  if (!orderId) {
    return null
  }

  const db =
    getClient(client)

  const order =
    await db.order.findUnique({
      where: {
        id: orderId,
      },
      select:
        adminOrderDetailSelect,
    })

  return order
    ? mapOrderDetail(order)
    : null
}
