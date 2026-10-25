'use client'

import Link from 'next/link'
import { useState } from 'react'

type UserRole =
  | 'ADMIN'
  | 'SELLER'
  | 'BUYER'

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'

type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

export type AdminUserOrderSummaryData = {
  id: string
  orderNumber: string
  total: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  createdAt: string
}

export type AdminUserDetailClientData = {
  id: string
  email: string
  name: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
  ordersCount: number
  totalExpenditure: string
  orders: AdminUserOrderSummaryData[]
}

type AdminUserDetailClientProps = {
  initialUser: AdminUserDetailClientData
  currentUserId: string
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SELLER: 'Vendedor',
  BUYER: 'Comprador',
}

const roleOptions = Object.entries(
  roleLabels,
) as Array<[UserRole, string]>

const orderStatusLabels: Record<
  OrderStatus,
  string
> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmada',
  PROCESSING:
    'Em processamento',
  SHIPPED: 'Expedida',
  DELIVERED: 'Entregue',
  READY_FOR_PICKUP:
    'Pronta para levantamento',
  PICKED_UP: 'Levantada',
  CANCELLED: 'Cancelada',
}

const paymentStatusLabels: Record<
  PaymentStatus,
  string
> = {
  PENDING: 'Pendente',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pago',
  FAILED: 'Falhou',
  REFUNDED: 'Reembolsado',
}

function formatMoney(
  value: string,
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(number)
  ) {
    return value
  }

  return `${number.toFixed(2)} €`
}

function formatDate(
  value: string,
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return date.toLocaleString(
    'pt-PT',
  )
}

async function getErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const data =
      (await response.json()) as {
        error?: string
        fieldErrors?: Record<
          string,
          string[]
        >
      }

    if (data.fieldErrors) {
      const firstField =
        Object.values(
          data.fieldErrors,
        )[0]

      if (firstField?.[0]) {
        return firstField[0]
      }
    }

    return (
      data.error ??
      'Não foi possível atualizar o utilizador'
    )
  } catch {
    return 'Não foi possível atualizar o utilizador'
  }
}

