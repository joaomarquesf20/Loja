'use client'

import Link from 'next/link'
import {
  type FormEvent,
  useEffect,
  useState,
} from 'react'

type Address = {
  id: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  postalCode: string
  country: string
}

type CheckoutPreview = {
  subtotal: number
  shippingCost: number
  tax: number
  total: number
}

type CheckoutOrder = {
  id: string
  orderNumber: string
  subtotal: number
  shippingCost: number
  tax: number
  total: number
  status: string
  paymentStatus: string
}

type LoadMode =
  | 'loading'
  | 'ready'
  | 'unauthenticated'
  | 'error'

type PendingAction =
  | 'preview'
  | 'checkout'
  | null

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isAddress(
  value: unknown,
): value is Address {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.addressLine1 ===
      'string' &&
    (
      value.addressLine2 === null ||
      typeof value.addressLine2 ===
        'string'
    ) &&
    typeof value.city === 'string' &&
    typeof value.postalCode ===
      'string' &&
    typeof value.country === 'string'
  )
}

function isMoneyValue(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  )
}

function isCheckoutPreview(
  value: unknown,
): value is CheckoutPreview {
  if (!isRecord(value)) {
    return false
  }

  return (
    isMoneyValue(value.subtotal) &&
    isMoneyValue(
      value.shippingCost,
    ) &&
    isMoneyValue(value.tax) &&
    isMoneyValue(value.total)
  )
}

function isCheckoutOrder(
  value: unknown,
): value is CheckoutOrder {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.orderNumber ===
      'string' &&
    isMoneyValue(value.subtotal) &&
    isMoneyValue(
      value.shippingCost,
    ) &&
    isMoneyValue(value.tax) &&
    isMoneyValue(value.total) &&
    typeof value.status === 'string' &&
    typeof value.paymentStatus ===
      'string'
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

  return 'Não foi possível concluir o checkout'
}

async function parseAddresses(
  response: Response,
): Promise<Address[]> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !Array.isArray(
      body.addresses,
    ) ||
    !body.addresses.every(
      isAddress,
    )
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return body.addresses
}

async function parsePreview(
  response: Response,
): Promise<CheckoutPreview> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !isCheckoutPreview(
      body.preview,
    )
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return body.preview
}

async function parseOrder(
  response: Response,
): Promise<CheckoutOrder> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !isCheckoutOrder(
      body.order,
    )
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return body.order
}

function formatPrice(
  value: number,
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
    },
  ).format(value)
}

function createShipping(
  address: Address,
  phone: string,
) {
  return {
    name: address.name,
    phone,
    addressLine1:
      address.addressLine1,
    addressLine2:
      address.addressLine2,
    city: address.city,
    postalCode:
      address.postalCode,
    country: address.country,
    region:
      'PORTUGAL_MAINLAND',
  }
}

