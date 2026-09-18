'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  signIn,
  signOut,
  useSession,
} from 'next-auth/react'
import {
  useState,
  type FormEvent,
} from 'react'
import {
  completeGuestCartMerge,
  discardGuestCartMergeAttempt,
  getOrCreateGuestCartMergeAttempt,
} from '@/lib/guest-cart'

type CartMergeErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'INVALID_MERGE_KEY'
  | 'INVALID_ITEM'
  | 'INVALID_PRODUCT'
  | 'INVALID_QUANTITY'
  | 'GUEST_CART_VALIDATION'
  | 'CART_VALIDATION'
  | 'USER_UNAVAILABLE'
  | 'MERGE_CONFLICT'
  | 'PRODUCT_UNAVAILABLE'
  | 'INSUFFICIENT_STOCK'
  | 'INTERNAL_ERROR'

const DISCARDABLE_MERGE_ERROR_CODES =
  new Set<CartMergeErrorCode>([
    'UNAUTHENTICATED',
    'INVALID_JSON',
    'INVALID_REQUEST',
    'INVALID_MERGE_KEY',
    'INVALID_ITEM',
    'INVALID_PRODUCT',
    'INVALID_QUANTITY',
    'GUEST_CART_VALIDATION',
    'CART_VALIDATION',
    'USER_UNAVAILABLE',
    'PRODUCT_UNAVAILABLE',
    'INSUFFICIENT_STOCK',
  ])

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isCartMergeErrorCode(
  value: unknown,
): value is CartMergeErrorCode {
  return (
    typeof value === 'string' &&
    [
      'UNAUTHENTICATED',
      'INVALID_JSON',
      'INVALID_REQUEST',
      'INVALID_MERGE_KEY',
      'INVALID_ITEM',
      'INVALID_PRODUCT',
      'INVALID_QUANTITY',
      'GUEST_CART_VALIDATION',
      'CART_VALIDATION',
      'USER_UNAVAILABLE',
      'MERGE_CONFLICT',
      'PRODUCT_UNAVAILABLE',
      'INSUFFICIENT_STOCK',
      'INTERNAL_ERROR',
    ].includes(value)
  )
}

async function readMergeErrorCode(
  response: Response,
): Promise<CartMergeErrorCode | null> {
  try {
    const body: unknown =
      await response.json()

    if (
      !isRecord(body) ||
      !isCartMergeErrorCode(
        body.code,
      )
    ) {
      return null
    }

    return body.code
  } catch {
    return null
  }
}

function getMergeErrorMessage(
  code: CartMergeErrorCode | null,
) {
  if (
    code === 'INSUFFICIENT_STOCK'
  ) {
    return 'Não foi possível juntar o carrinho porque já não existe stock suficiente. O carrinho de convidado foi preservado.'
  }

  if (
    code === 'PRODUCT_UNAVAILABLE'
  ) {
    return 'Não foi possível juntar o carrinho porque um dos produtos deixou de estar disponível. O carrinho de convidado foi preservado.'
  }

  if (
    code === 'USER_UNAVAILABLE'
  ) {
    return 'A tua conta deixou de estar disponível. O carrinho de convidado foi preservado.'
  }

  if (
    code === 'MERGE_CONFLICT'
  ) {
    return 'Não foi possível confirmar com segurança a fusão do carrinho. O carrinho foi preservado para evitar duplicações. Tenta iniciar sessão novamente.'
  }

  if (
    code === 'INTERNAL_ERROR' ||
    code === null
  ) {
    return 'Não foi possível confirmar a fusão do carrinho. O carrinho foi preservado para evitar duplicações. Tenta iniciar sessão novamente.'
  }

  return 'Não foi possível juntar o carrinho à conta. O carrinho de convidado foi preservado.'
}

