'use client'

import Link from 'next/link'
import {
  useEffect,
  useState,
} from 'react'
import {
  readGuestCart,
  removeGuestCartItem,
  updateGuestCartItemQuantity,
  writeGuestCart,
  type GuestCartItem,
} from '@/lib/guest-cart'

type CartProduct = {
  id: string
  name: string
  slug: string
  price: number
  images: string[]
}

type CartItem = {
  id?: string
  productId: string
  productVariantId?: string
  quantity: number
  product: CartProduct | null
  inStock: boolean
  isAvailable: boolean
  canIncrease: boolean
}

type CartMode =
  | 'loading'
  | 'authenticated'
  | 'guest'
  | 'error'

type CartResponse = {
  items: CartItem[]
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

async function getResponseError(
  response: Response,
) {
  try {
    const body: unknown =
      await response.json()

    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (
        body as Record<
          string,
          unknown
        >
      ).error === 'string'
    ) {
      return (
        body as {
          error: string
        }
      ).error
    }
  } catch {
    // A resposta pode não ter JSON.
  }

  return 'Não foi possível atualizar o carrinho'
}

async function parseCartItems(
  response: Response,
): Promise<CartItem[]> {
  const body: unknown =
    await response.json()

  if (
    typeof body !== 'object' ||
    body === null ||
    !('items' in body) ||
    !Array.isArray(
      (
        body as Record<
          string,
          unknown
        >
      ).items,
    )
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return (
    body as CartResponse
  ).items
}

async function fetchAuthenticatedCart() {
  const response = await fetch(
    '/api/cart',
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

  return parseCartItems(response)
}

async function fetchGuestCart() {
  const guestItems =
    readGuestCart()

  const response = await fetch(
    '/api/cart/guest',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        items: guestItems,
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

  return parseCartItems(response)
}

function restoreGuestCart(
  previousItems: GuestCartItem[],
) {
  try {
    writeGuestCart(previousItems)
  } catch {
    // A mensagem principal de erro
    // continua a ser mostrada na UI.
  }
}

export function CartClient() {
  const [mode, setMode] =
    useState<CartMode>('loading')

  const [items, setItems] =
    useState<CartItem[]>([])

  const [error, setError] =
    useState<string | null>(null)

  const [
    pendingProductId,
    setPendingProductId,
  ] = useState<string | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    async function loadCart() {
      setError(null)

      try {
        const response =
          await fetch('/api/cart', {
            method: 'GET',
            cache: 'no-store',
          })

        if (response.status === 401) {
          const guestItems =
            await fetchGuestCart()

          if (!cancelled) {
            setItems(guestItems)
            setMode('guest')
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

        const authenticatedItems =
          await parseCartItems(
            response,
          )

        if (!cancelled) {
          setItems(
            authenticatedItems,
          )
          setMode(
            'authenticated',
          )
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Não foi possível carregar o carrinho',
          )

          setMode('error')
        }
      }
    }

    void loadCart()

    return () => {
      cancelled = true
    }
  }, [])

  async function refreshCurrentCart() {
    if (
      mode === 'authenticated'
    ) {
      const nextItems =
        await fetchAuthenticatedCart()

      setItems(nextItems)

      return
    }

    if (mode === 'guest') {
      const nextItems =
        await fetchGuestCart()

      setItems(nextItems)
    }
  }

  async function changeQuantity(
    item: CartItem,
    quantity: number,
  ) {
    if (
      mode === 'loading' ||
      pendingProductId
    ) {
      return
    }

    setPendingProductId(
      item.productId,
      item.productVariantId,
    )
    setError(null)

    try {
      if (
        mode === 'authenticated'
      ) {
        const response =
          await fetch('/api/cart', {
            method: 'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              productId:
                item.productId,
              ...(item.productVariantId
                ? {
                    productVariantId:
                      item.productVariantId,
                  }
                : {}),
              quantity,
            }),
          })

        if (!response.ok) {
          throw new Error(
            await getResponseError(
              response,
            ),
          )
        }

        await refreshCurrentCart()

        return
      }

      const previousItems =
        readGuestCart()

      try {
        updateGuestCartItemQuantity(
          item.productId,
          quantity,
        )

        const nextItems =
          await fetchGuestCart()

        setItems(nextItems)
      } catch (caughtError) {
        restoreGuestCart(
          previousItems,
        )

        throw caughtError
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível alterar a quantidade',
      )
    } finally {
      setPendingProductId(null)
    }
  }

  async function removeItem(
    item: CartItem,
  ) {
    if (
      mode === 'loading' ||
      pendingProductId
    ) {
      return
    }

    setPendingProductId(
      item.productId,
      item.productVariantId,
    )
    setError(null)

    try {
      if (
        mode === 'authenticated'
      ) {
        const response =
          await fetch('/api/cart', {
            method: 'DELETE',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              productId:
                item.productId,
              ...(item.productVariantId
                ? {
                    productVariantId:
                      item.productVariantId,
                  }
                : {}),
            }),
          })

        if (!response.ok) {
          throw new Error(
            await getResponseError(
              response,
            ),
          )
        }

        await refreshCurrentCart()

        return
      }

      const previousItems =
        readGuestCart()

      try {
        removeGuestCartItem(
          item.productId,
        )

        const nextItems =
          await fetchGuestCart()

        setItems(nextItems)
      } catch (caughtError) {
        restoreGuestCart(
          previousItems,
        )

        throw caughtError
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível remover o produto',
      )
    } finally {
      setPendingProductId(null)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-600">
          A carregar carrinho...
        </p>
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
          Não foi possível carregar o carrinho
        </h2>

        <p className="mt-2 text-sm text-red-800">
          {error ??
            'Ocorreu um erro ao carregar o carrinho.'}
        </p>
      </div>
    )
  }

  const subtotal =
    items.reduce(
      (total, item) => {
        if (
          !item.product ||
          !item.isAvailable
        ) {
          return total
        }

        return (
          total +
          item.product.price *
            item.quantity
        )
      },
      0,
    )

  const hasUnavailableItems =
    items.some(
      (item) =>
        !item.isAvailable,
    )

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
        {mode ===
        'authenticated'
          ? 'Carrinho associado à tua conta.'
          : 'Carrinho guardado neste dispositivo.'}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-950">
            O carrinho está vazio
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Adiciona produtos para
            os veres aqui.
          </p>

          <Link
            href="/"
            className="mt-5 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Ver produtos
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {items.map((item) => {
              const product =
                item.product

              const isPending =
                pendingProductId ===
                (item.productVariantId ??
                  item.productId)

              const canDecrease =
                Boolean(
                  product &&
                    item.inStock &&
                    item.quantity >
                      1,
                )

              return (
                <article
                  key={
                    item.productVariantId ??
                    item.productId
                  }
                  className="rounded-xl border border-gray-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {product ? (
                        <>
                          <Link
                            href={`/produtos/${product.slug}`}
                            className="text-lg font-semibold text-gray-950 hover:underline"
                          >
                            {
                              product.name
                            }
                          </Link>

                          <p className="mt-2 text-sm text-gray-600">
                            Preço unitário:{' '}
                            <span className="font-medium text-gray-950">
                              {formatPrice(
                                product.price,
                              )}
                            </span>
                          </p>
                        </>
                      ) : (
                        <h2 className="text-lg font-semibold text-gray-950">
                          Produto
                          indisponível
                        </h2>
                      )}

                      <div className="mt-3">
                        {!product ||
                        !item.inStock ? (
                          <p className="text-sm font-medium text-red-700">
                            Produto
                            indisponível
                          </p>
                        ) : !item.isAvailable ? (
                          <p className="text-sm font-medium text-amber-700">
                            A quantidade
                            atual é
                            superior ao
                            stock
                            disponível.
                            Reduz a
                            quantidade.
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-green-700">
                            Disponível
                          </p>
                        )}
                      </div>
                    </div>

                    {product ? (
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-sm text-gray-600">
                          Total
                        </p>

                        <p className="mt-1 text-lg font-semibold text-gray-950">
                          {formatPrice(
                            product.price *
                              item.quantity,
                          )}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
                    {product ? (
                      <>
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${product.name}`}
                          disabled={
                            !canDecrease ||
                            isPending
                          }
                          onClick={() =>
                            void changeQuantity(
                              item,
                              item.quantity -
                                1,
                            )
                          }
                          className="h-9 w-9 rounded-md border border-gray-300 text-lg font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          −
                        </button>

                        <span className="min-w-28 text-center text-sm font-medium text-gray-900">
                          Quantidade:{' '}
                          {
                            item.quantity
                          }
                        </span>

                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${product.name}`}
                          disabled={
                            !item.canIncrease ||
                            isPending
                          }
                          onClick={() =>
                            void changeQuantity(
                              item,
                              item.quantity +
                                1,
                            )
                          }
                          className="h-9 w-9 rounded-md border border-gray-300 text-lg font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-gray-600">
                        Quantidade:{' '}
                        {item.quantity}
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        void removeItem(
                          item,
                        )
                      }
                      className="ml-auto text-sm font-semibold text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending
                        ? 'A atualizar...'
                        : 'Remover'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-950">
              Resumo
            </h2>

            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <span className="text-sm text-gray-600">
                Subtotal dos itens
                disponíveis
              </span>

              <strong className="text-lg text-gray-950">
                {formatPrice(
                  subtotal,
                )}
              </strong>
            </div>

            {hasUnavailableItems ? (
              <p className="mt-4 text-sm text-amber-700">
                Existem produtos ou
                quantidades
                indisponíveis no
                carrinho.
              </p>
            ) : null}

            {mode ===
            'authenticated' ? (
              hasUnavailableItems ? (
                <button
                  type="button"
                  disabled
                  className="mt-5 w-full cursor-not-allowed rounded-lg bg-gray-300 px-4 py-3 text-sm font-semibold text-gray-600"
                >
                  Finalizar compra
                </button>
              ) : (
                <Link
                  href="/checkout"
                  className="mt-5 flex w-full items-center justify-center rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Finalizar compra
                </Link>
              )
            ) : (
              <>
                <p className="mt-5 text-sm text-gray-600">
                  Inicia sessão para
                  finalizares a compra.
                </p>

                <Link
                  href="/login?callbackUrl=%2Fcheckout"
                  className="mt-3 flex w-full items-center justify-center rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Iniciar sessão para
                  finalizar compra
                </Link>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
