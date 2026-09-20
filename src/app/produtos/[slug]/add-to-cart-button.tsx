'use client'

import { useState } from 'react'
import {
  addGuestCartItem,
  GuestCartMergePendingError,
} from '@/lib/guest-cart'

type AddToCartButtonProps = {
  productId: string
  inStock: boolean
  variant?: 'default' | 'compact'
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

  return (
    <div
      className={
        isCompact ? '' : 'mt-6'
      }
    >
      <button
        type="button"
        disabled={
          !inStock || isPending
        }
        onClick={handleAddToCart}
        aria-label={
          isCompact
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
            : 'w-full rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
        }
      >
        {isCompact
          ? message
            ? '✓'
            : '+'
          : !inStock
            ? 'Sem stock'
            : isPending
              ? 'A adicionar...'
              : 'Adicionar ao carrinho'}
      </button>

      {message && (
        <p
          role="status"
          className={
            isCompact
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
            isCompact
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
