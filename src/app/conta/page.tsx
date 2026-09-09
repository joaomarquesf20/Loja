'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function AccountPage() {
  const {
    data: session,
    status,
  } = useSession()

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
    status !== 'authenticated' ||
    !session?.user
  ) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-xl border p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Inicia sessão
          </h1>

          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Precisas de iniciar sessão
            para aceder à tua conta.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex rounded-lg border px-4 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
          >
            Entrar
          </Link>
        </section>
      </main>
    )
  }

  const name =
    session.user.name?.trim() || null

  const email =
    session.user.email?.trim() || null

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
            A minha conta
          </h1>

          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Dados associados à tua
            sessão atual.
          </p>

          <dl className="mt-6 space-y-4">
            <div>
              <dt className="text-sm font-semibold">
                Nome
              </dt>

              <dd className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {name ?? 'Não definido'}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-semibold">
                Email
              </dt>

              <dd className="mt-1 break-all text-sm text-neutral-600 dark:text-neutral-400">
                {email ?? 'Não definido'}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/carrinho"
              className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
            >
              Ver carrinho
            </Link>

            <Link
              href="/"
              className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
            >
              Continuar a comprar
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
