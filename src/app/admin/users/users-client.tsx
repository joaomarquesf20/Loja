'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

type UserRole =
  | 'ADMIN'
  | 'SELLER'
  | 'BUYER'

type AdminUser = {
  id: string
  email: string
  name: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
  ordersCount: number
}

const roleLabels:
  Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SELLER: 'Vendedor',
  BUYER: 'Comprador',
}

const roleOptions = Object.entries(
  roleLabels,
) as Array<[UserRole, string]>

const USERS_PAGE_SIZE = 10

function getErrorMessage(
  response: Response,
): Promise<string> {
  return response
    .json()
    .then(
      (data) =>
        (data as { error?: string })
          .error ??
        'Não foi possível carregar os utilizadores',
    )
    .catch(
      () =>
        'Não foi possível carregar os utilizadores',
    )
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

export default function UsersClient() {
  const [
    users,
    setUsers,
  ] = useState<AdminUser[]>(
    [],
  )

  const [loading, setLoading] =
    useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  )

  const [search, setSearch] =
    useState('')

  const [
    roleFilter,
    setRoleFilter,
  ] = useState<
    UserRole | 'all'
  >('all')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    'all' | 'active' | 'inactive'
  >('all')

  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadInitialUsers() {
      try {
        const response =
          await fetch(
            '/api/admin/users',
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
            users: AdminUser[]
          }

        if (!cancelled) {
          setUsers(
            data.users,
          )
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar os utilizadores',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInitialUsers()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredUsers =
    useMemo(() => {
      const query = search
        .trim()
        .toLocaleLowerCase(
          'pt-PT',
        )

      return users.filter((user) => {
        const matchesQuery =
          !query ||
          [
            user.name ?? '',
            user.email,
          ].some((value) =>
            value
              .toLocaleLowerCase('pt-PT')
              .includes(query),
          )

        const matchesRole =
          roleFilter ===
            'all' ||
          user.role ===
            roleFilter

        const matchesStatus =
          statusFilter ===
            'all' ||
          user.isActive ===
            (statusFilter ===
              'active')

        return (
          matchesQuery &&
          matchesRole &&
          matchesStatus
        )
      })
    }, [
      users,
      search,
      roleFilter,
      statusFilter,
    ])

  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredUsers.length /
        USERS_PAGE_SIZE,
    ),
  )

  const currentPage = Math.min(
    page,
    pageCount - 1,
  )

  const pagedUsers =
    filteredUsers.slice(
      currentPage * USERS_PAGE_SIZE,
      (currentPage + 1) *
        USERS_PAGE_SIZE,
    )

  async function refreshUsers() {
    if (refreshing) {
      return
    }

    try {
      setRefreshing(true)

      const response =
        await fetch(
          '/api/admin/users',
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
          users: AdminUser[]
        }

      setUsers(data.users)

      setError(null)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Não foi possível carregar os utilizadores',
      )
    } finally {
      setRefreshing(false)
    }
  }

  function handleClearFilters() {
    setSearch('')
    setRoleFilter('all')
    setStatusFilter('all')
    setPage(0)
  }

  if (loading) {
    return (
      <p className="rounded-lg border border-black/8 bg-white p-5 text-sm text-[#687078]">
        A carregar utilizadores...
      </p>
    )
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

      <section className="grid gap-3 rounded-xl border border-black/8 bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
          Pesquisar
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(
                event.target.value,
              )
              setPage(0)
            }}
            placeholder="Nome ou email"
            className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#121417]"
          />
        </label>

        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
          Papel
          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(
                event.target
                  .value as
                  UserRole | 'all',
              )
              setPage(0)
            }}
            className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#121417]"
          >
            <option value="all">
              Todos
            </option>

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

        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
          Estado da conta
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(
                event.target
                  .value as
                  | 'all'
                  | 'active'
                  | 'inactive',
              )
              setPage(0)
            }}
            className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#121417]"
          >
            <option value="all">
              Todas
            </option>
            <option value="active">
              Ativas
            </option>
            <option value="inactive">
              Inativas
            </option>
          </select>
        </label>
      </section>

      <section className="overflow-hidden rounded-xl border border-black/8 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-5 py-4">
          <div>
            <h2 className="font-black">
              Todas as contas
            </h2>

            <p className="mt-0.5 text-xs text-[#687078]">
              {filteredUsers.length}{' '}
              de {users.length}{' '}
              utilizadores
            </p>
          </div>

          <button
            type="button"
            disabled={
              refreshing ||
              loading
            }
            onClick={() =>
              void refreshUsers()
            }
            className="rounded-md border border-black/12 bg-white px-3 py-1.5 text-sm font-bold transition hover:border-black/30 disabled:opacity-50"
          >
            {refreshing
              ? 'A atualizar...'
              : 'Atualizar'}
          </button>
        </div>

        {filteredUsers.length ===
        0 ? (
          users.length ===
          0 ? (
            <p className="p-10 text-center text-sm text-[#687078]">
              Ainda não existem contas
              registadas.
            </p>
          ) : (
            <div className="p-10 text-center">
              <p className="font-semibold">
                Nenhum utilizador
                corresponde aos filtros
              </p>

              <button
                type="button"
                onClick={
                  handleClearFilters
                }
                className="mt-2 text-sm font-bold text-[#ef5b2a] underline"
              >
                Limpar filtros
              </button>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#f4f4f2] text-xs uppercase tracking-[0.06em] text-[#687078]">
                <tr>
                  <th className="px-4 py-3 font-black">
                    Utilizador
                  </th>

                  <th className="px-4 py-3 font-black">
                    Papel
                  </th>

                  <th className="px-4 py-3 font-black">
                    Estado
                  </th>

                  <th className="px-4 py-3 text-center font-black">
                    Encomendas
                  </th>

                  <th className="px-4 py-3 font-black">
                    Registado em
                  </th>

                  <th className="px-4 py-3 text-right font-black">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/6">
                {pagedUsers.map(
                  (user) => (
                    <tr
                      key={user.id}
                      className="transition hover:bg-[#fff8f4]"
                    >
                      <td className="px-4 py-4">
                        <p className="font-bold">
                          {user.name ??
                            'Sem nome'}
                        </p>

                        <p className="mt-0.5 text-xs text-[#687078]">
                          {
                            user.email
                          }
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        {
                          roleLabels[
                            user.role
                          ]
                        }
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`text-xs font-bold ${
                            user.isActive
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {user.isActive
                            ? 'Ativa'
                            : 'Inativa'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center tabular-nums">
                        {
                          user.ordersCount
                        }
                      </td>

                      <td className="px-4 py-4 text-xs text-[#687078]">
                        {
                          formatDate(
                            user.createdAt,
                          )
                        }
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-sm font-bold text-[#ef5b2a] underline"
                        >
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <nav
            aria-label="Paginação dos utilizadores"
            className="flex items-center justify-between gap-3 border-t border-black/8 px-5 py-3"
          >
            <p className="text-xs font-semibold text-[#687078]">
              Página{' '}
              {currentPage + 1} de{' '}
              {pageCount}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={
                  currentPage === 0
                }
                onClick={() =>
                  setPage(
                    currentPage - 1,
                  )
                }
                className="rounded-md border border-black/12 bg-white px-3 py-1.5 text-sm font-bold transition hover:border-black/30 disabled:opacity-50"
              >
                Anterior
              </button>

              <button
                type="button"
                aria-label="Página seguinte"
                disabled={
                  currentPage >=
                  pageCount - 1
                }
                onClick={() =>
                  setPage(
                    currentPage + 1,
                  )
                }
                className="rounded-md border border-black/12 bg-white px-3 py-1.5 text-sm font-bold transition hover:border-black/30 disabled:opacity-50"
              >
                Seguinte
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  )
}
