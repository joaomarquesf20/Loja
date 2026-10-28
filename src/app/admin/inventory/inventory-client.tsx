'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  InventoryOverview,
  InventoryRow,
  InventoryStatus,
  VariantStockUpdate,
  VariantThresholdUpdate,
} from '@/server/inventory'

const INVENTORY_PAGE_SIZE = 20

const DEFAULT_THRESHOLD = 5

const MIN_THRESHOLD = 1

const MAX_THRESHOLD = 99

type Notice = {
  type: 'success' | 'error'
  message: string
}

const statusLabels: Record<
  InventoryStatus,
  string
> = {
  IN_STOCK: 'Disponível',
  LOW_STOCK: 'Stock baixo',
  OUT_OF_STOCK: 'Sem stock',
}

const statusBadgeClasses: Record<
  InventoryStatus,
  string
> = {
  IN_STOCK:
    'bg-gray-100 text-gray-800',
  LOW_STOCK:
    'bg-amber-100 text-amber-800',
  OUT_OF_STOCK:
    'bg-red-100 text-red-800',
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
 * Inventário (Épico 6): vista completa do stock por variante com KPIs
 * de topo, filtros rápidos (pesquisa + estado) e limiar configurável —
 * os estados chegam calculados pelo serviço; a correção rápida de cada
 * linha reutiliza o `PATCH /api/admin/inventory` e recarrega a vista
 * para os KPIs refletirem o novo stock.
 *
 * Épico 6 — etapa 3: cada linha apresenta o limiar de stock baixo
 * EFETIVO marcado como 'Global' (limiar da consulta) ou 'Próprio'
 * (limiar da variante), editável inline via
 * `PATCH /api/admin/inventory/threshold` (entrada vazia remove o
 * limiar próprio e volta ao global).
 */
export default function InventoryClient() {
  const [
    overview,
    setOverview,
  ] = useState<InventoryOverview | null>(
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

  const [threshold, setThreshold] =
    useState(DEFAULT_THRESHOLD)

  const [
    thresholdDraft,
    setThresholdDraft,
  ] = useState(
    String(DEFAULT_THRESHOLD),
  )

  const [search, setSearch] =
    useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    InventoryStatus | 'ALL'
  >('ALL')

  const [page, setPage] = useState(0)

  const [
    drafts,
    setDrafts,
  ] = useState<Record<
    string,
    string
  >>({})

  const [
    savingVariantId,
    setSavingVariantId,
  ] = useState<string | null>(
    null,
  )

  // Épico 6 — etapa 3: rascunhos do limiar próprio por variante.
  const [
    thresholdDrafts,
    setThresholdDrafts,
  ] = useState<Record<
    string,
    string
  >>({})

  const [
    savingThresholdVariantId,
    setSavingThresholdVariantId,
  ] = useState<string | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setLoading(true)

      setLoadError(null)

      try {
        const response =
          await fetch(
            `/api/admin/inventory/overview?threshold=${threshold}`,
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
            | InventoryOverview
            | null

        if (cancelled) {
          return
        }

        if (!data) {
          throw new Error(
            'Não foi possível carregar o inventário',
          )
        }

        setOverview(data)

        setDrafts({})

        setThresholdDrafts({})
      } catch (loadError) {
        if (!cancelled) {
          setLoadError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar o inventário',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOverview()

    return () => {
      cancelled = true
    }
  }, [threshold])

  async function refreshOverview() {
    if (loading) {
      return
    }

    try {
      const response =
        await fetch(
          `/api/admin/inventory/overview?threshold=${threshold}`,
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
          | InventoryOverview
          | null

      if (!data) {
        throw new Error(
          'Não foi possível carregar o inventário',
        )
      }

      setOverview(data)

      setDrafts({})
    } catch (refreshError) {
      setNotice({
        type: 'error',
        message:
          refreshError instanceof
          Error
            ? refreshError.message
            : 'Não foi possível carregar o inventário',
      })
    }
  }

  function commitThresholdDraft() {
    const raw =
      thresholdDraft.trim()

    if (raw === '') {
      setThresholdDraft(
        String(threshold),
      )

      return
    }

    const parsed =
      Number(raw)

    if (
      !Number.isInteger(parsed) ||
      parsed < MIN_THRESHOLD ||
      parsed > MAX_THRESHOLD
    ) {
      setNotice({
        type: 'error',
        message: `O limiar de stock deve estar entre ${MIN_THRESHOLD} e ${MAX_THRESHOLD}`,
      })

      setThresholdDraft(
        String(threshold),
      )

      return
    }

    if (parsed === threshold) {
      setThresholdDraft(
        String(threshold),
      )

      return
    }

    setThreshold(parsed)
  }

  const filteredVariants =
    useMemo(() => {
      const query = search
        .trim()
        .toLocaleLowerCase(
          'pt-PT',
        )

      const variants =
        overview?.variants ?? []

      if (
        !query &&
        statusFilter ===
          'ALL'
      ) {
        return variants
      }

      return variants.filter(
        (row) => {
          const matchesQuery =
            !query ||
            [
              row.sku,
              row.productName,
              row.productSlug,
            ].some((value) =>
              value
                .toLocaleLowerCase(
                  'pt-PT',
                )
                .includes(query),
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
      filteredVariants.length /
        INVENTORY_PAGE_SIZE,
    ),
  )

  const currentPage = Math.min(
    page,
    pageCount - 1,
  )

  const pageRows =
    filteredVariants.slice(
      currentPage *
        INVENTORY_PAGE_SIZE,
      (currentPage + 1) *
        INVENTORY_PAGE_SIZE,
    )

  function addDraft(
    variantId: string,
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [variantId]: value,
    }))
  }

  async function handleSave(
    row: InventoryRow,
  ) {
    const raw = drafts[
      row.variantId
    ]
      ?.trim()
      ? drafts[row.variantId]
      : ''

    if (!raw) {
      setNotice({
        type: 'error',
        message:
          'Introduz o novo stock antes de guardar.',
      })

      return
    }

    if (savingVariantId) {
      return
    }

    setSavingVariantId(
      row.variantId,
    )

    setNotice(null)

    try {
      const response =
        await fetch(
          '/api/admin/inventory',
          {
            method: 'PATCH',
            headers: {
              'content-type':
                'application/json',
            },
            body: JSON.stringify({
              variantId:
                row.variantId,
              stock: Number(
                raw,
              ),
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

      const result =
        (await response.json()) as VariantStockUpdate

      setNotice({
        type: 'success',
        message: `Stock de ${result.variant.productName} guardado (${result.previousStock} → ${result.variant.stock} unidades).`,
      })

      setDrafts((current) => ({
        ...current,
        [row.variantId]: '',
      }))

      await refreshOverview()
    } catch (saveError) {
      setNotice({
        type: 'error',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível guardar o stock.',
      })
    } finally {
      setSavingVariantId(
        null,
      )
    }
  }

  // Épico 6 — etapa 3: guarda (valor em [1, 99]) ou remove (entrada
  // vazia) o limiar próprio da variante; a vista recarrega para os
  // estados e KPIs refletirem o limiar efetivo novo.
  async function handleThresholdSave(
    row: InventoryRow,
  ) {
    if (savingThresholdVariantId) {
      return
    }

    const raw =
      (
        thresholdDrafts[
          row.variantId
        ] ?? ''
      ).trim()

    let nextThreshold:
      | number
      | null = null

    if (raw !== '') {
      const parsed =
        Number(raw)

      if (
        !Number.isInteger(
          parsed,
        ) ||
        parsed < MIN_THRESHOLD ||
        parsed > MAX_THRESHOLD
      ) {
        setNotice({
          type: 'error',
          message: `O limiar de stock deve estar entre ${MIN_THRESHOLD} e ${MAX_THRESHOLD}`,
        })

        return
      }

      nextThreshold = parsed
    } else if (
      row.lowStockThreshold ===
      null
    ) {
      setNotice({
        type: 'error',
        message:
          'Introduz o novo limiar antes de guardar.',
      })

      return
    }

    if (
      nextThreshold ===
      row.lowStockThreshold
    ) {
      // Sem alteração: repõe o rascunho em silêncio
      // (padrão do limiar global).
      setThresholdDrafts(
        (current) => ({
          ...current,
          [row.variantId]: '',
        }),
      )

      return
    }

    setSavingThresholdVariantId(
      row.variantId,
    )

    setNotice(null)

    try {
      const response =
        await fetch(
          '/api/admin/inventory/threshold',
          {
            method: 'PATCH',
            headers: {
              'content-type':
                'application/json',
            },
            body: JSON.stringify({
              variantId:
                row.variantId,
              lowStockThreshold:
                nextThreshold,
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

      const result =
        (await response.json()) as VariantThresholdUpdate

      setNotice({
        type: 'success',
        message:
          result.threshold ===
          null
            ? `Limiar próprio de ${result.variant.productName} removido — usa o global (${threshold} unidades).`
            : `Limiar próprio de ${result.variant.productName} guardado (${result.threshold} unidades).`,
      })

      setThresholdDrafts(
        (current) => ({
          ...current,
          [row.variantId]: '',
        }),
      )

      await refreshOverview()
    } catch (saveError) {
      setNotice({
        type: 'error',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível guardar o limiar.',
      })
    } finally {
      setSavingThresholdVariantId(
        null,
      )
    }
  }

  function handleClearFilters() {
    setSearch('')

    setStatusFilter('ALL')

    setPage(0)
  }

  if (
    loading &&
    !overview
  ) {
    return (
      <p
        role="status"
        className="rounded-lg border p-6 text-sm text-gray-700"
      >
        A carregar inventário...
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
            Total de SKUs
          </dt>

          <dd className="mt-2 text-3xl font-black text-gray-900">
            {kpis.totalSkus}
          </dd>

          <p className="mt-1 text-xs text-gray-600">
            Variantes ativas à venda na
            loja.
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <dt className="text-xs font-black uppercase tracking-[0.08em] text-gray-600">
            Stock baixo
          </dt>

          <dd className="mt-2 text-3xl font-black text-amber-700">
            {kpis.lowStockCount}
          </dd>

          <p className="mt-1 text-xs text-gray-600">
            Limiar global de{' '}
            {overview.threshold}{' '}
            unidades ou limiar próprio
            da variante.
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <dt className="text-xs font-black uppercase tracking-[0.08em] text-gray-600">
            Sem stock
          </dt>

          <dd className="mt-2 text-3xl font-black text-red-700">
            {kpis.outOfStockCount}
          </dd>

          <p className="mt-1 text-xs text-gray-600">
            Variantes que não podem ser
            vendidas até serem repostas.
          </p>
        </div>
      </dl>

      <section className="rounded-lg border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label
              htmlFor="inventory-search"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Pesquisar por SKU ou
              produto
            </label>

            <input
              id="inventory-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value,
                )

                setPage(0)
              }}
              placeholder="FLT-001"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm sm:w-64"
            />

            <label
              htmlFor="inventory-status"
              className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
            >
              Estado
            </label>

            <select
              id="inventory-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target
                    .value as
                    InventoryStatus,
                )

                setPage(0)
              }}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="ALL">
                Todos os estados
              </option>

              <option value="IN_STOCK">
                Disponível
              </option>

              <option value="LOW_STOCK">
                Stock baixo
              </option>

              <option value="OUT_OF_STOCK">
                Sem stock
              </option>
            </select>
          </div>

          <label
            htmlFor="inventory-threshold"
            className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600"
          >
            Limiar de stock baixo
            (unidades)
          </label>

          <input
            id="inventory-threshold"
            type="number"
            min={MIN_THRESHOLD}
            max={MAX_THRESHOLD}
            step={1}
            value={thresholdDraft}
            onChange={(event) =>
              setThresholdDraft(
                event.target.value,
              )
            }
            onBlur={commitThresholdDraft}
            className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
          />
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
          {filteredVariants.length}{' '}
          de{' '}
          {overview.variants.length}{' '}
          SKUs
        </p>

        {pageRows.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Sem SKUs para os filtros
              aplicados.
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
                    Produto
                  </th>

                  <th className="px-4 py-3 font-bold">
                    SKU
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Stock atual
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Estado
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Limiar
                  </th>

                  <th className="px-4 py-3 font-bold">
                    Correção rápida
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {pageRows.map(
                  (row) => (
                    <tr
                      key={
                        row.variantId
                      }
                    >
                      <td className="px-4 py-3">
                        {
                          row.productName
                        }
                      </td>

                      <td className="px-4 py-3 font-mono text-xs">
                        {row.sku}
                      </td>

                      <td className="px-4 py-3 tabular-nums">
                        {row.stock}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-bold ${statusBadgeClasses[row.status]}`}
                        >
                          {
                            statusLabels[
                              row.status
                            ]
                          }
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={`inline-block w-fit rounded px-2 py-1 text-xs font-bold ${
                              row.lowStockThreshold ===
                              null
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-violet-100 text-violet-800'
                            }`}
                          >
                            {row.lowStockThreshold ===
                            null
                              ? `Global: ${overview.threshold}`
                              : `Próprio: ${row.lowStockThreshold}`}
                          </span>

                          <div className="flex items-center gap-2">
                            <input
                              aria-label={`Limiar de stock de ${row.sku}`}
                              type="number"
                              min={
                                MIN_THRESHOLD
                              }
                              max={
                                MAX_THRESHOLD
                              }
                              step={1}
                              placeholder={String(
                                row.lowStockThreshold ??
                                  overview.threshold,
                              )}
                              value={
                                thresholdDrafts[
                                  row
                                    .variantId
                                ] ??
                                (row.lowStockThreshold ===
                                null
                                  ? ''
                                  : String(
                                      row
                                        .lowStockThreshold,
                                    ))
                              }
                              onChange={(
                                event,
                              ) =>
                                setThresholdDrafts(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    [
                                      row
                                        .variantId
                                    ]:
                                      event
                                        .target
                                        .value,
                                  }),
                                )
                              }
                              className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm"
                            />

                            <button
                              type="button"
                              aria-label={`Guardar limiar de ${row.sku}`}
                              disabled={
                                savingVariantId !==
                                  null ||
                                savingThresholdVariantId !==
                                  null ||
                                loading
                              }
                              onClick={() =>
                                void handleThresholdSave(
                                  row,
                                )
                              }
                              className="rounded bg-black px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {savingThresholdVariantId ===
                              row.variantId
                                ? 'A guardar...'
                                : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            aria-label={`Novo stock de ${row.sku}`}
                            type="number"
                            min={0}
                            step={1}
                            placeholder={
                              String(
                                row.stock,
                              )
                            }
                            value={
                              drafts[
                                row
                                  .variantId
                              ] ?? ''
                            }
                            onChange={(
                              event,
                            ) =>
                              addDraft(
                                row.variantId,
                                event
                                  .target
                                  .value,
                              )
                            }
                            className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />

                          <button
                            type="button"
                            aria-label={`Guardar stock de ${row.sku}`}
                            disabled={
                              savingVariantId !==
                                null ||
                              savingThresholdVariantId !==
                                null ||
                              loading
                            }
                            onClick={() =>
                              void handleSave(
                                row,
                              )
                            }
                            className="rounded bg-black px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingVariantId ===
                            row.variantId
                              ? 'A guardar...'
                              : 'Guardar'}
                          </button>
                        </div>
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
