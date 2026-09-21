'use client'

import { useState } from 'react'
import {
  addGuestCartItem,
  GuestCartMergePendingError,
} from '@/lib/guest-cart'

type AddToCartButtonProps = {
  productId: string
  inStock: boolean
  variant?:
    | 'default'
    | 'compact'
    | 'card'
    | 'product'
}

function isErrorResponse(
  value: unknown,
): value is {
  error: string
} {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }

  const record =
    value as Record<string, unknown>

  return typeof record.error === 'string'
}

async function getErrorMessage(
  response: Response,
) {
  try {
    const body: unknown =
      await response.json()

    if (isErrorResponse(body)) {
      return body.error
    }
  } catch {
    // Resposta sem JSON válido.
  }

  return 'Não foi possível adicionar o produto ao carrinho'
}

export default function AddToCartButton({
  productId,
  inStock,
  variant = 'default',
}: AddToCartButtonProps) {
  const [isPending, setIsPending] =
    useState(false)

  const [quantity, setQuantity] =
    useState(1)

  const [message, setMessage] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  const isCompact =
    variant === 'compact'

  const isCard =
    variant === 'card'

  const isProduct =
    variant === 'product'

  const requestedQuantity =
    isProduct ? quantity : 1

  async function handleAddToCart() {
    if (!inStock || isPending) {
      return
    }

    setIsPending(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch(
        '/api/cart',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            productId,
            quantity:
              requestedQuantity,
          }),
        },
      )

      if (response.status === 401) {
        addGuestCartItem(
          productId,
          requestedQuantity,
        )

        setMessage(
          'Produto adicionado ao carrinho neste dispositivo.',
        )

        return
      }

      if (!response.ok) {
        setError(
          await getErrorMessage(
            response,
          ),
        )

        return
      }

      setMessage(
        'Produto adicionado ao carrinho.',
      )
    } catch (caughtError) {
      if (
        caughtError instanceof
        GuestCartMergePendingError
      ) {
        setError(
          caughtError.message,
        )

        return
      }

      setError(
        'Não foi possível adicionar o produto ao carrinho',
      )
    } finally {
      setIsPending(false)
    }
  }

  function updateQuantity(
    nextQuantity: number,
  ) {
    if (
      Number.isSafeInteger(
        nextQuantity,
      ) &&
      nextQuantity > 0
    ) {
      setQuantity(nextQuantity)
      setMessage(null)
      setError(null)
    }
  }

  const button = (
    <button
      type="button"
      disabled={!inStock || isPending}
      onClick={handleAddToCart}
      aria-label={
        isCompact ||
        isCard ||
        isProduct
          ? !inStock
            ? 'Produto sem stock'
            : isPending
              ? 'A adicionar ao carrinho'
              : 'Adicionar ao carrinho'
          : undefined
      }
      title={
        isCompact
          ? 'Adicionar ao carrinho'
          : undefined
      }
      className={
        isCompact
          ? 'grid size-8 place-items-center rounded-sm bg-brand text-sm font-black text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/25'
          : isCard
            ? 'inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-sm bg-brand px-3 py-2 text-[10px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/25'
            : isProduct
              ? 'inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-sm bg-brand px-5 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/25'
              : 'w-full rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
      }
    >
      {isCompact ? (
        message ? '✓' : '+'
      ) : isCard || isProduct ? (
        <>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
          >
            <path
              d="M3.5 5h2l1.7 9h9.9l2-6.5H7M9 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <span>
            {!inStock
              ? 'Sem stock'
              : isPending
                ? 'A adicionar…'
                : message
                  ? 'Adicionado'
                  : isProduct
                    ? 'Adicionar ao carrinho'
                    : 'Adicionar'}
          </span>
        </>
      ) : !inStock
        ? 'Sem stock'
        : isPending
          ? 'A adicionar...'
          : 'Adicionar ao carrinho'}
    </button>
  )

  return (
    <div
      className={
        isCompact ||
        isCard ||
        isProduct
          ? ''
          : 'mt-6'
      }
    >
      {isProduct ? (
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
          <div>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.1em] text-white/34">
              Quantidade
            </span>

            <div className="grid h-12 grid-cols-[2.25rem_1fr_2.25rem] overflow-hidden rounded-sm border border-white/10 bg-[#15181b]">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                disabled={quantity <= 1}
                onClick={() =>
                  updateQuantity(
                    quantity - 1,
                  )
                }
                className="text-lg text-white/48 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:text-white/14"
              >
                −
              </button>

              <input
                aria-label="Quantidade"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) =>
                  updateQuantity(
                    Number(
                      event.target.value,
                    ),
                  )
                }
                className="min-w-0 border-x border-white/8 bg-transparent text-center text-sm font-black text-white outline-none"
              />

              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() =>
                  updateQuantity(
                    quantity + 1,
                  )
                }
                className="text-lg text-white/48 transition hover:bg-white/5 hover:text-white"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-end">
            {button}
          </div>
        </div>
      ) : (
        button
      )}

      {message && (
        <p
          role="status"
          className={
            isCompact || isCard
              ? 'sr-only'
              : isProduct
                ? 'mt-3 text-sm font-semibold text-green-400'
                : 'mt-3 text-sm font-medium text-green-700 dark:text-green-400'
          }
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className={
            isCompact || isCard
              ? 'sr-only'
              : isProduct
                ? 'mt-3 text-sm font-semibold text-red-400'
                : 'mt-3 text-sm font-medium text-red-700 dark:text-red-400'
          }
        >
          {error}
        </p>
      )}
    </div>
  )
}
