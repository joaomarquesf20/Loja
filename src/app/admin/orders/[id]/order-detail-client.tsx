'use client'

import {
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

type CheckoutRegion =
  | 'PORTUGAL_MAINLAND'
  | 'MADEIRA'
  | 'AZORES'
  | 'INTERNATIONAL'

type ShippingClass =
  | 'UNASSIGNED'
  | 'SMALL'
  | 'STANDARD'
  | 'BULKY'
  | 'HEAVY'
  | 'QUOTE_REQUIRED'

type OrderEventType =
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_RETRIED'
  | 'STATUS_CHANGED'
  | 'PAYMENT_REFUNDED'
  | 'CANCELLED'

type OrderDetailEvent = {
  id: string
  type: OrderEventType
  fromOrderStatus:
    OrderStatus | null
  toOrderStatus:
    OrderStatus | null
  fromPaymentStatus:
    PaymentStatus | null
  toPaymentStatus:
    PaymentStatus | null
  createdAt: string
}

type AdminOrderAction =
  | 'CONFIRM'
  | 'START_PROCESSING'
  | 'SHIP'
  | 'DELIVER'
  | 'READY_FOR_PICKUP'
  | 'PICK_UP'
  | 'REFUND_PAYMENT'
  | 'CANCEL'

type OrderDetailItem = {
  id: string
  productId: string
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
  shippingClassAtPurchase:
    ShippingClass | null
  shippingCostAtPurchase:
    string | null
}

export type AdminOrderDetailClientData = {
  id: string
  orderNumber: string
  subtotal: string
  shippingCost: string
  tax: string
  total: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod:
    PaymentMethod | null
  installmentCount:
    number | null
  paymentProvider:
    string | null
  paymentReference:
    string | null
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
  shippingRegion:
    CheckoutRegion | null
  shippingClassApplied:
    ShippingClass | null
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
  createdAt: string
  updatedAt: string
  items: OrderDetailItem[]
  events: OrderDetailEvent[]
}

type LifecycleState = {
  id: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentMethod:
    FulfillmentMethod
  paymentProvider:
    string | null
  paymentReference:
    string | null
}

const orderStatusLabels:
  Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmada',
  PROCESSING:
    'Em processamento',
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
  Record<
    AdminOrderAction,
    string
  > = {
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

const checkoutRegionLabels:
  Record<CheckoutRegion, string> = {
  PORTUGAL_MAINLAND:
    'Portugal Continental',
  MADEIRA: 'Madeira',
  AZORES: 'Açores',
  INTERNATIONAL:
    'Internacional',
}

const shippingClassLabels:
  Record<ShippingClass, string> = {
  UNASSIGNED:
    'Por classificar',
  SMALL: 'Pequeno',
  STANDARD: 'Normal',
  BULKY: 'Volumoso',
  HEAVY: 'Pesado',
  QUOTE_REQUIRED:
    'Sob consulta',
}

function formatMoney(
  value: string | null,
) {
  if (value === null) {
    return '—'
  }

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

function getEventTitle(
  event: OrderDetailEvent,
) {
  switch (event.type) {
    case 'PAYMENT_CONFIRMED':
      return 'Pagamento confirmado'

    case 'PAYMENT_FAILED':
      return 'Pagamento falhou'

    case 'PAYMENT_RETRIED':
      return 'Nova tentativa de pagamento'

    case 'STATUS_CHANGED':
      return 'Estado da encomenda atualizado'

    case 'PAYMENT_REFUNDED':
      return 'Pagamento reembolsado'

    case 'CANCELLED':
      return 'Encomenda cancelada'
  }
}

function getEventDescription(
  event: OrderDetailEvent,
) {
  if (
    event.fromOrderStatus &&
    event.toOrderStatus
  ) {
    return `${
      orderStatusLabels[
        event.fromOrderStatus
      ]
    } → ${
      orderStatusLabels[
        event.toOrderStatus
      ]
    }`
  }

  if (
    event.fromPaymentStatus &&
    event.toPaymentStatus
  ) {
    return `${
      paymentStatusLabels[
        event.fromPaymentStatus
      ]
    } → ${
      paymentStatusLabels[
        event.toPaymentStatus
      ]
    }`
  }

  return null
}

function createLocalEvent(
  action: AdminOrderAction,
  current:
    AdminOrderDetailClientData,
  state: LifecycleState,
): OrderDetailEvent | null {
  const createdAt =
    new Date().toISOString()

  if (
    current.paymentStatus !==
    state.paymentStatus
  ) {
    return {
      id: `local-${createdAt}-${action}`,
      type:
        action ===
        'REFUND_PAYMENT'
          ? 'PAYMENT_REFUNDED'
          : 'PAYMENT_CONFIRMED',
      fromOrderStatus: null,
      toOrderStatus: null,
      fromPaymentStatus:
        current.paymentStatus,
      toPaymentStatus:
        state.paymentStatus,
      createdAt,
    }
  }

  if (
    current.status !==
    state.status
  ) {
    return {
      id: `local-${createdAt}-${action}`,
      type:
        action === 'CANCEL'
          ? 'CANCELLED'
          : 'STATUS_CHANGED',
      fromOrderStatus:
        current.status,
      toOrderStatus:
        state.status,
      fromPaymentStatus: null,
      toPaymentStatus: null,
      createdAt,
    }
  }

  return null
}

function getPaymentMethodLabel(
  order: AdminOrderDetailClientData,
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
  order: AdminOrderDetailClientData,
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
  order: AdminOrderDetailClientData,
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
  order: AdminOrderDetailClientData,
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
  order: AdminOrderDetailClientData,
) {
  switch (
    order.paymentStatus
  ) {
    case 'PENDING':
      return 'A aguardar confirmação do pagamento. A encomenda pode ser cancelada para libertar o stock.'

    case 'AUTHORIZED':
      return 'O pagamento autorizado tem de ser anulado pelo fornecedor antes do cancelamento.'

    case 'FAILED':
      return 'O pagamento falhou. O cliente pode tentar novamente na conta ou cancelar a encomenda para repor o stock.'

    case 'PAID':
      if (
        canRefundSimulatedPayment(
          order,
        )
      ) {
        return 'Este pagamento é do fornecedor simulado. Para cancelar, reembolsa primeiro e cancela depois.'
      }

      return null

    case 'REFUNDED':
      return 'O pagamento está reembolsado. A encomenda pode ser cancelada se ainda não tiver sido expedida ou entregue.'

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

function AddressBlock({
  order,
}: {
  order:
    AdminOrderDetailClientData
}) {
  if (
    order.fulfillmentMethod ===
    'PICKUP'
  ) {
    return (
      <div>
        <p className="font-medium">
          Levantamento em loja
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Esta encomenda não tem morada de entrega.
        </p>
      </div>
    )
  }

  return (
    <address className="not-italic">
      <p>
        {order.shippingName}
      </p>

      {order.shippingAddressLine1 && (
        <p>
          {
            order.shippingAddressLine1
          }
        </p>
      )}

      {order.shippingAddressLine2 && (
        <p>
          {
            order.shippingAddressLine2
          }
        </p>
      )}

      <p>
        {[
          order.shippingPostalCode,
          order.shippingCity,
        ]
          .filter(Boolean)
          .join(' ')}
      </p>

      {order.shippingCountry && (
        <p>
          {
            order.shippingCountry
          }
        </p>
      )}

      {order.shippingRegion && (
        <p className="mt-2 text-sm text-gray-600">
          Região comercial:{' '}
          {
            checkoutRegionLabels[
              order.shippingRegion
            ]
          }
        </p>
      )}
    </address>
  )
}

export default function OrderDetailClient({
  initialOrder,
}: {
  initialOrder:
    AdminOrderDetailClientData
}) {
  const [
    order,
    setOrder,
  ] = useState(
    initialOrder,
  )

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  )

  const actions =
    getAvailableActions(
      order,
    )

  async function handleAction(
    action: AdminOrderAction,
  ) {
    if (submitting) {
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
      setSubmitting(true)
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
        (await response.json()) as
          LifecycleState

      setOrder(
        (current) => {
          const event =
            createLocalEvent(
              action,
              current,
              state,
            )

          return {
            ...current,
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
            updatedAt:
              event?.createdAt ??
              current.updatedAt,
            events: event
              ? [
                  ...current.events,
                  event,
                ]
              : current.events,
          }
        },
      )
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Não foi possível atualizar a encomenda',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article className="space-y-6">
      <section className="rounded-lg border p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {
                order.orderNumber
              }
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Criada em{' '}
              {formatDate(
                order.createdAt,
              )}
            </p>

            <p className="text-sm text-gray-600">
              Última atualização:{' '}
              {formatDate(
                order.updatedAt,
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

        {getPaymentNotice(
          order,
        ) && (
          <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
            {getPaymentNotice(
              order,
            )}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-800"
          >
            {error}
          </div>
        )}

        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map(
              (action) => (
                <button
                  key={action}
                  type="button"
                  disabled={
                    submitting
                  }
                  onClick={() =>
                    void handleAction(
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
                  {submitting
                    ? 'A atualizar...'
                    : actionLabels[
                        action
                      ]}
                </button>
              ),
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border p-5">
        <h3 className="text-lg font-semibold">
          Histórico da encomenda
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          Registo das alterações relevantes guardadas pelo servidor.
        </p>

        <ol className="mt-4 space-y-4">
          <li className="border-l-2 border-gray-200 pl-4">
            <p className="font-medium">
              Encomenda criada
            </p>
            <p className="text-sm text-gray-600">
              {formatDate(
                order.createdAt,
              )}
            </p>
          </li>

          {order.events.map(
            (event) => {
              const description =
                getEventDescription(
                  event,
                )

              return (
                <li
                  key={event.id}
                  className="border-l-2 border-gray-200 pl-4"
                >
                  <p className="font-medium">
                    {getEventTitle(
                      event,
                    )}
                  </p>

                  {description && (
                    <p className="text-sm text-gray-700">
                      {description}
                    </p>
                  )}

                  <p className="text-sm text-gray-600">
                    {formatDate(
                      event.createdAt,
                    )}
                  </p>
                </li>
              )
            },
          )}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-5">
          <h3 className="text-lg font-semibold">
            Cliente e contacto
          </h3>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium">
                Nome
              </dt>
              <dd>
                {
                  order.shippingName
                }
              </dd>
            </div>

            <div>
              <dt className="font-medium">
                Email
              </dt>
              <dd className="break-all">
                {
                  order.shippingEmail
                }
              </dd>
            </div>

            <div>
              <dt className="font-medium">
                Telefone
              </dt>
              <dd>
                {
                  order.shippingPhone
                }
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border p-5">
          <h3 className="text-lg font-semibold">
            Destino
          </h3>

          <div className="mt-4 text-sm">
            <AddressBlock
              order={order}
            />
          </div>
        </section>
      </div>

      <section className="rounded-lg border p-5">
        <h3 className="text-lg font-semibold">
          Artigos da encomenda
        </h3>

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
                  Preço unitário
                </th>
                <th className="py-2 pr-4">
                  Quantidade
                </th>
                <th className="py-2 pr-4">
                  Transporte
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
                    key={item.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium">
                        {
                          item.productNameAtPurchase
                        }
                      </p>
                      <p className="text-xs text-gray-500">
                        ID:{' '}
                        {
                          item.productId
                        }
                      </p>
                      {!!item.variantOptionsAtPurchase?.length && (
                        <p className="text-xs text-gray-500">
                          Opções:{' '}
                          {item.variantOptionsAtPurchase
                            .map((option) =>
                              `${option.name}: ${option.value}`,
                            )
                            .join(' · ')}
                        </p>
                      )}
                    </td>

                    <td className="py-3 pr-4">
                      {
                        item.productSkuAtPurchase
                      }
                    </td>

                    <td className="py-3 pr-4">
                      {formatMoney(
                        item.priceAtPurchase,
                      )}
                    </td>

                    <td className="py-3 pr-4">
                      {
                        item.quantity
                      }
                    </td>

                    <td className="py-3 pr-4">
                      <p>
                        {item.shippingClassAtPurchase
                          ? shippingClassLabels[
                              item.shippingClassAtPurchase
                            ]
                          : 'Não registado'}
                      </p>

                      {item.shippingCostAtPurchase !==
                        null && (
                        <p className="text-xs text-gray-500">
                          Tarifa:{' '}
                          {formatMoney(
                            item.shippingCostAtPurchase,
                          )}
                        </p>
                      )}
                    </td>

                    <td className="py-3">
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
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-5">
          <h3 className="text-lg font-semibold">
            Pagamento
          </h3>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium">
                Método
              </dt>
              <dd>
                {getPaymentMethodLabel(
                  order,
                )}
              </dd>
            </div>

            <div>
              <dt className="font-medium">
                Estado
              </dt>
              <dd>
                {
                  paymentStatusLabels[
                    order.paymentStatus
                  ]
                }
              </dd>
            </div>

            <div>
              <dt className="font-medium">
                Fornecedor
              </dt>
              <dd>
                {order.paymentProvider ??
                  'Não registado'}
              </dd>
            </div>

            <div>
              <dt className="font-medium">
                Referência
              </dt>
              <dd className="break-all">
                {order.paymentReference ??
                  'Não registada'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border p-5">
          <h3 className="text-lg font-semibold">
            Totais
          </h3>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>
                Produtos
              </dt>
              <dd>
                {formatMoney(
                  order.subtotal,
                )}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt>
                Portes
              </dt>
              <dd>
                {formatMoney(
                  order.shippingCost,
                )}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt>
                IVA incluído
              </dt>
              <dd>
                {formatMoney(
                  order.tax,
                )}
              </dd>
            </div>

            <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
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

          <div className="mt-4 border-t pt-4 text-xs text-gray-600">
            {order.taxRatePercent !==
              null && (
              <p>
                Taxa IVA:{' '}
                {
                  order.taxRatePercent
                }
                %
              </p>
            )}

            {order.shippingClassApplied && (
              <p>
                Classe de transporte aplicada:{' '}
                {
                  shippingClassLabels[
                    order.shippingClassApplied
                  ]
                }
              </p>
            )}

            {order.freeShippingThreshold !==
              null && (
              <p>
                Limite de portes grátis à data:{' '}
                {formatMoney(
                  order.freeShippingThreshold,
                )}
              </p>
            )}

            {order.freeShippingApplied !==
              null && (
              <p>
                Portes grátis aplicados:{' '}
                {order.freeShippingApplied
                  ? 'Sim'
                  : 'Não'}
              </p>
            )}

            {order.pricesIncludeTax !==
              null && (
              <p>
                Preços incluíam IVA:{' '}
                {order.pricesIncludeTax
                  ? 'Sim'
                  : 'Não'}
              </p>
            )}
          </div>
        </section>
      </div>
    </article>
  )
}
