'use client'

import {
  useEffect,
  useState,
} from 'react'

type FulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

type OrderItem = {
  id: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: string
  quantity: number
  subtotalAtPurchase: string
}

type OrderEvent = {
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
  createdAt: string
}

type Order = {
  id: string
  orderNumber: string
  subtotal: string
  shippingCost: string
  tax: string
  total: string
  status: string
  paymentStatus: string
  fulfillmentMethod:
    FulfillmentMethod
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
  createdAt: string
  items: OrderItem[]
  events: OrderEvent[]
}

type OrdersMode =
  | 'loading'
  | 'ready'
  | 'error'

type OrdersResponse = {
  orders: Order[]
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isMoney(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(
      Number(value),
    )
  )
}

function isOrderItem(
  value: unknown,
): value is OrderItem {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.productNameAtPurchase ===
      'string' &&
    typeof value.productSkuAtPurchase ===
      'string' &&
    isMoney(
      value.priceAtPurchase,
    ) &&
    Number.isSafeInteger(
      value.quantity,
    ) &&
    Number(value.quantity) > 0 &&
    isMoney(
      value.subtotalAtPurchase,
    )
  )
}

function isValidDateString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(
      Date.parse(value),
    )
  )
}

function isNullableString(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    typeof value === 'string'
  )
}

function isOrderEvent(
  value: unknown,
): value is OrderEvent {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    isNullableString(
      value.fromOrderStatus,
    ) &&
    isNullableString(
      value.toOrderStatus,
    ) &&
    isNullableString(
      value.fromPaymentStatus,
    ) &&
    isNullableString(
      value.toPaymentStatus,
    ) &&
    isValidDateString(
      value.createdAt,
    )
  )
}

function isFulfillmentMethod(
  value: unknown,
): value is FulfillmentMethod {
  return (
    value === 'DELIVERY' ||
    value === 'PICKUP'
  )
}

function hasValidDeliveryAddress(
  value: Record<string, unknown>,
) {
  return (
    typeof value.shippingAddressLine1 ===
      'string' &&
    (
      value.shippingAddressLine2 ===
        null ||
      typeof value.shippingAddressLine2 ===
        'string'
    ) &&
    typeof value.shippingCity ===
      'string' &&
    typeof value.shippingPostalCode ===
      'string' &&
    typeof value.shippingCountry ===
      'string'
  )
}

function hasValidPickupAddress(
  value: Record<string, unknown>,
) {
  return (
    value.shippingAddressLine1 ===
      null &&
    value.shippingAddressLine2 ===
      null &&
    value.shippingCity ===
      null &&
    value.shippingPostalCode ===
      null &&
    value.shippingCountry ===
      null
  )
}

function isOrder(
  value: unknown,
): value is Order {
  if (!isRecord(value)) {
    return false
  }

  if (
    !isFulfillmentMethod(
      value.fulfillmentMethod,
    )
  ) {
    return false
  }

  const hasValidFulfillmentData =
    value.fulfillmentMethod ===
    'DELIVERY'
      ? hasValidDeliveryAddress(
          value,
        )
      : hasValidPickupAddress(
          value,
        )

  return (
    typeof value.id === 'string' &&
    typeof value.orderNumber ===
      'string' &&
    isMoney(value.subtotal) &&
    isMoney(
      value.shippingCost,
    ) &&
    isMoney(value.tax) &&
    isMoney(value.total) &&
    typeof value.status ===
      'string' &&
    typeof value.paymentStatus ===
      'string' &&
    typeof value.shippingName ===
      'string' &&
    typeof value.shippingEmail ===
      'string' &&
    typeof value.shippingPhone ===
      'string' &&
    hasValidFulfillmentData &&
    isValidDateString(
      value.createdAt,
    ) &&
    Array.isArray(
      value.items,
    ) &&
    value.items.every(
      isOrderItem,
    ) &&
    Array.isArray(
      value.events,
    ) &&
    value.events.every(
      isOrderEvent,
    )
  )
}

async function getResponseError(
  response: Response,
) {
  try {
    const body: unknown =
      await response.json()

    if (
      isRecord(body) &&
      typeof body.error === 'string'
    ) {
      return body.error
    }
  } catch {
    // A resposta pode não ter JSON.
  }

  return 'Não foi possível carregar as encomendas'
}

async function parseOrders(
  response: Response,
): Promise<Order[]> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !Array.isArray(body.orders) ||
    !body.orders.every(isOrder)
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return (
    body as OrdersResponse
  ).orders
}

