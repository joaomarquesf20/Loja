export const GUEST_CART_STORAGE_KEY =
  'pfautoparts:guest-cart'

export const GUEST_CART_MERGE_STORAGE_KEY =
  'pfautoparts:guest-cart-merge'

const MAX_MERGE_KEY_LENGTH = 128

export type GuestCartItem = {
  productId: string
  quantity: number
}

export type GuestCartMergeAttempt = {
  mergeKey: string
  items: GuestCartItem[]
}

export class GuestCartValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name =
      'GuestCartValidationError'
  }
}

export class GuestCartItemNotFoundError extends Error {
  constructor(
    message =
      'Item do carrinho não encontrado',
  ) {
    super(message)
    this.name =
      'GuestCartItemNotFoundError'
  }
}

export class GuestCartMergePendingError extends Error {
  constructor(
    message =
      'Existe uma fusão do carrinho pendente. Inicia sessão novamente para a concluir.',
  ) {
    super(message)
    this.name =
      'GuestCartMergePendingError'
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

function normalizeMergeKey(
  mergeKey: string,
) {
  const normalizedMergeKey =
    mergeKey.trim()

  if (
    !normalizedMergeKey ||
    normalizedMergeKey.length >
      MAX_MERGE_KEY_LENGTH
  ) {
    throw new GuestCartValidationError(
      'Identificador de merge inválido',
    )
  }

  return normalizedMergeKey
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

function normalizeGuestCartItems(
  items: GuestCartItem[],
): GuestCartItem[] {
  return items.map((item) => ({
    productId: item.productId.trim(),
    quantity: item.quantity,
  }))
}

function parseGuestCartMergeAttempt(
  value: unknown,
): GuestCartMergeAttempt {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new GuestCartValidationError(
      'Estado de fusão do carrinho inválido',
    )
  }

  const candidate =
    value as Record<string, unknown>

  if (
    typeof candidate.mergeKey !==
      'string' ||
    !Array.isArray(candidate.items) ||
    candidate.items.length === 0 ||
    !candidate.items.every(
      isGuestCartItem,
    )
  ) {
    throw new GuestCartValidationError(
      'Estado de fusão do carrinho inválido',
    )
  }

  const mergeKey = normalizeMergeKey(
    candidate.mergeKey,
  )

  return {
    mergeKey,
    items: normalizeGuestCartItems(
      candidate.items,
    ),
  }
}

function persistGuestCart(
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

function assertGuestCartIsMutable() {
  const pendingAttempt =
    readGuestCartMergeAttempt()

  if (pendingAttempt) {
    throw new GuestCartMergePendingError()
  }
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

export function readGuestCartMergeAttempt():
  | GuestCartMergeAttempt
  | null {
  if (typeof window === 'undefined') {
    return null
  }

  let rawValue: string | null

  try {
    rawValue =
      window.localStorage.getItem(
        GUEST_CART_MERGE_STORAGE_KEY,
      )
  } catch {
    return null
  }

  if (!rawValue) {
    return null
  }

  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(rawValue)
  } catch {
    throw new GuestCartValidationError(
      'Estado de fusão do carrinho inválido',
    )
  }

  return parseGuestCartMergeAttempt(
    parsedValue,
  )
}

export function getOrCreateGuestCartMergeAttempt():
  | GuestCartMergeAttempt
  | null {
  if (typeof window === 'undefined') {
    return null
  }

  const existingAttempt =
    readGuestCartMergeAttempt()

  if (existingAttempt) {
    return existingAttempt
  }

  const items = readGuestCart()

  if (items.length === 0) {
    return null
  }

  const mergeKey =
    globalThis.crypto.randomUUID()

  const attempt: GuestCartMergeAttempt =
    {
      mergeKey,
      items,
    }

  window.localStorage.setItem(
    GUEST_CART_MERGE_STORAGE_KEY,
    JSON.stringify(attempt),
  )

  return attempt
}

export function completeGuestCartMerge(
  mergeKey: string,
) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedMergeKey =
    normalizeMergeKey(mergeKey)

  const attempt =
    readGuestCartMergeAttempt()

  if (
    !attempt ||
    attempt.mergeKey !==
      normalizedMergeKey
  ) {
    throw new GuestCartValidationError(
      'Tentativa de fusão do carrinho inválida',
    )
  }

  // A ordem é intencional.
  // Se a remoção do receipt local falhar depois,
  // o carrinho já vazio pode repetir o mesmo mergeKey
  // sem voltar a somar quantidades no servidor.
  window.localStorage.removeItem(
    GUEST_CART_STORAGE_KEY,
  )

  window.localStorage.removeItem(
    GUEST_CART_MERGE_STORAGE_KEY,
  )
}

export function discardGuestCartMergeAttempt(
  mergeKey: string,
) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedMergeKey =
    normalizeMergeKey(mergeKey)

  const attempt =
    readGuestCartMergeAttempt()

  if (!attempt) {
    return
  }

  if (
    attempt.mergeKey !==
    normalizedMergeKey
  ) {
    throw new GuestCartValidationError(
      'Tentativa de fusão do carrinho inválida',
    )
  }

  window.localStorage.removeItem(
    GUEST_CART_MERGE_STORAGE_KEY,
  )
}

export function writeGuestCart(
  items: GuestCartItem[],
) {
  assertGuestCartIsMutable()
  persistGuestCart(items)
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