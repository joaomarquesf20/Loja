'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import {
  getCallbackHref,
  getSafeCallbackUrl,
} from '@/lib/safe-callback-url'

type RegistrationErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'INVALID_NAME'
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INTERNAL_ERROR'

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isRegistrationErrorCode(
  value: unknown,
): value is RegistrationErrorCode {
  return (
    typeof value === 'string' &&
    [
      'INVALID_JSON',
      'INVALID_REQUEST',
      'INVALID_NAME',
      'INVALID_EMAIL',
      'INVALID_PASSWORD',
      'EMAIL_ALREADY_REGISTERED',
      'INTERNAL_ERROR',
    ].includes(value)
  )
}

async function readRegistrationErrorCode(
  response: Response,
): Promise<RegistrationErrorCode | null> {
  try {
    const body: unknown =
      await response.json()

    if (
      !isRecord(body) ||
      !isRegistrationErrorCode(
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

function getRegistrationErrorMessage(
  code: RegistrationErrorCode | null,
) {
  if (code === 'INVALID_NAME') {
    return 'Introduz um nome válido.'
  }

  if (code === 'INVALID_EMAIL') {
    return 'Introduz um email válido.'
  }

  if (
    code === 'INVALID_PASSWORD'
  ) {
    return 'A palavra-passe deve ter pelo menos 8 caracteres.'
  }

  if (
    code ===
    'EMAIL_ALREADY_REGISTERED'
  ) {
    return 'Já existe uma conta com este email.'
  }

  if (
    code === 'INVALID_JSON' ||
    code === 'INVALID_REQUEST'
  ) {
    return 'Não foi possível processar os dados do registo.'
  }

  return 'Não foi possível criar a conta. Tenta novamente.'
}

function readSafeCallbackUrl() {
  if (
    typeof window === 'undefined'
  ) {
    return '/'
  }

  return getSafeCallbackUrl(
    new URLSearchParams(
      window.location.search,
    ).get('callbackUrl'),
    window.location.origin,
  )
}

function subscribeToHydration() {
  return () => {}
}

function getHydratedSnapshot() {
  return true
}

function getServerHydratedSnapshot() {
  return false
}

export default function RegisterPage() {
  const {
    data: session,
    status,
  } = useSession()

  const [name, setName] =
    useState('')

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

  const [
    isCreated,
    setIsCreated,
  ] = useState(false)

  const isHydrated =
    useSyncExternalStore(
      subscribeToHydration,
      getHydratedSnapshot,
      getServerHydratedSnapshot,
    )

  const loginHref = isHydrated
    ? getCallbackHref(
        '/login',
        readSafeCallbackUrl(),
      )
    : '/login'

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      isSubmitting ||
      isCreated
    ) {
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      let response: Response

      try {
        response = await fetch(
          '/api/auth/register',
          {
            method: 'POST',
            headers: {
              'content-type':
                'application/json',
            },
            body: JSON.stringify({
              name,
              email,
              password,
            }),
          },
        )
      } catch {
        setError(
          'Não foi possível criar a conta. Tenta novamente.',
        )

        return
      }

      if (!response.ok) {
        const code =
          await readRegistrationErrorCode(
            response,
          )

        setError(
          getRegistrationErrorMessage(
            code,
          ),
        )

        return
      }

      setPassword('')
      setIsCreated(true)
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

  if (isCreated) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-xl border p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Conta criada com sucesso
          </h1>

          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            A tua conta foi criada.
            Inicia sessão para continuar.
          </p>

          <Link
            href={loginHref}
            className="mt-6 inline-flex rounded-lg border px-4 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
          >
            Entrar
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
            Criar conta
          </h1>

          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Cria a tua conta de cliente
            PFAUTOPARTS.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={handleSubmit}
          >
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium"
              >
                Nome
              </label>

              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                disabled={
                  isSubmitting
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-neutral-800"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium"
              >
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                disabled={
                  isSubmitting
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-neutral-800"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                disabled={
                  isSubmitting
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-neutral-800"
              />

              <p className="mt-1 text-xs text-neutral-500">
                Mínimo de 8 caracteres.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm text-red-700 dark:text-red-400"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting
              }
              className="w-full rounded-lg border px-4 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-neutral-900"
            >
              {isSubmitting
                ? 'A criar conta…'
                : 'Criar conta'}
            </button>
          </form>

          <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
            Já tens conta?{' '}
            <Link
              href={loginHref}
              className="font-semibold text-foreground hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
