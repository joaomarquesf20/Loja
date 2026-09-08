export const GUEST_CART_STORAGE_KEY =
  'pfautoparts:guest-cart'

export type GuestCartItem = {
  productId: string
  quantity: number
}

export class GuestCartValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuestCartValidationError'
  }
}

export class GuestCartItemNotFoundError extends Error {
  constructor(
    message = 'Item do carrinho não encontrado',
  ) {
    super(message)
    this.name = 'GuestCartItemNotFoundError'
  }
}

function normalizeProductId(
  productId: string,
) {
  const normalizedProductId =
    productId.trim()

  if (!normalizedProductId) {
    throw new GuestCartValidationError(
      'Produto inválido',
    )
  }

  return normalizedProductId
}

function validateQuantity(
  quantity: number,
) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    throw new GuestCartValidationError(
      'Quantidade inválida',
    )
  }
}

function isGuestCartItem(
  value: unknown,
): value is GuestCartItem {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }

  const candidate =
    value as Record<string, unknown>

  return (
    typeof candidate.productId ===
      'string' &&
    candidate.productId.trim().length >
      0 &&
    typeof candidate.quantity ===
      'number' &&
    Number.isSafeInteger(
      candidate.quantity,
    ) &&
    candidate.quantity > 0
  )
}

export function readGuestCart(): GuestCartItem[] {
  if (typeof window === 'undefined') {
    return []
  }

  let rawValue: string | null

  try {
    rawValue =
      window.localStorage.getItem(
        GUEST_CART_STORAGE_KEY,
      )
  } catch {
    return []
  }

  if (!rawValue) {
    return []
  }

  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(rawValue)
  } catch {
    return []
  }

  if (!Array.isArray(parsedValue)) {
    return []
  }

  return parsedValue
    .filter(isGuestCartItem)
    .map((item) => ({
      productId: item.productId.trim(),
      quantity: item.quantity,
    }))
}

export function writeGuestCart(
  items: GuestCartItem[],
) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    GUEST_CART_STORAGE_KEY,
    JSON.stringify(items),
  )
}

export function addGuestCartItem(
  productId: string,
  quantity = 1,
): GuestCartItem[] {
  const normalizedProductId =
    normalizeProductId(productId)

  validateQuantity(quantity)

  const items = readGuestCart()

  const existingIndex =
    items.findIndex(
      (item) =>
        item.productId ===
        normalizedProductId,
    )

  if (existingIndex === -1) {
    const nextItems = [
      ...items,
      {
        productId:
          normalizedProductId,
        quantity,
      },
    ]

    writeGuestCart(nextItems)

    return nextItems
  }

  const currentItem =
    items[existingIndex]

  const nextQuantity =
    currentItem.quantity + quantity

  validateQuantity(nextQuantity)

  const nextItems = items.map(
    (item, index) =>
      index === existingIndex
        ? {
            ...item,
            quantity: nextQuantity,
          }
        : item,
  )

  writeGuestCart(nextItems)

  return nextItems
}

export function updateGuestCartItemQuantity(
  productId: string,
  quantity: number,
): GuestCartItem[] {
  const normalizedProductId =
    normalizeProductId(productId)

  validateQuantity(quantity)

  const items = readGuestCart()

  const existingIndex =
    items.findIndex(
      (item) =>
        item.productId ===
        normalizedProductId,
    )

  if (existingIndex === -1) {
    throw new GuestCartItemNotFoundError()
  }

  const nextItems = items.map(
    (item, index) =>
      index === existingIndex
        ? {
            ...item,
            quantity,
          }
        : item,
  )

  writeGuestCart(nextItems)

  return nextItems
}

export function removeGuestCartItem(
  productId: string,
): GuestCartItem[] {
  const normalizedProductId =
    normalizeProductId(productId)

  const items = readGuestCart()

  const exists = items.some(
    (item) =>
      item.productId ===
      normalizedProductId,
  )

  if (!exists) {
    throw new GuestCartItemNotFoundError()
  }

  const nextItems = items.filter(
    (item) =>
      item.productId !==
      normalizedProductId,
  )

  writeGuestCart(nextItems)

  return nextItems
}