export default function UserDetailClient({
  initialUser,
  currentUserId,
}: AdminUserDetailClientProps) {
  const [user, setUser] =
    useState<AdminUserDetailClientData>(
      initialUser,
    )

  const [
    selectedRole,
    setSelectedRole,
  ] = useState<UserRole>(
    initialUser.role,
  )

  const [busy, setBusy] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    success,
    setSuccess,
  ] = useState<string | null>(null)

  const isSelf =
    user.id === currentUserId

  function buildSelfGuard(
    nextRole: UserRole,
    nextIsActive: boolean,
  ) {
    if (
      user.id ===
        currentUserId &&
      ((nextRole !==
        'ADMIN' &&
        nextRole !==
          user.role) ||
        (!nextIsActive &&
          user.isActive))
    ) {
      return 'Não é possível alterar o seu próprio papel ou desativar a sua conta.'
    }

    return null
  }

  async function applyUpdate(
    body:
      | {
          role: UserRole
          isActive?: undefined
        }
      | {
          role?: undefined
          isActive: boolean
        },
  ) {
    if (busy) {
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const response =
        await fetch(
          `/api/admin/users/${user.id}`,
          {
            method: 'PATCH',
            headers: {
              'content-type':
                'application/json',
            },
            body: JSON.stringify(body),
          },
        )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
          ),
        )
      }

      const data =
        (await response.json()) as {
          user: {
            id: string
            email: string
            name: string | null
            role: UserRole
            isActive: boolean
            ordersCount: number
          }
        }

      const updatedUser =
        data.user

      if (
        updatedUser &&
        updatedUser.id ===
          user.id
      ) {
        setUser(
          (
            currentUser,
          ) => {
            const updatedFields =
              body.role !==
              undefined
                ? {
                    role: updatedUser
                      .role,
                  }
                : {
                    isActive:
                      updatedUser.isActive,
                  }

            return {
              ...currentUser,
              ...updatedFields,
            }
          },
        )

        setSelectedRole(
          updatedUser.role,
        )
      }

      setSuccess(
        body.role !== undefined
          ? `Papel atualizado para ${roleLabels[updatedUser.role]}.`
          : updatedUser.isActive
            ? 'Conta ativada.'
            : 'Conta desativada.',
      )
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Não foi possível atualizar o utilizador',
      )
    } finally {
      setBusy(false)
    }
  }

  function handleSaveRole() {
    if (
      selectedRole ===
      user.role
    ) {
      return
    }

    const guard =
      buildSelfGuard(
        selectedRole,
        user.isActive,
      )

    if (guard) {
      setError(guard)

      return
    }

    void applyUpdate({
      role: selectedRole,
    })
  }

  function handleToggleActive() {
    const nextIsActive =
      !user.isActive

    const guard =
      buildSelfGuard(
        user.role,
        nextIsActive,
      )

    if (guard) {
      setError(guard)

      return
    }

    const label =
      user.name ??
      user.email

    const confirmed =
      nextIsActive
        ? window.confirm(
            `Ativar a conta de “${label}”?`,
          )
        : window.confirm(
            `Desativar a conta de “${label}”? O utilizador deixará de conseguir autenticar-se.`,
          )

    if (!confirmed) {
      return
    }

    void applyUpdate({
      isActive: nextIsActive,
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {success}
        </p>
      )}

      <section className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">
              {user.name ??
                'Sem nome'}
            </h2>

            <p className="mt-1 text-sm text-[#687078]">
              {user.email}
            </p>

            <p className="mt-1 text-xs text-[#687078]">
              Registado em{' '}
              {
                formatDate(
                  user.createdAt,
                )
              }
            </p>
          </div>

          <div className="flex gap-2">
            <span className="rounded-md border border-black/12 px-3 py-1.5 text-xs font-bold text-[#171a1d]">
              {
                roleLabels[
                  user.role
                ]
              }
            </span>

            <span
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                user.isActive
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {user.isActive
                ? 'Ativa'
                : 'Inativa'}
            </span>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-black/8 pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
              Encomendas
            </dt>

            <dd className="mt-1 text-lg font-black tabular-nums">
              {
                user.ordersCount
              }
            </dd>
          </div>

          <div>
            <dt className="text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
              Despesa paga
            </dt>

            <dd className="mt-1 text-lg font-black tabular-nums">
              {
                formatMoney(
                  user.totalExpenditure,
                )
              }
            </dd>
          </div>

          <div>
            <dt className="text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
              Papel atual
            </dt>

            <dd className="mt-1 text-lg font-black">
              {
                roleLabels[
                  user.role
                ]
              }
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black">
          Gestão da conta
        </h3>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
            Papel de utilizador
            <select
              value={
                selectedRole
              }
              disabled={busy}
              onChange={(event) => {
                setSelectedRole(
                  event.target
                    .value as
                  UserRole,
                )
                setError(null)
                setSuccess(null)
              }}
              className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#121417]"
            >
              {roleOptions.map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <button
            type="button"
            disabled={
              busy ||
              selectedRole ===
                user.role
            }
            onClick={
              handleSaveRole
            }
            className="rounded-lg bg-[#ef5b2a] px-4 py-2 text-sm font-black text-white transition hover:bg-[#d94a1b] disabled:opacity-50"
          >
            {busy
              ? 'A atualizar...'
              : 'Guardar papel'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={
              handleToggleActive
            }
            className={
              user.isActive
                ? 'rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 transition hover:border-red-400 disabled:opacity-50'
                : 'rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-700 transition hover:border-emerald-400 disabled:opacity-50'
            }
          >
            {busy
              ? 'A atualizar...'
              : user.isActive
                ? 'Desativar conta'
                : 'Ativar conta'}
          </button>
        </div>

        {isSelf && (
          <p className="mt-3 text-xs text-[#687078]">
            Esta é a sua própria
            conta: papel e estado
            não podem ser alterados.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-black/8 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-5 py-4">
          <div>
            <h3 className="font-black">
              Encomendas recentes
            </h3>

            <p className="mt-0.5 text-xs text-[#687078]">
              Últimas 10 encomendas do
              utilizador.
            </p>
          </div>
        </div>

        {user.orders.length ===
        0 ? (
          <p className="p-10 text-center text-sm text-[#687078]">
            Sem encomendas registadas.
          </p>
        ) : (
          <ul className="divide-y divide-black/6">
            {user.orders.map(
              (order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-[#fff8f4]"
                >
                  <div>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-sm font-bold text-[#171a1d] underline"
                    >
                      {
                        order.orderNumber
                      }
                    </Link>

                    <p className="mt-0.5 text-xs text-[#687078]">
                      {
                        formatDate(
                          order.createdAt,
                        )
                      }
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums">
                      {
                        formatMoney(
                          order.total,
                        )
                      }
                    </p>

                    <p className="mt-0.5 text-xs text-[#687078]">
                      {
                        orderStatusLabels[
                          order.status
                        ]
                      }{' '}
                      · Pagamento:{' '}
                      {
                        paymentStatusLabels[
                          order
                            .paymentStatus
                        ]
                      }
                    </p>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