function getSafeCallbackUrl() {
  if (
    typeof window === 'undefined'
  ) {
    return '/'
  }

  const callbackUrl =
    new URLSearchParams(
      window.location.search,
    ).get('callbackUrl')

  if (
    !callbackUrl ||
    !callbackUrl.startsWith('/') ||
    callbackUrl.startsWith('//') ||
    callbackUrl.includes('\\')
  ) {
    return '/'
  }

  try {
    const parsed = new URL(
      callbackUrl,
      window.location.origin,
    )

    if (
      parsed.origin !==
      window.location.origin
    ) {
      return '/'
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/'
  }
}

export default function LoginPage() {
  const router = useRouter()

  const {
    data: session,
    status,
    update,
  } = useSession()

  const [email, setEmail] =
    useState('')

  const [
    password,
    setPassword,
  ] = useState('')

  const [error, setError] =
    useState<string | null>(null)

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setError(null)
    setIsSubmitting(true)

    const callbackUrl =
      getSafeCallbackUrl()

    let signedIn = false

    try {
      const result =
        await signIn(
          'credentials',
          {
            email,
            password,
            redirect: false,
          },
        )

      if (
        !result ||
        result.error
      ) {
        setError(
          'Email ou password inválidos.',
        )
        return
      }

      signedIn = true

      const mergeAttempt =
        getOrCreateGuestCartMergeAttempt()

      if (mergeAttempt) {
        let response: Response

        try {
          response = await fetch(
            '/api/cart/merge',
            {
              method: 'POST',
              headers: {
                'content-type':
                  'application/json',
              },
              body: JSON.stringify({
                mergeKey:
                  mergeAttempt.mergeKey,
                items:
                  mergeAttempt.items,
              }),
            },
          )
        } catch {
          await signOut({
            redirect: false,
          })

          signedIn = false

          setError(
            'Não foi possível confirmar a fusão do carrinho. O carrinho foi preservado para evitar duplicações. Tenta iniciar sessão novamente.',
          )

          return
        }

        if (!response.ok) {
          const code =
            await readMergeErrorCode(
              response,
            )

          await signOut({
            redirect: false,
          })

          signedIn = false

          if (
            code &&
            DISCARDABLE_MERGE_ERROR_CODES.has(
              code,
            )
          ) {
            discardGuestCartMergeAttempt(
              mergeAttempt.mergeKey,
            )
          }

          setError(
            getMergeErrorMessage(code),
          )

          return
        }

        completeGuestCartMerge(
          mergeAttempt.mergeKey,
        )
      }

      await update()

      router.replace(callbackUrl)
      router.refresh()
    } catch {
      if (signedIn) {
        try {
          await signOut({
            redirect: false,
          })
        } catch {
          // A tentativa de merge mantém-se
          // quando o estado não pode ser
          // confirmado com segurança.
        }
      }

      setError(
        'Não foi possível iniciar sessão.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A verificar sessão…
        </p>
      </main>
    )
  }

  if (
    status === 'authenticated'
  ) {
    const accountLabel =
      session.user.name?.trim() ||
      session.user.email?.trim() ||
      'a tua conta'

    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-xl border p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Sessão iniciada
          </h1>

          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Já tens sessão iniciada
            como{' '}
            <span className="font-semibold text-foreground">
              {accountLabel}
            </span>
            .
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-lg border px-4 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
          >
            Voltar à loja
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-md">
        <Link
          href="/"
          className="text-sm font-medium hover:underline"
        >
          ← Voltar à loja
        </Link>

        <div className="mt-6 rounded-xl border p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Entrar
          </h1>

          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Inicia sessão na tua conta
            PFAUTOPARTS.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
          >
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-semibold"
              >
                Email
              </label>

              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                required
                disabled={
                  isSubmitting
                }
                className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-semibold"
              >
                Password
              </label>

              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                required
                disabled={
                  isSubmitting
                }
                className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting
              }
              className="w-full rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-neutral-900"
            >
              {isSubmitting
                ? 'A entrar…'
                : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
            Não tens conta?{' '}
            <Link
              href="/registar"
              className="font-semibold text-foreground hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