async function fetchOrders() {
  const response = await fetch(
    '/api/orders',
    {
      method: 'GET',
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getResponseError(
        response,
      ),
    )
  }

  return parseOrders(response)
}

function formatMoney(
  value: string,
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
    },
  ).format(Number(value))
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      dateStyle: 'medium',
      timeZone: 'Europe/Lisbon',
    },
  ).format(new Date(value))
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Lisbon',
    },
  ).format(new Date(value))
}

function getOrderStatusLabel(
  status: string,
) {
  switch (status) {
    case 'PENDING':
      return 'Pendente'
    case 'CONFIRMED':
      return 'Confirmada'
    case 'PROCESSING':
      return 'Em processamento'
    case 'SHIPPED':
      return 'Enviada'
    case 'DELIVERED':
      return 'Entregue'
    case 'READY_FOR_PICKUP':
      return 'Pronta para levantamento'
    case 'PICKED_UP':
      return 'Levantada'
    case 'CANCELLED':
      return 'Cancelada'
    default:
      return status
  }
}

function getPaymentStatusLabel(
  status: string,
) {
  switch (status) {
    case 'PENDING':
      return 'Pendente'
    case 'AUTHORIZED':
      return 'Autorizado'
    case 'PAID':
      return 'Pago'
    case 'FAILED':
      return 'Falhou'
    case 'REFUNDED':
      return 'Reembolsado'
    default:
      return status
  }
}

function getOrderEventTitle(
  event: OrderEvent,
) {
  switch (event.type) {
    case 'PAYMENT_CONFIRMED':
      return 'Pagamento confirmado'
    case 'STATUS_CHANGED':
      return 'Estado alterado'
    case 'PAYMENT_REFUNDED':
      return 'Pagamento reembolsado'
    case 'CANCELLED':
      return 'Encomenda cancelada'
    default:
      return event.type
  }
}

function getTransitionLabel(
  fromValue: string | null,
  toValue: string | null,
  getLabel: (
    value: string,
  ) => string,
) {
  if (fromValue && toValue) {
    return `${getLabel(
      fromValue,
    )} → ${getLabel(toValue)}`
  }

  if (toValue) {
    return getLabel(toValue)
  }

  return null
}

function getOrderEventDetail(
  event: OrderEvent,
) {
  if (
    event.type ===
      'PAYMENT_CONFIRMED' ||
    event.type ===
      'PAYMENT_REFUNDED'
  ) {
    return getTransitionLabel(
      event.fromPaymentStatus,
      event.toPaymentStatus,
      getPaymentStatusLabel,
    )
  }

  if (
    event.type ===
      'STATUS_CHANGED' ||
    event.type === 'CANCELLED'
  ) {
    return getTransitionLabel(
      event.fromOrderStatus,
      event.toOrderStatus,
      getOrderStatusLabel,
    )
  }

  return null
}

function getErrorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar as encomendas'
}

