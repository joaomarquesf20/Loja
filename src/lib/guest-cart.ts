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
    !Number.isInteger(quantity) ||
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

  const item =
    value as Record<string, unknown>

  return (
    typeof item.productId === 'string' &&
    item.productId.trim().length > 0 &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  )
}

export function readGuestCart(): GuestCartItem[] {
  if (typeof window === 'undefined') {
    return []
  }

  const storedValue =
    window.localStorage.getItem(
      GUEST_CART_STORAGE_KEY,
    )

  if (!storedValue) {
    return []
  }

  try {
    const parsedValue: unknown =
      JSON.parse(storedValue)

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue
      .filter(isGuestCartItem)
      .map((item) => ({
        productId:
          item.productId.trim(),
        quantity: item.quantity,
      }))
  } catch {
    return []
  }
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
) {
  const normalizedProductId =
    normalizeProductId(productId)

  validateQuantity(quantity)

  const items = readGuestCart()

  const existingItem = items.find(
    (item) =>
      item.productId ===
      normalizedProductId,
  )

  const nextItems = existingItem
    ? items.map((item) =>
        item.productId ===
        normalizedProductId
          ? {
              ...item,
              quantity:
                item.quantity +
                quantity,
            }
          : item,
      )
    : [
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