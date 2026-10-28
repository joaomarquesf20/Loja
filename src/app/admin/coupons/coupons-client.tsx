'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  AdminCouponRow,
  AdminCouponStatus,
  AdminCouponsPage,
  CouponDiscountType,
} from '@/server/coupons'

const COUPONS_PAGE_SIZE = 20

const ADMIN_COUPON_LIST_PAGE_SIZE = 1000

type Notice = {
  type: 'success' | 'error'
  message: string
}

const statusLabels: Record<
  AdminCouponStatus,
  string
> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  EXPIRED: 'Expirado',
  LIMIT_REACHED:
    'Limite atingido',
}

const statusBadgeClasses: Record<
  AdminCouponStatus,
  string
> = {
  ACTIVE:
    'bg-green-100 text-green-800',
  INACTIVE:
    'bg-gray-100 text-gray-800',
  EXPIRED:
    'bg-red-100 text-red-800',
  LIMIT_REACHED:
    'bg-amber-100 text-amber-800',
}

const discountTypeOptions: Array<{
  value: CouponDiscountType
  label: string
}> = [
  {
    value: 'PERCENTAGE',
    label: 'Percentagem (%)',
  },
  {
    value: 'FIXED_AMOUNT',
    label: 'Valor fixo (€)',
  },
]

async function getErrorMessage(
  response: Response,
) {
  const body =
    (await response
      .json()
      .catch(() => null)) as
    | {
        error?: string
        fieldErrors?: Record<
          string,
          string[]
        >
      }
    | null

  const base =
    body?.error ??
    'Erro inesperado'

  const fieldErrors =
    body?.fieldErrors

  if (fieldErrors) {
    const firstKey =
      Object.keys(
        fieldErrors,
      )[0]

    const messages =
      fieldErrors[
        firstKey
      ]

    if (
      Array.isArray(
        messages,
      ) &&
      messages.length > 0
    ) {
      return `${base} (${messages[0]})`
    }
  }

  return base
}

function formatDate(
  iso: string | null,
) {
  if (!iso) {
    return '—'
  }

  const date =
    new Date(iso)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—'
  }

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  return `${day}/${month}/${date.getFullYear()}`
}

function formatDiscount(
  row: AdminCouponRow,
) {
  return row.discountType ===
    'PERCENTAGE'
    ? `${row.discountValue}%`
    : `${row.discountValue.toFixed(2)} €`
}

function formatUses(
  row: AdminCouponRow,
) {
  return row.maxUses ===
    null
    ? `${row.usedCount} / ilimitado`
    : `${row.usedCount} / ${row.maxUses}`
}

function formatDateWindow(
  row: AdminCouponRow,
) {
  return `${formatDate(
    row.startsAt,
  )} → ${formatDate(
    row.expiresAt,
  )}`
}

/**
 * Gestão de cupões (Épico 7 — etapa 2): KPIs de topo (Total de cupões,
 * Ativos, Utilizações totais), formulário de criação, pesquisa rápida +
 * filtro de estado e tabela com badges e toggles de ativação.
 *
 * A listagem chega do serviço com o estado já derivado; a pesquisa e o
 * filtro correm no cliente sobre a página carregada (padrão da vista de
 * inventário) e o toggle reutiliza `PATCH /api/admin/coupons/[id]`
 * recarregando a vista para os KPIs refletirem a alteração.
 */