export function OrdersClient() {
  const [mode, setMode] =
    useState<OrdersMode>(
      'loading',
    )

  const [
    orders,
    setOrders,
  ] = useState<Order[]>([])

  const [error, setError] =
    useState<string | null>(
      null,
    )

  async function loadOrders() {
    setError(null)

    try {
      const nextOrders =
        await fetchOrders()

      setOrders(nextOrders)
      setMode('ready')
    } catch (caughtError) {
      setError(
        getErrorMessage(
          caughtError,
        ),
      )

      setMode('error')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)

      try {
        const nextOrders =
          await fetchOrders()

        if (!cancelled) {
          setOrders(
            nextOrders,
          )
          setMode('ready')
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              caughtError,
            ),
          )

          setMode('error')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (mode === 'loading') {
    return (
      <section className="rounded-xl border p-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A carregar encomendas…
        </p>
      </section>
    )
  }

  if (mode === 'error') {
    return (
      <section
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
      >
        <h2 className="font-semibold">
          Não foi possível carregar
          as encomendas
        </h2>

        <p className="mt-2 text-sm">
          {error ??
            'Ocorreu um erro ao carregar as encomendas.'}
        </p>

        <button
          type="button"
          onClick={() =>
            void loadOrders()
          }
          className="mt-4 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-900 dark:border-red-800 dark:hover:bg-red-950"
        >
          Tentar novamente
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-xl border p-6">
      <h2 className="text-xl font-bold">
        Encomendas
      </h2>

      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Consulta o histórico das
        encomendas associadas à tua
        conta.
      </p>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed p-4 text-sm text-neutral-600 dark:text-neutral-400">
          Ainda não tens encomendas.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {orders.map(
            (order) => {
              const isPickup =
                order.fulfillmentMethod ===
                'PICKUP'

              return (
                <article
                  key={order.id}
                  className="rounded-lg border p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold">
                        Encomenda{' '}
                        {
                          order.orderNumber
                        }
                      </h3>

                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDate(
                          order.createdAt,
                        )}
                      </p>
                    </div>

                    <div className="text-sm sm:text-right">
                      <p>
                        Estado:{' '}
                        <span className="font-semibold">
                          {getOrderStatusLabel(
                            order.status,
                          )}
                        </span>
                      </p>

                      <p className="mt-1">
                        Pagamento:{' '}
                        <span className="font-semibold">
                          {getPaymentStatusLabel(
                            order.paymentStatus,
                          )}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t pt-5">
                    <h4 className="font-semibold">
                      Histórico
                    </h4>

                    <ol className="mt-3 space-y-3">
                      <li className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                        <p className="font-medium">
                          Encomenda criada
                        </p>

                        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                          {formatDateTime(
                            order.createdAt,
                          )}
                        </p>
                      </li>

                      {order.events.map(
                        (event) => {
                          const detail =
                            getOrderEventDetail(
                              event,
                            )

                          return (
                            <li
                              key={event.id}
                              className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900"
                            >
                              <p className="font-medium">
                                {getOrderEventTitle(
                                  event,
                                )}
                              </p>

                              {detail ? (
                                <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                                  {detail}
                                </p>
                              ) : null}

                              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                                {formatDateTime(
                                  event.createdAt,
                                )}
                              </p>
                            </li>
                          )
                        },
                      )}
                    </ol>
                  </div>

                  <div className="mt-5 border-t pt-5">
                    <h4 className="font-semibold">
                      Artigos
                    </h4>

                    <div className="mt-3 space-y-3">
                      {order.items.map(
                        (item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div>
                              <p className="font-medium">
                                {
                                  item.productNameAtPurchase
                                }
                              </p>

                              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                                SKU:{' '}
                                {
                                  item.productSkuAtPurchase
                                }
                              </p>

                              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                                Quantidade:{' '}
                                {
                                  item.quantity
                                }
                              </p>

                              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                                Preço
                                unitário:{' '}
                                {formatMoney(
                                  item.priceAtPurchase,
                                )}
                              </p>
                            </div>

                            <strong>
                              {formatMoney(
                                item.subtotalAtPurchase,
                              )}
                            </strong>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2">
                    <div>
                      <h4 className="font-semibold">
                        {isPickup
                          ? 'Levantamento em loja'
                          : 'Entrega'}
                      </h4>

                      {isPickup ? (
                        <div className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                          <div>
                            {
                              order.shippingName
                            }
                          </div>

                          <div>
                            {
                              order.shippingEmail
                            }
                          </div>

                          <div>
                            {
                              order.shippingPhone
                            }
                          </div>
                        </div>
                      ) : (
                        <address className="mt-2 not-italic text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                          <div>
                            {
                              order.shippingName
                            }
                          </div>

                          <div>
                            {
                              order.shippingAddressLine1
                            }
                          </div>

                          {order.shippingAddressLine2 ? (
                            <div>
                              {
                                order.shippingAddressLine2
                              }
                            </div>
                          ) : null}

                          <div>
                            {
                              order.shippingPostalCode
                            }{' '}
                            {
                              order.shippingCity
                            }
                          </div>

                          <div>
                            {
                              order.shippingCountry
                            }
                          </div>

                          <div>
                            {
                              order.shippingEmail
                            }
                          </div>

                          <div>
                            {
                              order.shippingPhone
                            }
                          </div>
                        </address>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold">
                        Totais
                      </h4>

                      <dl className="mt-2 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-neutral-600 dark:text-neutral-400">
                            Subtotal
                          </dt>

                          <dd>
                            {formatMoney(
                              order.subtotal,
                            )}
                          </dd>
                        </div>

                        <div className="flex justify-between gap-4">
                          <dt className="text-neutral-600 dark:text-neutral-400">
                            Portes
                          </dt>

                          <dd>
                            {formatMoney(
                              order.shippingCost,
                            )}
                          </dd>
                        </div>

                        <div className="flex justify-between gap-4">
                          <dt className="text-neutral-600 dark:text-neutral-400">
                            Imposto
                          </dt>

                          <dd>
                            {formatMoney(
                              order.tax,
                            )}
                          </dd>
                        </div>

                        <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                          <dt>
                            Total
                          </dt>

                          <dd>
                            {formatMoney(
                              order.total,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </article>
              )
            },
          )}
        </div>
      )}
    </section>
  )
}