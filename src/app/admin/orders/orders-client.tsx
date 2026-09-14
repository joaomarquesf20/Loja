'use client'

import {
  useEffect,
  useState,
} from 'react'

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'

type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

type PaymentMethod =
  | 'CARD'
  | 'INSTALLMENTS'

type FulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

type AdminOrderAction =
  | 'CONFIRM'
  | 'START_PROCESSING'
  | 'SHIP'
  | 'DELIVER'
  | 'READY_FOR_PICKUP'
  | 'PICK_UP'
  | 'CANCEL'

type OrderItem = {
  id: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: string
  quantity: number
  subtotalAtPurchase: string
}

type AdminOrder = {
  id: string
  orderNumber: string
  subtotal: string
  shippingCost: string
  tax: string
  total: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  installmentCount: number | null
  paymentProvider: string | null
  paymentReference: string | null
  fulfillmentMethod: FulfillmentMethod
  shippingName: string
  shippingEmail: string
  shippingPhone: string
  shippingAddressLine1: string | null
  shippingAddressLine2: string | null
  shippingCity: string | null
  shippingPostalCode: string | null
  shippingCountry: string | null
  createdAt: string
  items: OrderItem[]
}

type LifecycleState = {
  id: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentMethod: FulfillmentMethod
  paymentProvider: string | null
  paymentReference: string | null
}

const orderStatusLabels:
  Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmada',
  PROCESSING: 'Em processamento',
  SHIPPED: 'Expedida',
  DELIVERED: 'Entregue',
  READY_FOR_PICKUP:
    'Pronta para levantamento',
  PICKED_UP: 'Levantada',
  CANCELLED: 'Cancelada',
}

const paymentStatusLabels:
  Record<PaymentStatus, string> = {
  PENDING: 'Pendente',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pago',
  FAILED: 'Falhou',
  REFUNDED: 'Reembolsado',
}

const actionLabels:
  Record<AdminOrderAction, string> = {
  CONFIRM:
    'Confirmar encomenda',
  START_PROCESSING:
    'Iniciar processamento',
  SHIP:
    'Marcar como expedida',
  DELIVER:
    'Marcar como entregue',
  READY_FOR_PICKUP:
    'Marcar pronta para levantamento',
  PICK_UP:
    'Marcar como levantada',
  CANCEL:
    'Cancelar encomenda',
}

function formatMoney(
  value: string,
) {
  const number =
    Number(value)

  if (!Number.isFinite(number)) {
    return value
  }

  return `${number.toFixed(2)} €`
}

function formatDate(
  value: string,
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return date.toLocaleString(
    'pt-PT',
  )
}

function getPaymentMethodLabel(
  order: AdminOrder,
) {
  if (
    order.paymentMethod ===
    'CARD'
  ) {
    return 'Cartão'
  }

  if (
    order.paymentMethod ===
    'INSTALLMENTS'
  ) {
    if (
      order.installmentCount &&
      order.installmentCount >= 2
    ) {
      return `Prestações (${order.installmentCount}x)`
    }

    return 'Prestações'
  }

  return 'Não registado'
}

function canCancelOrder(
  order: AdminOrder,
) {
  const paymentAllowsCancellation =
    order.paymentStatus ===
      'PENDING' ||
    order.paymentStatus ===
      'FAILED' ||
    order.paymentStatus ===
      'REFUNDED'

  const statusAllowsCancellation =
    order.status ===
      'PENDING' ||
    order.status ===
      'CONFIRMED' ||
    order.status ===
      'PROCESSING' ||
    order.status ===
      'READY_FOR_PICKUP'

  return (
    paymentAllowsCancellation &&
    statusAllowsCancellation
  )
}

function getAvailableActions(
  order: AdminOrder,
): AdminOrderAction[] {
  const actions:
    AdminOrderAction[] = []

  if (
    order.paymentStatus ===
    'PAID'
  ) {
    switch (order.status) {
      case 'PENDING':
        actions.push(
          'CONFIRM',
        )
        break

      case 'CONFIRMED':
        actions.push(
          'START_PROCESSING',
        )
        break

      case 'PROCESSING':
        actions.push(
          order.fulfillmentMethod ===
          'DELIVERY'
            ? 'SHIP'
            : 'READY_FOR_PICKUP',
        )
        break

      case 'SHIPPED':
        if (
          order.fulfillmentMethod ===
          'DELIVERY'
        ) {
          actions.push(
            'DELIVER',
          )
        }
        break

      case 'READY_FOR_PICKUP':
        if (
          order.fulfillmentMethod ===
          'PICKUP'
        ) {
          actions.push(
            'PICK_UP',
          )
        }
        break
    }
  }

  if (
    canCancelOrder(
      order,
    )
  ) {
    actions.push(
      'CANCEL',
    )
  }

  return actions
}

