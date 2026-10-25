'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
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
  | 'REFUND_PAYMENT'
  | 'CANCEL'

type OrderItem = {
  id: string
  variantOptionsAtPurchase?: Array<{
    code: string
    name: string
    value: string
  }>
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

const orderStatusOptions =
  Object.entries(
    orderStatusLabels,
  ) as Array<[OrderStatus, string]>

const paymentStatusOptions =
  Object.entries(
    paymentStatusLabels,
  ) as Array<[PaymentStatus, string]>

const ORDERS_PAGE_SIZE = 10

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
  REFUND_PAYMENT:
    'Reembolsar pagamento',
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

function canRefundSimulatedPayment(
  order: AdminOrder,
) {
  const statusAllowsRefund =
    order.status ===
      'PENDING' ||
    order.status ===
      'CONFIRMED' ||
    order.status ===
      'PROCESSING' ||
    order.status ===
      'READY_FOR_PICKUP'

  return (
    order.paymentStatus ===
      'PAID' &&
    order.paymentProvider ===
      'PFA_SIMULATED' &&
    Boolean(
      order.paymentReference,
    ) &&
    statusAllowsRefund
  )
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
    canRefundSimulatedPayment(
      order,
    )
  ) {
    actions.push(
      'REFUND_PAYMENT',
    )
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

    case 'PAID':
      if (
        canRefundSimulatedPayment(
          order,
        )
      ) {
        return 'Pagamento simulado confirmado. Para cancelar esta encomenda, reembolsa primeiro o pagamento e depois cancela para repor o stock.'
      }

      return null

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

  const [search, setSearch] =
    useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    OrderStatus | 'all'
  >('all')

  const [
    paymentFilter,
    setPaymentFilter,
  ] = useState<
    PaymentStatus | 'all'
  >('all')

  const [page, setPage] = useState(0)

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

  const filteredOrders =
    useMemo(() => {
      const query = search
        .trim()
        .toLocaleLowerCase(
          'pt-PT',
        )

      return orders.filter((order) => {
        const matchesQuery =
          !query ||
          [
            order.orderNumber,
            order.shippingName,
            order.shippingEmail,
            order.shippingPhone,
          ].some((value) =>
            value
              .toLocaleLowerCase('pt-PT')
              .includes(query),
          )

        const matchesStatus =
          statusFilter ===
            'all' ||
          order.status ===
            statusFilter

        const matchesPayment =
          paymentFilter ===
            'all' ||
          order.paymentStatus ===
            paymentFilter

        return (
          matchesQuery &&
          matchesStatus &&
          matchesPayment
        )
      })
    }, [
      orders,
      search,
      statusFilter,
      paymentFilter,
    ])

  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredOrders.length /
        ORDERS_PAGE_SIZE,
    ),
  )

  const currentPage = Math.min(
    page,
    pageCount - 1,
  )

  const pagedOrders =
    filteredOrders.slice(
      currentPage * ORDERS_PAGE_SIZE,
      (currentPage + 1) *
        ORDERS_PAGE_SIZE,
    )

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

    if (
      action ===
        'REFUND_PAYMENT' &&
      !window.confirm(
        `Reembolsar o pagamento simulado da encomenda "${order.orderNumber}"? Esta operação não movimenta dinheiro real.`,
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
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            {filteredOrders.length} de{' '}
            {orders.length} encomendas
          </p>

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

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Pesquisar
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value,
                )
                setPage(0)
              }}
              placeholder="Nº de encomenda, nome ou email"
              className="rounded border border-gray-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900"
            />
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Estado da encomenda
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target
                    .value as
                    OrderStatus | 'all',
                )
                setPage(0)
              }}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900"
            >
              <option value="all">
                Todos
              </option>

              {orderStatusOptions.map(
                ([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Pagamento
            <select
              value={paymentFilter}
              onChange={(event) => {
                setPaymentFilter(
                  event.target
                    .value as
                    PaymentStatus | 'all',
                )
                setPage(0)
              }}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900"
            >
              <option value="all">
                Todos
              </option>

              {paymentStatusOptions.map(
                ([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-red-800"
        >
          {error}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        orders.length === 0 ? (
          <p className="rounded border p-4 text-gray-600">
            Ainda não existem
            encomendas.
          </p>
        ) : (
          <div className="rounded border p-4 text-center">
            <p className="font-semibold">
              Nenhuma encomenda
              corresponde aos filtros
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setPaymentFilter('all')
                setPage(0)
              }}
              className="mt-2 text-sm font-semibold text-blue-700 underline"
            >
              Limpar filtros
            </button>
          </div>
        )
      ) : (
        <div className="space-y-5">
          {pagedOrders.map(
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

                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                      >
                        Ver ficha completa
                      </Link>
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
                                <span>{item.productNameAtPurchase}</span>
                                {!!item.variantOptionsAtPurchase?.length && (
                                  <span className="block text-xs text-gray-500">
                                    {item.variantOptionsAtPurchase
                                      .map((option) =>
                                        `${option.name}: ${option.value}`,
                                      )
                                      .join(' · ')}
                                  </span>
                                )}
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
                                  : action ===
                                      'REFUND_PAYMENT'
                                    ? 'rounded border border-amber-700 px-3 py-2 text-sm text-amber-800 disabled:opacity-50'
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

          {pageCount > 1 && (
            <nav
              aria-label="Paginação das encomendas"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <p className="text-sm font-semibold">
                Página {currentPage + 1} de{' '}
                {pageCount}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={currentPage === 0}
                  onClick={() =>
                    setPage(
                      currentPage - 1,
                    )
                  }
                  className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  aria-label="Página seguinte"
                  disabled={
                    currentPage >=
                    pageCount - 1
                  }
                  onClick={() =>
                    setPage(
                      currentPage + 1,
                    )
                  }
                  className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  Seguinte
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