export function CheckoutClient() {
  const [mode, setMode] =
    useState<LoadMode>('loading')

  const [addresses, setAddresses] =
    useState<Address[]>([])

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] = useState('')

  const [phone, setPhone] =
    useState('')

  const [preview, setPreview] =
    useState<CheckoutPreview | null>(
      null,
    )

  const [order, setOrder] =
    useState<CheckoutOrder | null>(
      null,
    )

  const [
    pendingAction,
    setPendingAction,
  ] = useState<PendingAction>(
    null,
  )

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAddresses() {
      try {
        const response =
          await fetch(
            '/api/addresses',
            {
              method: 'GET',
              cache: 'no-store',
            },
          )

        if (
          response.status === 401
        ) {
          if (!cancelled) {
            setMode(
              'unauthenticated',
            )
          }

          return
        }

        if (!response.ok) {
          throw new Error(
            await getResponseError(
              response,
            ),
          )
        }

        const loadedAddresses =
          await parseAddresses(
            response,
          )

        if (!cancelled) {
          setAddresses(
            loadedAddresses,
          )

          setSelectedAddressId(
            loadedAddresses[0]?.id ??
              '',
          )

          setMode('ready')
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : 'Não foi possível carregar as moradas',
          )

          setMode('error')
        }
      }
    }

    void loadAddresses()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedAddress =
    addresses.find(
      (address) =>
        address.id ===
        selectedAddressId,
    ) ?? null

  function invalidatePreview() {
    setPreview(null)
    setError(null)
  }

  function validateShipping() {
    if (!selectedAddress) {
      setError(
        'Seleciona uma morada de entrega.',
      )

      return null
    }

    if (!phone.trim()) {
      setError(
        'Indica o telefone de contacto.',
      )

      return null
    }

    return createShipping(
      selectedAddress,
      phone,
    )
  }

  async function handlePreview(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (pendingAction) {
      return
    }

    const shipping =
      validateShipping()

    if (!shipping) {
      return
    }

    setPendingAction('preview')
    setError(null)

    try {
      const response =
        await fetch(
          '/api/checkout/preview',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              shipping,
            }),
          },
        )

      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
          ),
        )
      }

      const nextPreview =
        await parsePreview(
          response,
        )

      setPreview(nextPreview)
    } catch (caughtError) {
      setPreview(null)

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível calcular o checkout',
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function handleCheckout() {
    if (
      pendingAction ||
      !preview
    ) {
      return
    }

    const shipping =
      validateShipping()

    if (!shipping) {
      return
    }

    setPendingAction('checkout')
    setError(null)

    try {
      const response =
        await fetch(
          '/api/checkout',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              shipping,
            }),
          },
        )

      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
          ),
        )
      }

      const createdOrder =
        await parseOrder(response)

      setOrder(createdOrder)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível criar a encomenda',
      )
    } finally {
      setPendingAction(null)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-600">
          A carregar dados de
          entrega...
        </p>
      </div>
    )
  }

  if (
    mode ===
    'unauthenticated'
  ) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-950">
          Inicia sessão para
          finalizar a compra
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          O checkout está disponível
          para utilizadores
          autenticados.
        </p>

        <Link
          href="/login"
          className="mt-5 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Iniciar sessão
        </Link>
      </div>
    )
  }

  if (mode === 'error') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6"
      >
        <h2 className="font-semibold text-red-900">
          Não foi possível carregar
          o checkout
        </h2>

        <p className="mt-2 text-sm text-red-800">
          {error}
        </p>
      </div>
    )
  }

  if (order) {
    return (
      <div
        role="status"
        className="rounded-xl border border-green-200 bg-green-50 p-6"
      >
        <h2 className="text-xl font-semibold text-green-950">
          Encomenda criada
        </h2>

        <p className="mt-2 text-sm text-green-900">
          Número da encomenda:{' '}
          <strong>
            {order.orderNumber}
          </strong>
        </p>

        <p className="mt-2 text-sm text-green-900">
          Total:{' '}
          <strong>
            {formatPrice(
              order.total,
            )}
          </strong>
        </p>

        <Link
          href="/conta"
          className="mt-5 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Ver a minha conta
        </Link>
      </div>
    )
  }

  if (
    addresses.length === 0
  ) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-950">
          Não tens moradas
          guardadas
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          Adiciona primeiro uma
          morada na tua conta para
          poderes continuar.
        </p>

        <Link
          href="/conta"
          className="mt-5 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Gerir moradas
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={
        handlePreview
      }
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-950">
          Dados de entrega
        </h2>

        <div className="mt-5">
          <label
            htmlFor="checkout-address"
            className="block text-sm font-medium text-gray-900"
          >
            Morada
          </label>

          <select
            id="checkout-address"
            value={
              selectedAddressId
            }
            disabled={
              pendingAction !== null
            }
            onChange={(event) => {
              setSelectedAddressId(
                event.target.value,
              )

              invalidatePreview()
            }}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
          >
            {addresses.map(
              (address) => (
                <option
                  key={
                    address.id
                  }
                  value={
                    address.id
                  }
                >
                  {address.name} —{' '}
                  {
                    address.addressLine1
                  }, {address.city}
                </option>
              ),
            )}
          </select>
        </div>

        {selectedAddress ? (
          <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-950">
              {
                selectedAddress.name
              }
            </p>

            <p className="mt-1">
              {
                selectedAddress.addressLine1
              }
            </p>

            {selectedAddress.addressLine2 ? (
              <p>
                {
                  selectedAddress.addressLine2
                }
              </p>
            ) : null}

            <p>
              {
                selectedAddress.postalCode
              }{' '}
              {
                selectedAddress.city
              }
            </p>

            <p>
              {
                selectedAddress.country
              }
            </p>
          </div>
        ) : null}

        <div className="mt-5">
          <label
            htmlFor="checkout-phone"
            className="block text-sm font-medium text-gray-900"
          >
            Telefone
          </label>

          <input
            id="checkout-phone"
            type="tel"
            value={phone}
            disabled={
              pendingAction !== null
            }
            onChange={(event) => {
              setPhone(
                event.target.value,
              )

              invalidatePreview()
            }}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-950"
            placeholder="910000000"
          />
        </div>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nesta fase, o checkout
          está disponível apenas
          para entregas em Portugal
          Continental.
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}
      </section>

      <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-950">
          Resumo
        </h2>

        {preview ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Subtotal
              </span>

              <span className="font-medium text-gray-950">
                {formatPrice(
                  preview.subtotal,
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Portes
              </span>

              <span className="font-medium text-gray-950">
                {formatPrice(
                  preview.shippingCost,
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                IVA incluído
              </span>

              <span className="font-medium text-gray-950">
                {formatPrice(
                  preview.tax,
                )}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 pt-3">
              <strong className="text-gray-950">
                Total
              </strong>

              <strong className="text-lg text-gray-950">
                {formatPrice(
                  preview.total,
                )}
              </strong>
            </div>

            <button
              type="button"
              disabled={
                pendingAction !== null
              }
              onClick={() =>
                void handleCheckout()
              }
              className="mt-3 w-full rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction ===
              'checkout'
                ? 'A criar encomenda...'
                : 'Criar encomenda'}
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-gray-600">
              Calcula primeiro o
              total real da
              encomenda.
            </p>

            <button
              type="submit"
              disabled={
                pendingAction !== null
              }
              className="mt-5 w-full rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction ===
              'preview'
                ? 'A calcular...'
                : 'Calcular total'}
            </button>
          </>
        )}
      </aside>
    </form>
  )
}