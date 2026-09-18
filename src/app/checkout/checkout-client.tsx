'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

type FulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

type PaymentMethod =
  | 'CARD'
  | 'INSTALLMENTS'

type CheckoutPreview = {
  subtotal: number
  shippingCost: number
  tax: number
  total: number
  fingerprint: string
}

type CheckoutOrder = {
  id: string
  orderNumber: string
  fulfillmentMethod: FulfillmentMethod
  paymentMethod?: PaymentMethod
  installmentCount?: number | null
  subtotal: number
  shippingCost: number
  tax: number
  total: number
  status: string
  paymentStatus: string
}

type PaymentInitiation = {
  orderId: string
  paymentStatus: 'PENDING'
  paymentMethod: PaymentMethod
  installmentCount: number | null
  paymentProvider: 'PFA_SIMULATED'
  paymentReference: string
  amount: string
}

type LoadMode =
  | 'loading'
  | 'ready'
  | 'unauthenticated'
  | 'error'

type PendingAction =
  | 'preview'
  | 'checkout'
  | 'payment'
  | null

type CheckoutFulfillmentRequestInput =
  | {
      fulfillmentMethod: 'DELIVERY'
      shipping: {
        name: string
        phone: string
        addressLine1: string
        addressLine2: string | null
        city: string
        postalCode: string
        country: string
        region: 'PORTUGAL_MAINLAND'
      }
    }
  | {
      fulfillmentMethod: 'PICKUP'
      shipping: {
        name: string
        phone: string
      }
    }

type CheckoutPaymentRequestInput =
  | {
      paymentMethod: 'CARD'
      installmentCount: null
    }
  | {
      paymentMethod: 'INSTALLMENTS'
      installmentCount: number
    }

type CheckoutRequestInput =
  CheckoutFulfillmentRequestInput &
    CheckoutPaymentRequestInput

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
    isMoneyValue(value.total) &&
    typeof value.fingerprint === 'string' &&
    value.fingerprint.length === 64 &&
    /^[0-9a-f]{64}$/.test(value.fingerprint)
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

