'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type FormEvent,
  useEffect,
  useState,
} from 'react'

import {
  redirectToExternalUrl,
} from '@/lib/redirect'
import {
  getShippingMethodOptions,
} from '@/lib/shipping-methods'

type Address = {
  id: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  postalCode: string
  country: string
}

type AddressForm = {
  name: string
  addressLine1: string
  addressLine2: string
  city: string
  postalCode: string
  country: string
}

const emptyAddressForm: AddressForm = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  country: 'Portugal',
}

type FulfillmentMethod =
  | 'DELIVERY'
  | 'PICKUP'

type PaymentMethod =
  | 'CARD'
  | 'INSTALLMENTS'

type ShippingMethod =
  | 'STANDARD'
  | 'EXPRESS'

type CheckoutPreview = {
  subtotal: number
  shippingCost: number
  tax: number
  total: number
  fingerprint: string
  expressAvailable: boolean
  // Épico 7 — presentes apenas quando há cupão aplicado ao preview.
  discount?: number | null
  couponCode?: string | null
}

type CheckoutOrder = {
  id: string
  orderNumber: string
  fulfillmentMethod: FulfillmentMethod
  shippingMethod?: ShippingMethod | null
  paymentMethod?: PaymentMethod
  installmentCount?: number | null
  subtotal: number
  shippingCost: number
  tax: number
  total: number
  status: string
  paymentStatus: string
}

type StripeCheckoutSession = {
  id: string
  url: string
}

type StripeCheckoutCreation = {
  order: CheckoutOrder
  checkoutSession: StripeCheckoutSession
}

type LoadMode =
  | 'loading'
  | 'ready'
  | 'unauthenticated'
  | 'error'

type PendingAction =
  | 'address'
  | 'preview'
  | 'checkout'
  | 'coupon'
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
      shippingMethod?: ShippingMethod
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
    /^[0-9a-f]{64}$/.test(value.fingerprint) &&
    typeof value.expressAvailable ===
      'boolean' &&
    // Épico 7 — chaves do cupão opcionais; aceites quando ausentes
    // (respostas antigas) ou null/string/number válidos.
    (value.discount === undefined ||
      value.discount === null ||
      isMoneyValue(value.discount)) &&
    (value.couponCode === undefined ||
      value.couponCode === null ||
      typeof value.couponCode ===
        'string')
  )
}

type CouponValidationApiResult =
  | {
      valid: true
      code: string
      discount: number
      newTotal: number
    }
  | {
      valid: false
      message: string
    }

/**
 * Épico 7 — resposta do endpoint de validação de cupões, validada de
 * forma tolerante: `valid` decide o ramo; `code`/`discount`/`newTotal`
 * são assumidos do preview real quando presentes.
 */
function parseCouponValidation(
  value: unknown,
): CouponValidationApiResult | null {
  if (!isRecord(value)) {
    return null
  }

  if (value.valid === true) {
    return {
      valid: true,
      code:
        typeof value.code ===
          'string' &&
        value.code.trim()
          ? value.code.trim()
          : '',
      discount: isMoneyValue(
        value.discount,
      )
        ? value.discount
        : 0,
      newTotal: isMoneyValue(
        value.newTotal,
      )
        ? value.newTotal
        : 0,
    }
  }

  if (value.valid === false) {
    return {
      valid: false,
      message:
        typeof value.message ===
          'string' &&
        value.message.trim()
          ? value.message
          : 'Cupão inválido.',
    }
  }

  return null
}

function isFulfillmentMethod(
  value: unknown,
): value is FulfillmentMethod {
  return (
    value === 'DELIVERY' ||
    value === 'PICKUP'
  )
}