function getPaymentNotice(
  order: AdminOrder,
) {
  switch (
    order.paymentStatus
  ) {
    case 'PENDING':
      return 'A aguardar confirmação do pagamento. Enquanto estiver pendente, a encomenda pode ser cancelada e o stock é reposto.'

    case 'AUTHORIZED':
      return 'O pagamento está autorizado. É necessário anulá-lo no fornecedor antes de cancelar a encomenda.'

    case 'FAILED':
      return 'O pagamento falhou. A encomenda pode ser cancelada e o stock é reposto.'

    case 'REFUNDED':
      return 'O pagamento está reembolsado. Se a encomenda ainda não saiu da loja, pode ser cancelada com reposição de stock.'

    default:
      return null
  }
}

async function getErrorMessage(
  response: Response,
) {
  try {
    const data =
      (await response.json()) as {
        error?: string
      }

    return (
      data.error ??
      'Ocorreu um erro inesperado'
    )
  } catch {
    return 'Ocorreu um erro inesperado'
  }
}

function getDeliveryDescription(
  order: AdminOrder,
) {
  if (
    order.fulfillmentMethod ===
    'PICKUP'
  ) {
    return 'Levantamento em loja'
  }

  const address = [
    order.shippingAddressLine1,
    order.shippingAddressLine2,
    [
      order.shippingPostalCode,
      order.shippingCity,
    ]
      .filter(Boolean)
      .join(' '),
    order.shippingCountry,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    address ||
    'Morada de entrega indisponível'
  )
}

