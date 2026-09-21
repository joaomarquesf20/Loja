'use client'

import { useState } from 'react'
import {
  addGuestCartItem,
  GuestCartMergePendingError,
} from '@/lib/guest-cart'

type AddToCartButtonProps = {
  productId: string
  inStock: boolean
  variant?: 'default' | 'compact' | 'card'
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

  const [message, setMessage] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

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
            quantity: 1,
          }),
        },
      )

      if (response.status === 401) {
        addGuestCartItem(
          productId,
          1,
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

  const isCompact =
    variant === 'compact'

  const isCard =
    variant === 'card'

  return (
    <div
      className={
        isCompact || isCard
          ? ''
          : 'mt-6'
      }
    >
      <button
        type="button"
        disabled={
          !inStock || isPending
        }
        onClick={handleAddToCart}
        aria-label={
          isCompact || isCard
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
              : 'w-full rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
        }
      >
        {isCompact ? (
          message ? '✓' : '+'
        ) : isCard ? (
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
                    : 'Adicionar'}
            </span>
          </>
        ) : !inStock
          ? 'Sem stock'
          : isPending
            ? 'A adicionar...'
            : 'Adicionar ao carrinho'}
      </button>

      {message && (
        <p
          role="status"
          className={
            isCompact || isCard
              ? 'sr-only'
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
              : 'mt-3 text-sm font-medium text-red-700 dark:text-red-400'
          }
        >
          {error}
        </p>
      )}
    </div>
  )
}