function isPaymentMethod(
  value: unknown,
): value is PaymentMethod {
  return (
    value === 'CARD' ||
    value === 'INSTALLMENTS'
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
    isFulfillmentMethod(
      value.fulfillmentMethod,
    ) &&
    (
      value.paymentMethod === undefined ||
      isPaymentMethod(
        value.paymentMethod,
      )
    ) &&
    (
      value.installmentCount === undefined ||
      value.installmentCount === null ||
      (
        typeof value.installmentCount ===
          'number' &&
        Number.isSafeInteger(
          value.installmentCount,
        ) &&
        value.installmentCount >= 2 && value.installmentCount <= 12
      )
    ) &&
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
  fallback =
    'Não foi possível concluir o checkout',
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

function isPaymentInitiation(
  value: unknown,
): value is PaymentInitiation {
  if (!isRecord(value)) {
    return false
  }

  const validInstallments =
    value.paymentMethod === 'CARD'
      ? value.installmentCount === null
      : (
          value.paymentMethod ===
            'INSTALLMENTS' &&
          typeof value.installmentCount ===
            'number' &&
          Number.isSafeInteger(
            value.installmentCount,
          ) &&
          value.installmentCount >= 2 && value.installmentCount <= 12
        )

  return (
    typeof value.orderId === 'string' &&
    value.orderId.length > 0 &&
    value.paymentStatus === 'PENDING' &&
    isPaymentMethod(
      value.paymentMethod,
    ) &&
    validInstallments &&
    value.paymentProvider ===
      'PFA_SIMULATED' &&
    typeof value.paymentReference ===
      'string' &&
    value.paymentReference.startsWith(
      'pfa_sim_',
    ) &&
    typeof value.amount === 'string' &&
    value.amount.length > 0
  )
}

async function parsePaymentInitiation(
  response: Response,
): Promise<PaymentInitiation> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !isPaymentInitiation(
      body.payment,
    )
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return body.payment
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

function createDeliveryShipping(
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
      'PORTUGAL_MAINLAND' as const,
  }
}

export function CheckoutClient() {
  const { replace } = useRouter()

  const [mode, setMode] =
    useState<LoadMode>('loading')

  const [addresses, setAddresses] =
    useState<Address[]>([])

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] = useState('')

  const [
    fulfillmentMethod,
    setFulfillmentMethod,
  ] = useState<FulfillmentMethod>(
    'DELIVERY',
  )

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>(
    'CARD',
  )

  const [
    installmentCount,
    setInstallmentCount,
  ] = useState('2')

  const [pickupName, setPickupName] =
    useState('')

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

  const [payment, setPayment] =
    useState<PaymentInitiation | null>(
      null,
    )

  const [
    paymentError,
    setPaymentError,
  ] = useState<string | null>(
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

            replace(
              '/login?callbackUrl=%2Fcheckout',
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

          setPickupName(
            loadedAddresses[0]?.name ??
              '',
          )

          if (
            loadedAddresses.length ===
            0
          ) {
            setFulfillmentMethod(
              'PICKUP',
            )
          }

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
  }, [replace])

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

  function changeFulfillmentMethod(
    nextMethod: FulfillmentMethod,
  ) {
    if (
      nextMethod === 'DELIVERY' &&
      addresses.length === 0
    ) {
      return
    }

    setFulfillmentMethod(
      nextMethod,
    )

    if (
      nextMethod === 'PICKUP' &&
      !pickupName.trim() &&
      selectedAddress
    ) {
      setPickupName(
        selectedAddress.name,
      )
    }

    invalidatePreview()
  }

  function changePaymentMethod(
    nextMethod: PaymentMethod,
  ) {
    setPaymentMethod(nextMethod)
    invalidatePreview()
  }

  function validateCheckoutInput():
    | CheckoutRequestInput
    | null {
    const normalizedPhone =
      phone.trim()

    if (!normalizedPhone) {
      setError(
        'Indica o telefone de contacto.',
      )

      return null
    }

    let paymentInput:
      CheckoutPaymentRequestInput

    if (paymentMethod === 'CARD') {
      paymentInput = {
        paymentMethod: 'CARD',
        installmentCount: null,
      }
    } else {
      const trimmedInstallmentCount =
        installmentCount.trim()
      const numericInstallmentCount =
        Number(trimmedInstallmentCount)

      if (
        !/^\d+$/.test(
          trimmedInstallmentCount,
        ) ||
        !Number.isSafeInteger(
          numericInstallmentCount,
        ) ||
        numericInstallmentCount < 2 ||
        numericInstallmentCount >
          12
      ) {
        setError(
          'Indica um número de prestações válido (mínimo 2).',
        )

        return null
      }

      paymentInput = {
        paymentMethod: 'INSTALLMENTS',
        installmentCount:
          numericInstallmentCount,
      }
    }

    if (
      fulfillmentMethod ===
      'PICKUP'
    ) {
      const normalizedName =
        pickupName.trim()

      if (!normalizedName) {
        setError(
          'Indica o nome para o levantamento.',
        )

        return null
      }

      return {
        ...paymentInput,
        fulfillmentMethod:
          'PICKUP',
        shipping: {
          name: normalizedName,
          phone: normalizedPhone,
        },
      }
    }

    if (!selectedAddress) {
      setError(
        'Seleciona uma morada de entrega.',
      )

      return null
    }

    return {
      ...paymentInput,
      fulfillmentMethod:
        'DELIVERY',
      shipping:
        createDeliveryShipping(
          selectedAddress,
          normalizedPhone,
        ),
    }
  }

  async function handlePreview(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (pendingAction) {
      return
    }

    const checkoutInput =
      validateCheckoutInput()

    if (!checkoutInput) {
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
            body: JSON.stringify(
              checkoutInput,
            ),
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

  async function requestPaymentInitiation(
    orderId: string,
  ) {
    const response =
      await fetch(
        '/api/payments/initiate',
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
          'Não foi possível iniciar o pagamento',
        ),
      )
    }

    const initiatedPayment =
      await parsePaymentInitiation(
        response,
      )

    if (
      initiatedPayment.orderId !==
      orderId
    ) {
      throw new Error(
        'Resposta inválida do servidor',
      )
    }

    return initiatedPayment
  }

  async function handleCheckout() {
    if (
      pendingAction ||
      !isCheckoutPreview(preview)
    ) {
      return
    }

    const checkoutInput =
      validateCheckoutInput()

    if (!checkoutInput) {
      return
    }

    setPendingAction('checkout')
    setError(null)
    setPaymentError(null)

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
              ...checkoutInput,
              expectedFingerprint:
                preview.fingerprint,
            }),
          },
        )

      if (!response.ok) {
        // 409 significa que os termos aceites já não são atuais.
        if (response.status === 409) {
          setPreview(null)
        }

        throw new Error(
          await getResponseError(
            response,
          ),
        )
      }

      const createdOrder =
        await parseOrder(response)

      setOrder(createdOrder)
      setPayment(null)
      setPendingAction('payment')

      try {
        const initiatedPayment =
          await requestPaymentInitiation(
            createdOrder.id,
          )

        setPayment(
          initiatedPayment,
        )
      } catch (caughtPaymentError) {
        setPaymentError(
          caughtPaymentError instanceof
            Error
            ? caughtPaymentError.message
            : 'Não foi possível iniciar o pagamento',
        )
      }
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

  async function handleRetryPayment() {
    if (
      !order ||
      pendingAction
    ) {
      return
    }

    setPendingAction('payment')
    setPaymentError(null)

    try {
      const initiatedPayment =
        await requestPaymentInitiation(
          order.id,
        )

      setPayment(
        initiatedPayment,
      )
    } catch (caughtError) {
      setPaymentError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível iniciar o pagamento',
      )
    } finally {
      setPendingAction(null)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-600">
          A carregar dados do
          checkout...
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
          href="/login?callbackUrl=%2Fcheckout"
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
    const completedPaymentMethod =
      order.paymentMethod ??
      paymentMethod
    const completedInstallmentCount =
      order.installmentCount ??
      (completedPaymentMethod ===
      'INSTALLMENTS'
        ? Number(installmentCount)
        : null)

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
          Método:{' '}
          <strong>
            {order.fulfillmentMethod ===
            'PICKUP'
              ? 'Levantamento em loja'
              : 'Entrega ao domicílio'}
          </strong>
        </p>

        <p className="mt-2 text-sm text-green-900">
          Pagamento:{' '}
          <strong>
            {completedPaymentMethod ===
            'CARD'
              ? 'Cartão'
              : `Pagamento em ${completedInstallmentCount} prestações`}
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

        {pendingAction ===
          'payment' &&
        !payment ? (
          <p className="mt-3 text-sm text-green-900">
            A iniciar pagamento...
          </p>
        ) : null}

        {payment ? (
          <div className="mt-4 rounded-lg border border-green-300 bg-white/70 p-4 text-sm text-green-950">
            <p className="font-semibold">
              Pagamento iniciado em modo
              de demonstração.
            </p>

            <p className="mt-2">
              Referência:{' '}
              <code className="break-all font-mono">
                {payment.paymentReference}
              </code>
            </p>

            <p className="mt-1 text-xs text-green-800">
              Fornecedor simulado:
              {' '}
              {payment.paymentProvider}
            </p>
          </div>
        ) : null}

        {paymentError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            <p className="font-semibold">
              A encomenda foi criada,
              mas o pagamento ainda não
              foi iniciado.
            </p>

            <p className="mt-2">
              {paymentError}
            </p>

            <button
              type="button"
              disabled={
                pendingAction !== null
              }
              onClick={() =>
                void handleRetryPayment()
              }
              className="mt-3 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction ===
              'payment'
                ? 'A iniciar pagamento...'
                : 'Tentar iniciar pagamento novamente'}
            </button>
          </div>
        ) : null}

        {order.paymentStatus ===
        'PENDING' ? (
          <p className="mt-3 text-sm text-green-900">
            Pagamento pendente de
            confirmação.
          </p>
        ) : null}

        {order.fulfillmentMethod ===
        'PICKUP' ? (
          <p className="mt-2 text-sm text-green-900">
            O levantamento só ficará
            disponível depois de o
            pagamento ser confirmado.
          </p>
        ) : null}

        <Link
          href="/conta"
          className="mt-5 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Ver a minha conta
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handlePreview}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <fieldset>
          <legend className="text-lg font-semibold text-gray-950">
            Método de receção
          </legend>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-4">
              <input
                type="radio"
                name="fulfillment-method"
                value="DELIVERY"
                aria-label="Entrega ao domicílio"
                checked={
                  fulfillmentMethod ===
                  'DELIVERY'
                }
                disabled={
                  pendingAction !== null ||
                  addresses.length === 0
                }
                onChange={() =>
                  changeFulfillmentMethod(
                    'DELIVERY',
                  )
                }
              />

              <span>
                <span className="block text-sm font-semibold text-gray-950">
                  Entrega ao domicílio
                </span>
                <span className="mt-1 block text-xs text-gray-600">
                  Entrega numa morada
                  guardada.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-4">
              <input
                type="radio"
                name="fulfillment-method"
                value="PICKUP"
                aria-label="Levantar em loja"
                checked={
                  fulfillmentMethod ===
                  'PICKUP'
                }
                disabled={
                  pendingAction !== null
                }
                onChange={() =>
                  changeFulfillmentMethod(
                    'PICKUP',
                  )
                }
              />

              <span>
                <span className="block text-sm font-semibold text-gray-950">
                  Levantar em loja
                </span>
                <span className="mt-1 block text-xs text-gray-600">
                  Sem portes de envio.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <h2 className="mt-7 text-lg font-semibold text-gray-950">
          {fulfillmentMethod ===
          'DELIVERY'
            ? 'Dados de entrega'
            : 'Dados para levantamento'}
        </h2>

        {fulfillmentMethod ===
        'DELIVERY' ? (
          <>
            {addresses.length === 0 ? (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p>
                  Não tens moradas
                  guardadas. Podes
                  levantar em loja ou
                  adicionar uma morada
                  na tua conta.
                </p>

                <Link
                  href="/conta"
                  className="mt-3 inline-flex font-semibold underline"
                >
                  Gerir moradas
                </Link>
              </div>
            ) : (
              <>
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
                      pendingAction !==
                      null
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
                          key={address.id}
                          value={
                            address.id
                          }
                        >
                          {address.name} —{' '}
                          {address.addressLine1},{' '}
                          {address.city}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {selectedAddress ? (
                  <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-950">
                      {selectedAddress.name}
                    </p>

                    <p className="mt-1">
                      {selectedAddress.addressLine1}
                    </p>

                    {selectedAddress.addressLine2 ? (
                      <p>
                        {selectedAddress.addressLine2}
                      </p>
                    ) : null}

                    <p>
                      {selectedAddress.postalCode}{' '}
                      {selectedAddress.city}
                    </p>

                    <p>
                      {selectedAddress.country}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : (
          <div className="mt-5">
            <label
              htmlFor="checkout-pickup-name"
              className="block text-sm font-medium text-gray-900"
            >
              Nome de contacto
            </label>

            <input
              id="checkout-pickup-name"
              type="text"
              value={pickupName}
              disabled={
                pendingAction !== null
              }
              onChange={(event) => {
                setPickupName(
                  event.target.value,
                )

                invalidatePreview()
              }}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-950"
              autoComplete="name"
            />
          </div>
        )}

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
            autoComplete="tel"
          />
        </div>

        <fieldset className="mt-7">
          <legend className="text-lg font-semibold text-gray-950">
            Pagamento
          </legend>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-4">
              <input
                type="radio"
                name="payment-method"
                value="CARD"
                aria-label="Cartão"
                checked={
                  paymentMethod === 'CARD'
                }
                disabled={
                  pendingAction !== null
                }
                onChange={() =>
                  changePaymentMethod(
                    'CARD',
                  )
                }
              />

              <span>
                <span className="block text-sm font-semibold text-gray-950">
                  Cartão
                </span>
                <span className="mt-1 block text-xs text-gray-600">
                  Pagamento integral por cartão.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-4">
              <input
                type="radio"
                name="payment-method"
                value="INSTALLMENTS"
                aria-label="Pagamento em prestações"
                checked={
                  paymentMethod ===
                  'INSTALLMENTS'
                }
                disabled={
                  pendingAction !== null
                }
                onChange={() =>
                  changePaymentMethod(
                    'INSTALLMENTS',
                  )
                }
              />

              <span>
                <span className="block text-sm font-semibold text-gray-950">
                  Pagamento em prestações
                </span>
                <span className="mt-1 block text-xs text-gray-600">
                  Define o número de prestações antes de calcular o total.
                </span>
              </span>
            </label>
          </div>

          {paymentMethod ===
          'INSTALLMENTS' ? (
            <div className="mt-4">
              <label
                htmlFor="checkout-installment-count"
                className="block text-sm font-medium text-gray-900"
              >
                Número de prestações
              </label>

              <select
                id="checkout-installment-count"
                value={installmentCount}
                disabled={
                  pendingAction !== null
                }
                onChange={(event) => {
                  setInstallmentCount(
                    event.target.value,
                  )
                  invalidatePreview()
                }}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
              >
                {Array.from(
                  { length: 11 },
                  (_, index) => {
                    const count =
                      index + 2

                    return (
                      <option
                        key={count}
                        value={String(
                          count,
                        )}
                      >
                        {count} prestações
                      </option>
                    )
                  },
                )}
              </select>

              <p className="mt-2 text-xs text-gray-600">
                Escolhe uma opção entre 2 e 12 prestações. Quando a Klarna for integrada, as opções disponíveis serão definidas pelo fornecedor.
              </p>
            </div>
          ) : null}
        </fieldset>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {fulfillmentMethod ===
          'DELIVERY' ? (
            <>
              Nesta fase, a entrega
              está disponível apenas
              para Portugal
              Continental.
            </>
          ) : (
            <>
              O levantamento em loja
              não tem portes. A
              encomenda só pode ficar
              pronta para levantamento
              depois de o pagamento ser
              confirmado.
            </>
          )}
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

        <p className="mt-2 text-xs text-gray-500">
          {fulfillmentMethod ===
          'PICKUP'
            ? 'Levantamento em loja'
            : 'Entrega ao domicílio'}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {paymentMethod === 'CARD'
            ? 'Pagamento: Cartão'
            : `Pagamento: ${installmentCount} prestações`}
        </p>

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
