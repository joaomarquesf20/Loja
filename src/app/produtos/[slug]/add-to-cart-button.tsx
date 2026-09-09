'use client'

import { useState } from 'react'
import {
  addGuestCartItem,
  GuestCartMergePendingError,
} from '@/lib/guest-cart'

type AddToCartButtonProps = {
  productId: string
  inStock: boolean
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

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={
          !inStock || isPending
        }
        onClick={handleAddToCart}
        className="w-full rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {!inStock
          ? 'Sem stock'
          : isPending
            ? 'A adicionar...'
            : 'Adicionar ao carrinho'}
      </button>

      {message && (
        <p
          role="status"
          className="mt-3 text-sm font-medium text-green-700 dark:text-green-400"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm font-medium text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  )
}