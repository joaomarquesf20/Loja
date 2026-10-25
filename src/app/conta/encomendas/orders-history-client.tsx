'use client'

import {
  useEffect,
  useState,
} from 'react'

import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/storefront/order-status-badge'
import {
  redirectToExternalUrl,
} from '@/lib/redirect'

/**
 * Histórico de encomendas da conta com a retoma do pagamento Stripe:
 * encomendas pendentes podem retomar o pagamento através de uma nova
 * sessão de Checkout (POST /api/checkout/stripe/retry) — o browser
 * navega de imediato para a página alojada no Stripe, tal como no
 * checkout principal.
 */

type Order = {
  id: string
  orderNumber: string
  total: string
  status: string
  paymentStatus: string
  createdAt: string
  items: unknown[]
}

type OrdersMode =
  | 'loading'
  | 'ready'
  | 'error'

type OrdersResponse = {
  orders: Order[]
}

/**
 * Estados em que o pagamento pode ser retomado, em sincronia com o
 * serviço Stripe: a encomenda tem de estar num estado pagável e o
 * pagamento pendente.
 */
const PAYABLE_ORDER_STATUSES =
  new Set([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_PICKUP',
  ])

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

function isOrder(
  value: unknown,
): value is Order {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id ===
      'string' &&
    value.id !== '' &&
    typeof value.orderNumber ===
      'string' &&
    value.orderNumber !== '' &&
    isMoney(value.total) &&
    typeof value.status ===
      'string' &&
    typeof value.paymentStatus ===
      'string' &&
    isValidDateString(
      value.createdAt,
    ) &&
    Array.isArray(
      value.items,
    )
  )
}

async function getResponseError(
  response: Response,
  fallback: string,
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

  return fallback
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
        'Não foi possível carregar as encomendas',
      ),
    )
  }

  return parseOrders(response)
}

function canPayOrder(
  order: Order,
) {
  return (
    order.paymentStatus ===
      'PENDING' &&
    PAYABLE_ORDER_STATUSES.has(
      order.status,
    )
  )
}

/**
 * Guard de resposta da sessão de retoma: o URL tem de ser um endereço
 * http(s) devolvido pelo servidor, espelhando a validação do checkout
 * principal antes da navegação.
 */
function isStripeCheckoutSession(
  value: unknown,
): value is {
  id: string
  url: string
} {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.id !==
      'string' ||
    value.id.length === 0
  ) {
    return false
  }

  if (
    typeof value.url !==
      'string' ||
    value.url === ''
  ) {
    return false
  }

  try {
    const url = new URL(
      value.url,
    )

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

async function requestRetryPayment(
  orderId: string,
): Promise<string> {
  const response =
    await fetch(
      '/api/checkout/stripe/retry',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          orderId,
        }),
      },
    )

  if (!response.ok) {
    throw new Error(
      await getResponseError(
        response,
        'Não foi possível retomar o pagamento',
      ),
    )
  }

  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !isStripeCheckoutSession(
      body.checkoutSession,
    )
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return body.checkoutSession.url
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

export function OrdersHistoryClient() {
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

  const [
    redirectingOrderId,
    setRedirectingOrderId,
  ] = useState<string | null>(
    null,
  )

  const [
    payError,
    setPayError,
  ] = useState<{
    orderId: string
    message: string
  } | null>(null)

  async function loadOrders() {
    setError(null)

    try {
      const nextOrders =
        await fetchOrders()

      setOrders(nextOrders)
      setMode('ready')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível carregar as encomendas',
      )

      setMode('error')
    }
  }

  async function handlePayOrder(
    order: Order,
  ) {
    setPayError(null)
    setRedirectingOrderId(
      order.id,
    )

    try {
      const paymentUrl =
        await requestRetryPayment(
          order.id,
        )

      // Navegação completa para a página de pagamento alojada no
      // Stripe. O estado de redirecionamento mantém-se ativo enquanto
      // o browser sai da aplicação; em erro é libertado abaixo.
      redirectToExternalUrl(
        paymentUrl,
      )
    } catch (caughtError) {
      setPayError({
        orderId: order.id,
        message:
          caughtError instanceof Error
            ? caughtError.message
            : 'Não foi possível retomar o pagamento',
      })

      setRedirectingOrderId(null)
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
            caughtError instanceof Error
              ? caughtError.message
              : 'Não foi possível carregar as encomendas',
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
        Consulta o histórico das encomendas
        e paga as pendentes com Stripe.
      </p>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed p-4 text-sm text-neutral-600 dark:text-neutral-400">
          Ainda não tens encomendas.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {orders.map(
            (order) => {
              const canPay =
                canPayOrder(order)

              const isRedirecting =
                redirectingOrderId ===
                order.id

              const orderPayError =
                payError &&
                payError.orderId ===
                  order.id
                  ? payError.message
                  : null

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

                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {order.items.length}{' '}
                        {order.items.length ===
                        1
                          ? 'artigo'
                          : 'artigos'}
                      </p>
                    </div>

                    <div className="text-sm sm:text-right">
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <OrderStatusBadge
                          status={
                            order.status
                          }
                        />

                        <PaymentStatusBadge
                          status={
                            order.paymentStatus
                          }
                        />
                      </div>

                      <p className="mt-2 font-semibold">
                        Total:{' '}
                        {formatMoney(
                          order.total,
                        )}
                      </p>
                    </div>
                  </div>

                  {canPay ? (
                    <div className="mt-5 border-t pt-5">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={
                            redirectingOrderId !==
                            null
                          }
                          onClick={() =>
                            void handlePayOrder(
                              order,
                            )
                          }
                          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                        >
                          {isRedirecting
                            ? 'A redirecionar…'
                            : 'Pagar agora'}
                        </button>
                      </div>

                      {orderPayError ? (
                        <p
                          role="alert"
                          className="mt-3 text-sm text-red-700 dark:text-red-300"
                        >
                          {orderPayError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )
            },
          )}
        </div>
      )}
    </section>
  )
}