export default function OrdersClient() {
  const [
    orders,
    setOrders,
  ] = useState<AdminOrder[]>(
    [],
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    submittingOrderId,
    setSubmittingOrderId,
  ] = useState<string | null>(
    null,
  )

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    async function loadInitialOrders() {
      try {
        const response =
          await fetch(
            '/api/admin/orders',
          )

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
            ),
          )
        }

        const data =
          (await response.json()) as {
            orders: AdminOrder[]
          }

        if (!cancelled) {
          setOrders(
            data.orders,
          )
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar as encomendas',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInitialOrders()

    return () => {
      cancelled = true
    }
  }, [])

  async function refreshOrders() {
    if (
      refreshing ||
      submittingOrderId !== null
    ) {
      return
    }

    try {
      setRefreshing(true)
      setError(null)

      const response =
        await fetch(
          '/api/admin/orders',
        )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
          ),
        )
      }

      const data =
        (await response.json()) as {
          orders: AdminOrder[]
        }

      setOrders(
        data.orders,
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar as encomendas',
      )
    } finally {
      setRefreshing(false)
    }
  }

  async function handleAction(
    order: AdminOrder,
    action: AdminOrderAction,
  ) {
    if (submittingOrderId) {
      return
    }

    if (
      action ===
        'CANCEL' &&
      !window.confirm(
        `Cancelar a encomenda "${order.orderNumber}" e repor o stock?`,
      )
    ) {
      return
    }

    try {
      setSubmittingOrderId(
        order.id,
      )
      setError(null)

      const response =
        await fetch(
          `/api/admin/orders/${order.id}/transition`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                action,
              }),
          },
        )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
          ),
        )
      }

      const state =
        (await response.json()) as LifecycleState

      setOrders(
        (current) =>
          current.map(
            (currentOrder) =>
              currentOrder.id ===
              state.id
                ? {
                    ...currentOrder,
                    status:
                      state.status,
                    paymentStatus:
                      state.paymentStatus,
                    fulfillmentMethod:
                      state.fulfillmentMethod,
                    paymentProvider:
                      state.paymentProvider,
                    paymentReference:
                      state.paymentReference,
                  }
                : currentOrder,
          ),
      )
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Não foi possível atualizar a encomenda',
      )
    } finally {
      setSubmittingOrderId(
        null,
      )
    }
  }

  if (loading) {
    return (
      <p>
        A carregar encomendas...
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={
            refreshing ||
            submittingOrderId !==
              null
          }
          onClick={() =>
            void refreshOrders()
          }
          className="rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          {refreshing
            ? 'A atualizar...'
            : 'Atualizar'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-red-800"
        >
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="rounded border p-4 text-gray-600">
          Ainda não existem
          encomendas.
        </p>
      ) : (
        <div className="space-y-5">
          {orders.map(
            (order) => {
              const actions =
                getAvailableActions(
                  order,
                )

              const isSubmitting =
                submittingOrderId ===
                order.id

              return (
                <article
                  key={order.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {
                          order.orderNumber
                        }
                      </h2>

                      <p className="mt-1 text-sm text-gray-600">
                        {formatDate(
                          order.createdAt,
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded bg-gray-100 px-2 py-1">
                        Estado:{' '}
                        {
                          orderStatusLabels[
                            order.status
                          ]
                        }
                      </span>

                      <span className="rounded bg-gray-100 px-2 py-1">
                        Pagamento:{' '}
                        {
                          paymentStatusLabels[
                            order.paymentStatus
                          ]
                        }
                      </span>

                      <span className="rounded bg-gray-100 px-2 py-1">
                        {
                          order.fulfillmentMethod ===
                          'DELIVERY'
                            ? 'Entrega'
                            : 'Levantamento'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Cliente
                      </h3>

                      <p className="mt-1">
                        {
                          order.shippingName
                        }
                      </p>

                      <p className="text-sm text-gray-600">
                        {
                          order.shippingEmail
                        }
                      </p>

                      <p className="text-sm text-gray-600">
                        {
                          order.shippingPhone
                        }
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold">
                        Entrega
                      </h3>

                      <p className="mt-1 text-sm">
                        {getDeliveryDescription(
                          order,
                        )}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold">
                        Pagamento
                      </h3>

                      <p className="mt-1 text-sm">
                        {getPaymentMethodLabel(
                          order,
                        )}
                      </p>

                      {order.paymentProvider && (
                        <p className="text-sm text-gray-600">
                          Fornecedor:{' '}
                          {
                            order.paymentProvider
                          }
                        </p>
                      )}

                      {order.paymentReference && (
                        <p className="break-all text-sm text-gray-600">
                          Referência:{' '}
                          {
                            order.paymentReference
                          }
                        </p>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold">
                        Total
                      </h3>

                      <p className="mt-1 text-lg font-semibold">
                        {formatMoney(
                          order.total,
                        )}
                      </p>

                      <p className="text-sm text-gray-600">
                        Portes:{' '}
                        {formatMoney(
                          order.shippingCost,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 pr-4">
                            Produto
                          </th>
                          <th className="py-2 pr-4">
                            SKU
                          </th>
                          <th className="py-2 pr-4">
                            Quantidade
                          </th>
                          <th className="py-2">
                            Subtotal
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {order.items.map(
                          (item) => (
                            <tr
                              key={
                                item.id
                              }
                              className="border-b last:border-b-0"
                            >
                              <td className="py-2 pr-4">
                                {
                                  item.productNameAtPurchase
                                }
                              </td>

                              <td className="py-2 pr-4">
                                {
                                  item.productSkuAtPurchase
                                }
                              </td>

                              <td className="py-2 pr-4">
                                {
                                  item.quantity
                                }
                              </td>

                              <td className="py-2">
                                {formatMoney(
                                  item.subtotalAtPurchase,
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4">
                    {getPaymentNotice(
                      order,
                    ) && (
                      <p className="mb-3 text-sm text-amber-800">
                        {getPaymentNotice(
                          order,
                        )}
                      </p>
                    )}

                    {actions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {actions.map(
                          (action) => (
                            <button
                              key={
                                action
                              }
                              type="button"
                              disabled={
                                isSubmitting
                              }
                              onClick={() =>
                                void handleAction(
                                  order,
                                  action,
                                )
                              }
                              className={
                                action ===
                                'CANCEL'
                                  ? 'rounded border border-red-700 px-3 py-2 text-sm text-red-700 disabled:opacity-50'
                                  : 'rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50'
                              }
                            >
                              {isSubmitting
                                ? 'A atualizar...'
                                : actionLabels[
                                    action
                                  ]}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </article>
              )
            },
          )}
        </div>
      )}
    </div>
  )
}