function isShippingMethodValue(
  value: unknown,
): value is ShippingMethod {
  return (
    value === 'STANDARD' ||
    value === 'EXPRESS'
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
      value.shippingMethod ===
        undefined ||
      value.shippingMethod ===
        null ||
      isShippingMethodValue(
        value.shippingMethod,
      )
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

async function parseAddress(
  response: Response,
): Promise<Address> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !isAddress(body.address)
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return body.address
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

/**
 * O utilizador sai da aplicação para a página de pagamento alojada no
 * Stripe. Antes de despoletar essa navegação valida-se que o URL é
 * http(s), para nunca executarmos esquemas perigosos (ex.: javascript:)
 * que cheguem a partir do servidor.
 */
function isSafeCheckoutUrl(
  value: unknown,
): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0
  ) {
    return false
  }

  try {
    const url = new URL(value)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

function isStripeCheckoutSession(
  value: unknown,
): value is StripeCheckoutSession {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    isSafeCheckoutUrl(value.url)
  )
}

async function parseCheckoutSessionResponse(
  response: Response,
): Promise<StripeCheckoutCreation> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !isCheckoutOrder(body.order) ||
    !isStripeCheckoutSession(
      body.checkoutSession,
    )
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return {
    order: body.order,
    checkoutSession:
      body.checkoutSession,
  }
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
    addressForm,
    setAddressForm,
  ] = useState<AddressForm>(
    emptyAddressForm,
  )

  const [
    showAddressForm,
    setShowAddressForm,
  ] = useState(false)

  const [
    editingAddressId,
    setEditingAddressId,
  ] = useState<string | null>(null)

  const [
    addressPendingDeletionId,
    setAddressPendingDeletionId,
  ] = useState<string | null>(null)

  const [
    fulfillmentMethod,
    setFulfillmentMethod,
  ] = useState<FulfillmentMethod>(
    'DELIVERY',
  )

  const [
    shippingMethod,
    setShippingMethod,
  ] = useState<ShippingMethod>(
    'STANDARD',
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

  const [
    pendingAction,
    setPendingAction,
  ] = useState<PendingAction>(
    null,
  )

  const [error, setError] =
    useState<string | null>(null)

  // Épico 7 — cupão: rascunho no input, código aplicado e mensagem
  // própria (não mistura com o erro global do checkout).
  const [couponDraft, setCouponDraft] =
    useState('')

  const [
    appliedCoupon,
    setAppliedCoupon,
  ] = useState<string | null>(null)

  const [
    couponNotice,
    setCouponNotice,
  ] = useState<string | null>(null)

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
            setShowAddressForm(true)
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

  function updateAddressField(
    field: keyof AddressForm,
    value: string,
  ) {
    setAddressForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function startEditingAddress(
    address: Address,
  ) {
    if (pendingAction) {
      return
    }

    setError(null)
    setAddressPendingDeletionId(null)
    setEditingAddressId(address.id)
    setAddressForm({
      name: address.name,
      addressLine1:
        address.addressLine1,
      addressLine2:
        address.addressLine2 ?? '',
      city: address.city,
      postalCode:
        address.postalCode,
      country: address.country,
    })
    setShowAddressForm(true)
  }

  function cancelAddressForm() {
    if (
      pendingAction ||
      addresses.length === 0
    ) {
      return
    }

    setEditingAddressId(null)
    setAddressForm(emptyAddressForm)
    setShowAddressForm(false)
    setError(null)
  }

  async function handleSaveAddress() {
    if (pendingAction) {
      return
    }

    const addressId = editingAddressId

    setPendingAction('address')
    setError(null)

    try {
      const response = await fetch(
        '/api/addresses',
        {
          method: addressId
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ...(addressId
              ? {
                  addressId,
                }
              : {}),
            ...addressForm,
          }),
        },
      )

      if (response.status === 401) {
        setMode('unauthenticated')

        replace(
          '/login?callbackUrl=%2Fcheckout',
        )

        return
      }

      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
            addressId
              ? 'Não foi possível atualizar a morada'
              : 'Não foi possível criar a morada',
          ),
        )
      }

      const savedAddress =
        await parseAddress(response)

      if (addressId) {
        setAddresses((current) =>
          current.map((address) =>
            address.id === addressId
              ? savedAddress
              : address,
          ),
        )
      } else {
        setAddresses((current) =>
          [...current, savedAddress].sort(
            (first, second) =>
              first.id.localeCompare(
                second.id,
              ),
          ),
        )

        setPickupName((current) =>
          current.trim()
            ? current
            : savedAddress.name,
        )
      }

      setSelectedAddressId(
        savedAddress.id,
      )

      setFulfillmentMethod('DELIVERY')
      setAddressPendingDeletionId(null)
      setEditingAddressId(null)
      setAddressForm(emptyAddressForm)
      setShowAddressForm(false)
      invalidatePreview()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : addressId
            ? 'Não foi possível atualizar a morada'
            : 'Não foi possível criar a morada',
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function handleDeleteAddress() {
    if (
      pendingAction ||
      !addressPendingDeletionId
    ) {
      return
    }

    const addressId =
      addressPendingDeletionId

    setPendingAction('address')
    setError(null)

    try {
      const response = await fetch(
        '/api/addresses',
        {
          method: 'DELETE',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            addressId,
          }),
        },
      )

      if (response.status === 401) {
        setMode('unauthenticated')

        replace(
          '/login?callbackUrl=%2Fcheckout',
        )

        return
      }

      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
            'Não foi possível apagar a morada',
          ),
        )
      }

      const remainingAddresses =
        addresses.filter(
          (address) =>
            address.id !== addressId,
        )

      setAddresses(remainingAddresses)
      setSelectedAddressId(
        remainingAddresses[0]?.id ?? '',
      )
      setAddressPendingDeletionId(null)
      setEditingAddressId(null)
      setAddressForm(emptyAddressForm)
      setShowAddressForm(
        remainingAddresses.length === 0,
      )
      setFulfillmentMethod('DELIVERY')
      invalidatePreview()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível apagar a morada',
      )
    } finally {
      setPendingAction(null)
    }
  }

  function changeFulfillmentMethod(
    nextMethod: FulfillmentMethod,
  ) {
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

  function changeShippingMethod(
    nextMethod: ShippingMethod,
  ) {
    setShippingMethod(nextMethod)
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
      shippingMethod,
    }
  }

  /**
   * Épico 7 — o preview passa a incluir o cupão aplicado (`couponCode`
   * null = sem cupão). Chamado pelo submit do formulário e pelos fluxos
   * de aplicar/remover cupão; sem guard de `pendingAction` para poder
   * encadear após a validação do cupão.
   */
  async function runPreview(
    couponCode: string | null,
  ) {
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
            body: JSON.stringify({
              ...checkoutInput,
              couponCode,
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

  async function handlePreview(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (pendingAction) {
      return
    }

    await runPreview(appliedCoupon)
  }

  // Épico 7 — validar o cupão ANTES do pagamento: o endpoint calcula o
  // subtotal no servidor; em caso de sucesso, o preview é recalculado
  // com o cupão para mostrar desconto e total real.
  async function handleApplyCoupon() {
    if (pendingAction) {
      return
    }

    const code =
      couponDraft.trim().toUpperCase()

    if (!code) {
      setCouponNotice(
        'Introduz o código de cupão.',
      )

      return
    }

    setPendingAction('coupon')
    setCouponNotice(null)
    setError(null)

    try {
      const response =
        await fetch(
          '/api/checkout/coupons/validate',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              code,
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

      const result =
        parseCouponValidation(
          await response.json(),
        )

      if (!result) {
        throw new Error(
          'Resposta de cupão inválida',
        )
      }

      if (result.valid) {
        const appliedCode =
          result.code || code

        setAppliedCoupon(appliedCode)

        setCouponNotice(
          `Cupão ${appliedCode} aplicado.`,
        )

        if (
          isCheckoutPreview(preview)
        ) {
          await runPreview(appliedCode)
        }
      } else {
        setCouponNotice(result.message)
      }
    } catch (caughtError) {
      setCouponNotice(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível validar o cupão',
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function handleRemoveCoupon() {
    if (pendingAction) {
      return
    }

    setAppliedCoupon(null)
    setCouponDraft('')
    setCouponNotice(null)

    if (isCheckoutPreview(preview)) {
      await runPreview(null)
    }
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

    try {
      const response =
        await fetch(
          '/api/checkout/stripe',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              ...checkoutInput,
              // Épico 7 — o cupão aplicado vai no pedido; o servidor
              // reavalia e recomputa o desconto a partir do carrinho.
              ...(appliedCoupon
                ? {
                    couponCode:
                      appliedCoupon,
                  }
                : {}),
              expectedFingerprint:
                preview.fingerprint,
            }),
          },
        )

      if (!response.ok) {
        // 409 significa que o preview deixou de ser atual
        // (stock/carrinho alterados): volta a exigir um
        // cálculo explícito do total antes de submeter.
        if (response.status === 409) {
          setPreview(null)
        }

        throw new Error(
          await getResponseError(
            response,
          ),
        )
      }

      const creation =
        await parseCheckoutSessionResponse(
          response,
        )

      // Navegação completa para a página de pagamento alojada no
      // Stripe. O pendingAction mantém-se ativo enquanto o browser
      // sai da aplicação; em erro é libertado abaixo.
      redirectToExternalUrl(
        creation.checkoutSession.url,
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível iniciar o pagamento',
      )

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
                  pendingAction !== null
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
                  Usa uma morada guardada
                  ou adiciona uma aqui.
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

        {fulfillmentMethod ===
        'DELIVERY' ? (
          <fieldset>
            <legend className="text-lg font-semibold text-gray-950">
              Velocidade de entrega
            </legend>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {getShippingMethodOptions(
                'DELIVERY',
              ).map((option) => {
                const expressUnavailable =
                  option.id ===
                    'EXPRESS' &&
                  preview !==
                    null &&
                  preview.expressAvailable ===
                    false

                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-4"
                  >
                    <input
                      type="radio"
                      name="shipping-method"
                      value={option.id}
                      aria-label={
                        option.label
                      }
                      checked={
                        shippingMethod ===
                        option.id
                      }
                      disabled={
                        pendingAction !==
                          null ||
                        expressUnavailable
                      }
                      onChange={() => {
                        if (
                          option.shippingMethodCode !==
                          null
                        ) {
                          changeShippingMethod(
                            option.shippingMethodCode,
                          )
                        }
                      }}
                    />

                    <span>
                      <span className="block text-sm font-semibold text-gray-950">
                        {option.label}
                      </span>

                      <span className="mt-1 block text-xs text-gray-600">
                        {option.estimate}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>

            <p className="mt-3 text-xs text-gray-600">
              O envio expresso soma um
              suplemento aos portes
              standard. Quando os
              portes standard forem
              grátis, o expresso cobra
              apenas o suplemento.
            </p>
          </fieldset>
        ) : null}

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
                Ainda não tens moradas
                guardadas. Adiciona uma
                morada abaixo para receber
                a encomenda ao domicílio.
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
                      setAddressPendingDeletionId(
                        null,
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

                {!showAddressForm ? (
                  addressPendingDeletionId &&
                  selectedAddress?.id ===
                    addressPendingDeletionId ? (
                    <div
                      role="group"
                      aria-label="Confirmar eliminação da morada"
                      className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4"
                    >
                      <p className="text-sm text-red-900">
                        Tens a certeza de que
                        queres apagar esta
                        morada?
                      </p>

                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={
                            pendingAction !==
                            null
                          }
                          onClick={() =>
                            void handleDeleteAddress()
                          }
                          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pendingAction ===
                          'address'
                            ? 'A apagar...'
                            : 'Confirmar eliminação'}
                        </button>

                        <button
                          type="button"
                          disabled={
                            pendingAction !==
                            null
                          }
                          onClick={() => {
                            setAddressPendingDeletionId(
                              null,
                            )
                            setError(null)
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {selectedAddress ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              pendingAction !==
                              null
                            }
                            onClick={() =>
                              startEditingAddress(
                                selectedAddress,
                              )
                            }
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Editar morada
                          </button>

                          <button
                            type="button"
                            disabled={
                              pendingAction !==
                              null
                            }
                            onClick={() => {
                              setError(null)
                              setAddressPendingDeletionId(
                                selectedAddress.id,
                              )
                            }}
                            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Apagar morada
                          </button>
                        </>
                      ) : null}

                      <button
                        type="button"
                        disabled={
                          pendingAction !==
                          null
                        }
                        onClick={() => {
                          setError(null)
                          setAddressPendingDeletionId(
                            null,
                          )
                          setEditingAddressId(
                            null,
                          )
                          setAddressForm(
                            emptyAddressForm,
                          )
                          setShowAddressForm(
                            true,
                          )
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Adicionar nova morada
                      </button>
                    </div>
                  )
                ) : null}
              </>
            )}

            {showAddressForm ? (
              <fieldset
                disabled={
                  pendingAction !== null
                }
                className="mt-5 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 disabled:opacity-60"
              >
                <legend className="px-1 text-sm font-semibold text-gray-950">
                  {editingAddressId
                    ? 'Editar morada'
                    : 'Adicionar nova morada'}
                </legend>

                <div>
                  <label
                    htmlFor="checkout-address-name"
                    className="block text-sm font-medium text-gray-900"
                  >
                    Nome
                  </label>

                  <input
                    id="checkout-address-name"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    value={
                      addressForm.name
                    }
                    onChange={(event) =>
                      updateAddressField(
                        'name',
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkout-address-line-1"
                    className="block text-sm font-medium text-gray-900"
                  >
                    {editingAddressId
                      ? 'Morada (linha 1)'
                      : 'Morada nova'}
                  </label>

                  <input
                    id="checkout-address-line-1"
                    type="text"
                    autoComplete="address-line1"
                    maxLength={200}
                    value={
                      addressForm.addressLine1
                    }
                    onChange={(event) =>
                      updateAddressField(
                        'addressLine1',
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkout-address-line-2"
                    className="block text-sm font-medium text-gray-900"
                  >
                    Complemento da morada
                    (opcional)
                  </label>

                  <input
                    id="checkout-address-line-2"
                    type="text"
                    autoComplete="address-line2"
                    maxLength={200}
                    value={
                      addressForm.addressLine2
                    }
                    onChange={(event) =>
                      updateAddressField(
                        'addressLine2',
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkout-address-city"
                    className="block text-sm font-medium text-gray-900"
                  >
                    Localidade
                  </label>

                  <input
                    id="checkout-address-city"
                    type="text"
                    autoComplete="address-level2"
                    maxLength={100}
                    value={
                      addressForm.city
                    }
                    onChange={(event) =>
                      updateAddressField(
                        'city',
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkout-address-postal-code"
                    className="block text-sm font-medium text-gray-900"
                  >
                    Código postal
                  </label>

                  <input
                    id="checkout-address-postal-code"
                    type="text"
                    autoComplete="postal-code"
                    maxLength={20}
                    value={
                      addressForm.postalCode
                    }
                    onChange={(event) =>
                      updateAddressField(
                        'postalCode',
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkout-address-country"
                    className="block text-sm font-medium text-gray-900"
                  >
                    País
                  </label>

                  <input
                    id="checkout-address-country"
                    type="text"
                    autoComplete="country-name"
                    maxLength={100}
                    value={
                      addressForm.country
                    }
                    onChange={(event) =>
                      updateAddressField(
                        'country',
                        event.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void handleSaveAddress()
                    }
                    className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingAction ===
                    'address'
                      ? 'A guardar...'
                      : editingAddressId
                        ? 'Guardar alterações'
                        : 'Guardar e usar esta morada'}
                  </button>

                  {addresses.length > 0 ? (
                    <button
                      type="button"
                      onClick={
                        cancelAddressForm
                      }
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {editingAddressId
                        ? 'Cancelar edição'
                        : 'Cancelar'}
                    </button>
                  ) : null}
                </div>
              </fieldset>
            ) : null}
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
            : shippingMethod ===
                'EXPRESS'
              ? 'Envio expresso'
              : 'Envio standard'}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {fulfillmentMethod ===
          'DELIVERY' ? (
            <>
              {shippingMethod ===
              'EXPRESS'
                ? 'Entrega estimada em 1–2 dias úteis.'
                : 'Entrega estimada em 2–5 dias úteis.'}
            </>
          ) : null}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {paymentMethod === 'CARD'
            ? 'Pagamento: Cartão'
            : `Pagamento: ${installmentCount} prestações`}
        </p>

        {/* Épico 7 — cupão de desconto: validar antes do pagamento. */}
        <div className="mt-5 space-y-2">
          <label
            htmlFor="coupon-code"
            className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
          >
            Cupão de desconto
          </label>

          <div className="flex items-center gap-2">
            <input
              id="coupon-code"
              type="text"
              value={couponDraft}
              disabled={pendingAction !== null}
              onChange={(event) =>
                setCouponDraft(
                  event.target.value,
                )
              }
              placeholder="PROMO10"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase placeholder:normal-case disabled:cursor-not-allowed disabled:opacity-50"
            />

            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() =>
                void handleApplyCoupon()
              }
              className="shrink-0 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === 'coupon'
                ? 'A validar...'
                : 'Aplicar'}
            </button>

            {appliedCoupon ? (
              <button
                type="button"
                disabled={
                  pendingAction !== null
                }
                onClick={() =>
                  void handleRemoveCoupon()
                }
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remover
              </button>
            ) : null}
          </div>

          {appliedCoupon ? (
            <p className="text-xs text-gray-600">
              Cupão aplicado:{' '}
              <span className="font-bold text-gray-950">
                {appliedCoupon}
              </span>
            </p>
          ) : null}

          {couponNotice ? (
            <p
              role="alert"
              className="text-xs text-red-700"
            >
              {couponNotice}
            </p>
          ) : null}
        </div>

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

            {/* Épico 7 — linha do desconto do cupão: o preview do
                servidor já devolve o total descontado. */}
            {preview.discount !=
              null &&
            preview.discount > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Desconto
                  {preview.couponCode
                    ? ` (${preview.couponCode})`
                    : ''}
                </span>

                <span className="font-medium text-emerald-700">
                  −
                  {formatPrice(
                    preview.discount,
                  )}
                </span>
              </div>
            ) : null}

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
                ? 'A redirecionar para o pagamento...'
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