export default function CouponsClient() {
  const [
    overview,
    setOverview,
  ] = useState<AdminCouponsPage | null>(
    null,
  )

  const [loading, setLoading] =
    useState(true)

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  )

  const [
    notice,
    setNotice,
  ] = useState<Notice | null>(
    null,
  )

  const [search, setSearch] =
    useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    AdminCouponStatus | 'ALL'
  >('ALL')

  const [page, setPage] = useState(0)

  // Formulário de criação.
  const [codeDraft, setCodeDraft] =
    useState('')

  const [
    discountTypeDraft,
    setDiscountTypeDraft,
  ] =
    useState<CouponDiscountType>(
      'PERCENTAGE',
    )

  const [
    discountValueDraft,
    setDiscountValueDraft,
  ] = useState('')

  const [
    minOrderValueDraft,
    setMinOrderValueDraft,
  ] = useState('')

  const [
    maxUsesDraft,
    setMaxUsesDraft,
  ] = useState('')

  const [
    startsAtDraft,
    setStartsAtDraft,
  ] = useState('')

  const [
    expiresAtDraft,
    setExpiresAtDraft,
  ] = useState('')

  const [
    creatingCoupon,
    setCreatingCoupon,
  ] = useState(false)

  const [
    togglingCouponId,
    setTogglingCouponId,
  ] = useState<string | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    async function loadCoupons() {
      setLoading(true)

      setLoadError(null)

      try {
        const response =
          await fetch(
            `/api/admin/coupons?pageSize=${ADMIN_COUPON_LIST_PAGE_SIZE}`,
          )

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
            ),
          )
        }

        const data =
          (await response.json()) as
            | AdminCouponsPage
            | null

        if (cancelled) {
          return
        }

        if (!data) {
          throw new Error(
            'Não foi possível carregar os cupões',
          )
        }

        setOverview(data)
      } catch (loadError) {
        if (!cancelled) {
          setLoadError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar os cupões',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCoupons()

    return () => {
      cancelled = true
    }
  }, [])

  async function refreshCoupons() {
    if (loading) {
      return
    }

    try {
      const response =
        await fetch(
          `/api/admin/coupons?pageSize=${ADMIN_COUPON_LIST_PAGE_SIZE}`,
        )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
          ),
        )
      }

      const data =
        (await response.json()) as
          | AdminCouponsPage
          | null

      if (!data) {
        throw new Error(
          'Não foi possível carregar os cupões',
        )
      }

      setOverview(data)
    } catch (refreshError) {
      setNotice({
        type: 'error',
        message:
          refreshError instanceof
          Error
            ? refreshError.message
            : 'Não foi possível carregar os cupões',
      })
    }
  }

  function resetCreateForm() {
    setCodeDraft('')

    setDiscountTypeDraft(
      'PERCENTAGE',
    )

    setDiscountValueDraft('')

    setMinOrderValueDraft('')

    setMaxUsesDraft('')

    setStartsAtDraft('')

    setExpiresAtDraft('')
  }

  async function handleCreate() {
    const code =
      codeDraft.trim()
      .toUpperCase()

    const discountValue =
      Number(
        discountValueDraft
          .trim()
          .replace(',', '.'),
      )

    if (!code) {
      setNotice({
        type: 'error',
        message:
          'Introduz o código do cupão antes de criar.',
      })

      return
    }

    if (
      !Number.isFinite(
        discountValue,
      ) ||
      discountValue <= 0
    ) {
      setNotice({
        type: 'error',
        message:
          'Introduz um valor de desconto superior a zero.',
      })

      return
    }

    if (creatingCoupon) {
      return
    }

    setCreatingCoupon(
      true,
    )

    setNotice(null)

    try {
      const response =
        await fetch(
          '/api/admin/coupons',
          {
            method:
              'POST',
            headers: {
              'content-type':
                'application/json',
            },
            body: JSON.stringify(
              {
                code,
                discountType:
                  discountTypeDraft,
                discountValue,
                minOrderValue:
                  minOrderValueDraft.trim() ===
                  ''
                    ? null
                    : Number(
                        minOrderValueDraft
                          .trim()
                          .replace(
                            ',',
                            '.',
                          ),
                      ),
                maxUses:
                  maxUsesDraft.trim() ===
                  ''
                    ? null
                    : Number(
                        maxUsesDraft.trim(),
                      ),
                startsAt:
                  startsAtDraft.trim() ===
                  ''
                    ? null
                    : `${startsAtDraft.trim()}T00:00:00.000Z`,
                expiresAt:
                  expiresAtDraft.trim() ===
                  ''
                    ? null
                    : `${expiresAtDraft.trim()}T23:59:59.999Z`,
              },
            ),
          },
        )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
          ),
        )
      }

      const result =
        (await response.json()) as
          | AdminCouponRow
          | null

      if (!result) {
        throw new Error(
          'Não foi possível criar o cupão',
        )
      }

      setNotice({
        type: 'success',
        message: `Cupão ${result.code} criado.`,
      })

      resetCreateForm()

      await refreshCoupons()
    } catch (createError) {
      setNotice({
        type: 'error',
        message:
          createError instanceof Error
            ? createError.message
            : 'Não foi possível criar o cupão.',
      })
    } finally {
      setCreatingCoupon(
        false,
      )
    }
  }

  async function handleToggle(
    row: AdminCouponRow,
  ) {
    if (togglingCouponId) {
      return
    }

    setTogglingCouponId(
      row.id,
    )

    setNotice(null)

    try {
      const response =
        await fetch(
          `/api/admin/coupons/${row.id}`,
          {
            method:
              'PATCH',
            headers: {
              'content-type':
                'application/json',
            },
            body: JSON.stringify({
              isActive:
                !row.isActive,
            }),
          },
        )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
          ),
        )
      }

      setNotice({
        type: 'success',
        message: row.isActive
          ? `Cupão ${row.code} desativado.`
          : `Cupão ${row.code} ativado.`,
      })

      await refreshCoupons()
    } catch (toggleError) {
      setNotice({
        type: 'error',
        message:
          toggleError instanceof Error
            ? toggleError.message
            : 'Não foi possível alterar o estado do cupão.',
      })
    } finally {
      setTogglingCouponId(
        null,
      )
    }
  }

  function handleClearFilters() {
    setSearch('')

    setStatusFilter('ALL')

    setPage(0)
  }

  const filteredCoupons =
    useMemo(() => {
      const query = search
        .trim()
        .toLocaleUpperCase(
          'pt-PT',
        )

      const coupons =
        overview?.coupons ?? []

      if (
        !query &&
        statusFilter ===
          'ALL'
      ) {
        return coupons
      }

      return coupons.filter(
        (row) => {
          const matchesQuery =
            !query ||
            row.code.includes(
              query,
            )

          const matchesStatus =
            statusFilter ===
              'ALL' ||
            row.status ===
              statusFilter

          return (
            matchesQuery &&
            matchesStatus
          )
        },
      )
    }, [
      overview,
      search,
      statusFilter,
    ])

  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredCoupons.length /
        COUPONS_PAGE_SIZE,
    ),
  )

  const currentPage = Math.min(
    page,
    pageCount - 1,
  )

  const pageRows =
    filteredCoupons.slice(
      currentPage *
        COUPONS_PAGE_SIZE,
      (currentPage + 1) *
        COUPONS_PAGE_SIZE,
    )

  if (
    loading &&
    !overview
  ) {
    return (
      <p
        role="status"
        className="rounded-lg border p-6 text-sm text-gray-700"
      >
        A carregar cupões...
      </p>
    )
  }

  if (
    loadError &&
    !overview
  ) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
      >
        {loadError}
      </div>
    )
  }

  if (!overview) {
    return null
  }

  const kpis = overview.kpis

  return (
    <div className="space-y-6">
      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          {loadError}
        </div>
      )}

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-5">
          <dt className="text-xs font-black uppercase tracking-[0.08em] text-gray-600">
            Total de cupões
          </dt>

          <dd className="mt-2 text-3xl font-black text-gray-900">
            {kpis.totalCoupons}
          </dd>

          <p className="mt-1 text-xs text-gray-600">
            Todos os cupões registados na
            loja.
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <dt className="text-xs font-black uppercase tracking-[0.08em] text-gray-600">
            Ativos
          </dt>

          <dd className="mt-2 text-3xl font-black text-green-700">
            {kpis.activeCoupons}
          </dd>

          <p className="mt-1 text-xs text-gray-600">
            Disponíveis no checkout
            neste momento.
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <dt className="text-xs font-black uppercase tracking-[0.08em] text-gray-600">
            Utilizações totais
          </dt>

          <dd className="mt-2 text-3xl font-black text-blue-700">
            {kpis.totalUses}
          </dd>

          <p className="mt-1 text-xs text-gray-600">
            Aplicações de cupões em
            encomendas criadas.
          </p>
        </div>
      </dl>

      <section className="rounded-lg border p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.08em] text-gray-600">
          Criar cupão
        </h2>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()

            void handleCreate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="coupon-code"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Código
            </label>

            <input
              id="coupon-code"
              type="text"
              value={codeDraft}
              onChange={(event) =>
                setCodeDraft(
                  event.target
                    .value,
                )
              }
              placeholder="PROMO10"
              className="rounded border border-gray-300 px-3 py-2 text-sm uppercase"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="coupon-discount-type"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Tipo de desconto
            </label>

            <select
              id="coupon-discount-type"
              value={
                discountTypeDraft
              }
              onChange={(event) =>
                setDiscountTypeDraft(
                  event.target
                    .value as
                  CouponDiscountType,
                )
              }
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {discountTypeOptions.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="coupon-discount-value"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Valor do desconto
            </label>

            <input
              id="coupon-discount-value"
              type="number"
              min={0}
              step={0.01}
              value={
                discountValueDraft
              }
              onChange={(event) =>
                setDiscountValueDraft(
                  event.target
                    .value,
                )
              }
              placeholder="10"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="coupon-min-order-value"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Subtotal mínimo (€)
            </label>

            <input
              id="coupon-min-order-value"
              type="number"
              min={0}
              step={0.01}
              value={
                minOrderValueDraft
              }
              onChange={(event) =>
                setMinOrderValueDraft(
                  event.target
                    .value,
                )
              }
              placeholder="Opcional"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="coupon-max-uses"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Limite de utilizações
            </label>

            <input
              id="coupon-max-uses"
              type="number"
              min={1}
              step={1}
              value={maxUsesDraft}
              onChange={(event) =>
                setMaxUsesDraft(
                  event.target
                    .value,
                )
              }
              placeholder="Opcional"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="coupon-starts-at"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Início (opcional)
            </label>

            <input
              id="coupon-starts-at"
              type="date"
              value={startsAtDraft}
              onChange={(event) =>
                setStartsAtDraft(
                  event.target
                    .value,
                )
              }
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="coupon-expires-at"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Fim (opcional)
            </label>

            <input
              id="coupon-expires-at"
              type="date"
              value={
                expiresAtDraft
              }
              onChange={(event) =>
                setExpiresAtDraft(
                  event.target
                    .value,
                )
              }
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={
                creatingCoupon
              }
              className="rounded bg-black px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingCoupon
                ? 'A criar...'
                : 'Criar cupão'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label
              htmlFor="coupons-search"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Pesquisar por código
            </label>

            <input
              id="coupons-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value,
                )

                setPage(0)
              }}
              placeholder="PROMO10"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm sm:w-64"
            />

            <label
              htmlFor="coupons-status"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Estado
            </label>

            <select
              id="coupons-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target
                    .value as
                  AdminCouponStatus,
                )

                setPage(0)
              }}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="ALL">
                Todos os estados
              </option>

              <option value="ACTIVE">
                Ativo
              </option>

              <option value="INACTIVE">
                Inativo
              </option>

              <option value="EXPIRED">
                Expirado
              </option>

              <option value="LIMIT_REACHED">
                Limite atingido
              </option>
            </select>
          </div>
        </div>

        {notice && (
          <div
            role={
              notice.type ===
              'error'
                ? 'alert'
                : 'status'
            }
            className={`mt-4 rounded border p-3 text-sm ${
              notice.type === 'error'
                ? 'border-red-300 bg-red-50 text-red-800'
                : 'border-green-300 bg-green-50 text-green-800'
            }`}
          >
            {notice.message}
          </div>
        )}

        <p className="mt-4 text-sm text-gray-600">
          {filteredCoupons.length}{' '}
          de{' '}
          {overview.coupons.length}{' '}
          cupões
        </p>

        {pageRows.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Sem cupões para os
              filtros aplicados.
            </p>

            <button
              type="button"
              onClick={
                handleClearFilters
              }
              className="mt-2 text-sm font-bold underline"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-[0.08em] text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-bold">
                    Código
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Desconto
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Utilizações
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Validade
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Estado
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {pageRows.map(
                  (row) => (
                    <tr
                      key={
                        row.id
                      }
                    >
                      <td className="px-4 py-3 font-mono text-xs uppercase">
                        {
                          row.code
                        }
                      </td>

                      <td className="px-4 py-3 tabular-nums">
                        {
                          formatDiscount(
                            row,
                          )
                        }
                      </td>

                      <td className="px-4 py-3 tabular-nums">
                        {
                          formatUses(
                            row,
                          )
                        }
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600">
                        {
                          formatDateWindow(
                            row,
                          )
                        }
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-bold ${statusBadgeClasses[row.status]}`}
                        >
                          {
                            statusLabels[
                              row
                                .status
                            ]
                          }
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-label={
                            row.isActive
                              ? `Desativar cupão ${row.code}`
                              : `Ativar cupão ${row.code}`
                          }
                          disabled={
                            togglingCouponId !==
                              null ||
                            loading
                          }
                          onClick={() =>
                            void handleToggle(
                              row,
                            )
                          }
                          className="rounded bg-black px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {togglingCouponId ===
                          row.id
                            ? 'A guardar...'
                            : row.isActive
                              ? 'Desativar'
                              : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
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
                className="rounded border border-gray-300 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded border border-gray-300 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Seguinte
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
