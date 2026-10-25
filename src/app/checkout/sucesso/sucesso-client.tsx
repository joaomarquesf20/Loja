'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { clearGuestCart } from '@/lib/guest-cart'

/**
 * Aterragem de sucesso do Stripe Checkout: valida os parâmetros
 * do retorno (order + session_id), carrega o detalhe da encomenda
 * na API e limpa o carrinho local — os itens do carrinho do
 * servidor já foram apagados quando a encomenda foi criada.
 */

type ConfirmationVariantOption = {
  code: string
  name: string
  value: string
}

type ConfirmationOrderItem = {
  id: string
  productNameAtPurchase: string
  productSkuAtPurchase: string
  priceAtPurchase: string
  quantity: number
  subtotalAtPurchase: string
  variantOptionsAtPurchase: ConfirmationVariantOption[]
}

type ConfirmationOrder = {
  orderNumber: string
  subtotal: string
  shippingCost: string
  tax: string
  total: string
  status: string
  paymentStatus: string
  fulfillmentMethod: 'DELIVERY' | 'PICKUP'
  shippingMethod: string | null
  createdAt: string
  items: ConfirmationOrderItem[]
}

type LoadStatus =
  | 'loading'
  | 'ready'
  | 'invalid'
  | 'auth'
  | 'error'

const ORDER_NUMBER_PATTERN =
  /^[A-Za-z0-9-]+$/

type ParsedSuccessParams = {
  orderNumber: string
  sessionId: string
}

function parseSuccessParams(
  search: string,
): ParsedSuccessParams | null {
  const params =
    new URLSearchParams(search)

  const orderNumber =
    params.get('order')?.trim() ?? ''

  const sessionId =
    params.get('session_id')?.trim() ?? ''

  if (
    !orderNumber ||
    orderNumber.length > 64 ||
    !ORDER_NUMBER_PATTERN.test(
      orderNumber,
    )
  ) {
    return null
  }

  if (
    !sessionId ||
    !sessionId.startsWith('cs_')
  ) {
    return null
  }

  return {
    orderNumber,
    sessionId,
  }
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

function isVariantOption(
  value: unknown,
): value is ConfirmationVariantOption {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.value === 'string'
  )
}

function isConfirmationItem(
  value: unknown,
): value is ConfirmationOrderItem {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.productNameAtPurchase ===
      'string' &&
    typeof value.productSkuAtPurchase ===
      'string' &&
    typeof value.priceAtPurchase ===
      'string' &&
    typeof value.quantity === 'number' &&
    Number.isSafeInteger(
      value.quantity,
    ) &&
    value.quantity > 0 &&
    typeof value.subtotalAtPurchase ===
      'string' &&
    Array.isArray(
      value.variantOptionsAtPurchase,
    ) &&
    value.variantOptionsAtPurchase.every(
      isVariantOption,
    )
  )
}

function isConfirmationOrder(
  value: unknown,
): value is ConfirmationOrder {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.orderNumber ===
      'string' &&
    value.orderNumber.length > 0 &&
    typeof value.subtotal === 'string' &&
    typeof value.shippingCost ===
      'string' &&
    typeof value.tax === 'string' &&
    typeof value.total === 'string' &&
    typeof value.status === 'string' &&
    typeof value.paymentStatus ===
      'string' &&
    (value.fulfillmentMethod ===
      'DELIVERY' ||
      value.fulfillmentMethod ===
        'PICKUP') &&
    (value.shippingMethod === null ||
      typeof value.shippingMethod ===
        'string') &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    value.items.every(
      isConfirmationItem,
    )
  )
}

async function getResponseMessage(
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

function formatMoney(
  value: string,
) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
    },
  ).format(parsed)
}

function paymentStatusLabel(
  paymentStatus: string,
) {
  if (paymentStatus === 'PAID') {
    return 'Pagamento confirmado'
  }

  if (paymentStatus === 'PENDING') {
    return 'A aguardar confirmação do Stripe'
  }

  return paymentStatus
}

