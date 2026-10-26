'use client'

import {
  useEffect,
  useState,
} from 'react'

import type {
  StockMovementType,
  StockMovementsPage,
} from '@/server/inventory'

const MOVEMENTS_PAGE_SIZE = 50

const movementTypeLabels: Record<
  StockMovementType,
  string
> = {
  RESTOCK: 'Reposição',
  SALE: 'Venda',
  MANUAL_ADJUSTMENT:
    'Correção manual',
  RETURN: 'Cancelamento',
}

const movementTypeBadgeClasses: Record<
  StockMovementType,
  string
> = {
  RESTOCK:
    'bg-green-100 text-green-800',
  SALE: 'bg-blue-100 text-blue-800',
  MANUAL_ADJUSTMENT:
    'bg-amber-100 text-amber-800',
  RETURN: 'bg-gray-100 text-gray-800',
}

const typeFilterOptions: Array<
  StockMovementType | 'ALL'
> = [
  'ALL',
  'RESTOCK',
  'SALE',
  'MANUAL_ADJUSTMENT',
  'RETURN',
]

function formatSignedQuantity(
  value: number,
) {
  return value > 0
    ? `+${value}`
    : String(value)
}

function formatMovementDate(
  value: string,
) {
  const date = new Date(
    value,
  )

  return (
    date.toLocaleDateString(
      'pt-PT',
    ) +
    ' ' +
    date
      .toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(/,/g, '')
  )
}

async function getErrorMessage(
  response: Response,
) {
  const body =
    (await response
      .json()
      .catch(() => null)) as
    | {
        error?: string
      }
    | null

  return (
    body?.error ??
    'Erro inesperado'
  )
}

/**
 * Épico 6 (etapa 2) — histórico de movimentos de stock: os filtros de
 * tipo, SKU e intervalo de datas correm no servidor
 * (`GET /api/admin/inventory/movements`), com paginação pelo total
 * filtrado; a vista recarrega a cada alteração de filtro.
 */
export default function MovementsClient() {
  const [
    movements,
    setMovements,
  ] = useState<StockMovementsPage | null>(
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

  const [type, setType] =
    useState<StockMovementType | 'ALL'>(
      'ALL',
    )

  const [skuDraft, setSkuDraft] =
    useState('')

  const [sku, setSku] = useState('')

  const [from, setFrom] =
    useState('')

  const [to, setTo] = useState('')

  const [page, setPage] =
    useState(1)

  useEffect(() => {
    let cancelled = false

    async function loadMovements() {
      setLoading(true)

      setLoadError(null)

      try {
        const query =
          new URLSearchParams()

        if (type !== 'ALL') {
          query.set('type', type)
        }

        if (sku.trim() !== '') {
          query.set(
            'sku',
            sku.trim(),
          )
        }

        if (from !== '') {
          query.set('from', from)
        }

        if (to !== '') {
          query.set('to', to)
        }

        query.set('page', String(page))

        query.set(
          'pageSize',
          String(MOVEMENTS_PAGE_SIZE),
        )

        const response =
          await fetch(
            `/api/admin/inventory/movements?${query.toString()}`,
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
            | StockMovementsPage
            | null

        if (cancelled) {
          return
        }

        if (!data) {
          throw new Error(
            'Não foi possível carregar o histórico de movimentos',
          )
        }

        setMovements(data)
      } catch (loadError) {
        if (!cancelled) {
          setLoadError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar o histórico de movimentos',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMovements()

    return () => {
      cancelled = true
    }
  }, [type, sku, from, to, page])

  function resetToFirstPage() {
    setPage(1)
  }

  function commitSkuDraft() {
    const normalized =
      skuDraft.trim()

    if (
      normalized !== sku
    ) {
      setSku(normalized)

      resetToFirstPage()
    }
  }

  function handleClearFilters() {
    setType('ALL')

    setSkuDraft('')

    setSku('')

    setFrom('')

    setTo('')

    setPage(1)
  }

  const rows =
    movements?.movements ?? []

  if (
    loading &&
    !movements
  ) {
    return (
      <p
        role="status"
        className="rounded-lg border p-6 text-sm text-gray-700"
      >
        A carregar histórico de
        movimentos...
      </p>
    )
  }

  if (loadError && !movements) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
      >
        {loadError}
      </div>
    )
  }

  if (!movements) {
    return null
  }

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

      <section className="rounded-lg border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="movements-type"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Tipo de movimento
            </label>

            <select
              id="movements-type"
              value={type}
              onChange={(
                event,
              ) => {
                setType(event
                  .target
                  .value as
                  StockMovementType)

                resetToFirstPage()
              }}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {typeFilterOptions.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option ===
                    'ALL'
                      ? 'Todos os movimentos'
                      : movementTypeLabels[
                          option
                        ]}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="movements-sku"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              SKU
            </label>

            <input
              id="movements-sku"
              type="search"
              value={skuDraft}
              onChange={(
                event,
              ) =>
                setSkuDraft(
                  event.target
                    .value,
                )
              }
              onBlur={
                commitSkuDraft
              }
              onKeyDown={(
                event,
              ) => {
                if (
                  event.key ===
                  'Enter'
                ) {
                  commitSkuDraft()
                }
              }}
              placeholder="FLT-001"
              className="rounded border border-gray-300 px-3 py-2 text-sm sm:w-56"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="movements-from"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              De
            </label>

            <input
              id="movements-from"
              type="date"
              value={from}
              onChange={(
                event,
              ) => {
                setFrom(
                  event.target
                    .value,
                )

                resetToFirstPage()
              }}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="movements-to"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Até
            </label>

            <input
              id="movements-to"
              type="date"
              value={to}
              onChange={(
                event,
              ) => {
                setTo(
                  event.target
                    .value,
                )

                resetToFirstPage()
              }}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={
              handleClearFilters
            }
            className="rounded border border-gray-300 px-3 py-2 text-sm font-bold"
          >
            Limpar filtros
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          {movements.total}{' '}
          movimentos no histórico
        </p>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">
            Sem movimentos para os
            filtros aplicados.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-[0.08em] text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-bold">
                    Data
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Produto
                  </th>

                  <th className="px-4 py-3 font-bold">
                    SKU
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Tipo
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Alteração
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Stock
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Autor
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {rows.map(
                  (row) => (
                    <tr
                      key={row.id}
                      data-testid="stock-movement-row"
                    >
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                        {formatMovementDate(
                          row.createdAt,
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {
                          row.productName
                        }
                      </td>

                      <td className="px-4 py-3 font-mono text-xs">
                        {row.sku}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-bold ${movementTypeBadgeClasses[row.type]}`}
                        >
                          {
                            movementTypeLabels[
                              row
                                .type
                            ]
                          }
                        </span>
                      </td>

                      <td className="px-4 py-3 tabular-nums">
                        {formatSignedQuantity(
                          row.quantityChange,
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                        {row.previousStock}{' '}
                        →{' '}
                        {
                          row.newStock
                        }
                      </td>

                      <td className="px-4 py-3">
                        {row.actorEmail ??
                          'Sistema'}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        {movements.totalPages >
          1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Página{' '}
              {
                movements.page
              }{' '}
              de{' '}
              {
                movements.totalPages
              }
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={
                  movements.page ===
                  1
                }
                onClick={() =>
                  setPage(
                    movements.page -
                      1,
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
                  movements.page >=
                  movements.totalPages
                }
                onClick={() =>
                  setPage(
                    movements.page +
                      1,
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