export function CheckoutSuccessClient() {
  const [status, setStatus] =
    useState<LoadStatus>('loading')

  const [order, setOrder] =
    useState<ConfirmationOrder | null>(
      null,
    )

  const [error, setError] =
    useState<string | null>(null)

  const [loginHref, setLoginHref] =
    useState(
      '/login?callbackUrl=%2Fcheckout%2Fsucesso',
    )

  useEffect(() => {
    let cancelled = false

    async function loadConfirmation() {
      const parsed =
        parseSuccessParams(
          window.location.search,
        )

      if (!parsed) {
        if (!cancelled) {
          setStatus('invalid')
        }

        return
      }

      if (!cancelled) {
        setLoginHref(
          `/login?callbackUrl=${encodeURIComponent(
            `/checkout/sucesso?order=${parsed.orderNumber}&session_id=${parsed.sessionId}`,
          )}`,
        )
      }

      try {
        const response =
          await fetch(
            `/api/orders/${encodeURIComponent(parsed.orderNumber)}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          )

        if (
          response.status === 401
        ) {
          if (!cancelled) {
            setStatus('auth')
          }

          return
        }

        if (!response.ok) {
          throw new Error(
            await getResponseMessage(
              response,
              'Não foi possível carregar a confirmação',
            ),
          )
        }

        const body: unknown =
          await response.json()

        if (
          !isRecord(body) ||
          !isConfirmationOrder(
            body.order,
          )
        ) {
          throw new Error(
            'Resposta inválida do servidor',
          )
        }

        if (cancelled) {
          return
        }

        // A compra foi aceite: limpa qualquer resíduo local do
        // carrinho. O carrinho do servidor já foi esvaziado
        // quando a encomenda foi criada.
        clearGuestCart()

        setOrder(body.order)
        setStatus('ready')
      } catch (caughtError) {
        if (cancelled) {
          return
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Não foi possível carregar a confirmação',
        )

        setStatus('error')
      }
    }

    void loadConfirmation()

    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') {
    return (
      <div
        role="status"
        className="rounded-xl border border-gray-200 bg-white p-6"
      >
        <p className="text-sm text-gray-600">
          A carregar a confirmação da
          compra...
        </p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-6"
      >
        <h2 className="font-semibold text-amber-950">
          Confirmação inválida
        </h2>

        <p className="mt-2 text-sm text-amber-900">
          O link de confirmação não tem os
          parâmetros esperados do pagamento.
          Consulta o estado das tuas encomendas
          na conta.
        </p>

        <Link
          href="/conta"
          className="mt-4 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Ver as minhas encomendas
        </Link>
      </div>
    )
  }

  if (status === 'auth') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-6"
      >
        <h2 className="font-semibold text-amber-950">
          Sessão expirada
        </h2>

        <p className="mt-2 text-sm text-amber-900">
          Inicia sessão para veres a
          confirmação da encomenda.
        </p>

        <Link
          href={loginHref}
          className="mt-4 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Iniciar sessão
        </Link>
      </div>
    )
  }

  if (status === 'error' || !order) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6"
      >
        <h2 className="font-semibold text-red-900">
          Não foi possível carregar a
          confirmação
        </h2>

        <p className="mt-2 text-sm text-red-800">
          {error ??
            'Tenta novamente mais tarde ou consulta a tua conta.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/conta"
            className="inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Ver as minhas encomendas
          </Link>

          <Link
            href="/carrinho"
            className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-100"
          >
            Voltar ao carrinho
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-green-200 bg-green-50 p-6"
    >
      <h2 className="text-xl font-semibold text-green-950">
        Compra aceite
      </h2>

      <p className="mt-2 text-sm text-green-900">
        Número da encomenda:{' '}
        <strong>
          {order.orderNumber}
        </strong>
      </p>

      <p className="mt-2 text-sm text-green-900">
        Pagamento:{' '}
        <strong>
          {paymentStatusLabel(
            order.paymentStatus,
          )}
        </strong>
      </p>

      {order.paymentStatus ===
      'PENDING' ? (
        <p className="mt-2 text-xs text-green-800">
          O Stripe pode levar alguns segundos
          a confirmar o pagamento. Atualiza
          esta página para veres o estado
          final.
        </p>
      ) : null}

      <ul className="mt-5 divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {order.items.map(
          (item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-4 p-3 text-sm"
            >
              <div>
                <p className="font-medium text-gray-950">
                  {item.quantity}×{' '}
                  {
                    item.productNameAtPurchase
                  }
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {
                    item.productSkuAtPurchase
                  }
                </p>

                {item.variantOptionsAtPurchase.length >
                0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {item.variantOptionsAtPurchase
                      .map(
                        (option) =>
                          `${option.name}: ${option.value}`,
                      )
                      .join(' · ')}
                  </p>
                ) : null}
              </div>

              <span className="font-medium text-gray-950">
                {formatMoney(
                  item.subtotalAtPurchase,
                )}
              </span>
            </li>
          ),
        )}
      </ul>

      <div className="mt-5 space-y-2 border-t border-gray-200 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            Subtotal
          </span>

          <span className="font-medium text-gray-950">
            {formatMoney(
              order.subtotal,
            )}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            Portes
          </span>

          <span className="font-medium text-gray-950">
            {formatMoney(
              order.shippingCost,
            )}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            IVA incluído
          </span>

          <span className="font-medium text-gray-950">
            {formatMoney(order.tax)}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <strong className="text-gray-950">
            Total
          </strong>

          <strong className="text-lg text-gray-950">
            {formatMoney(order.total)}
          </strong>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Continuar a comprar
        </Link>

        <Link
          href="/conta"
          className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-100"
        >
          Ver as minhas encomendas
        </Link>
      </div>
    </div>
  )
}
