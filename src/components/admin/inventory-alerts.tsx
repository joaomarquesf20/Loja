'use client'

import Link from 'next/link'
import { useState } from 'react'

import type {
  LowStockVariant,
  VariantStockUpdate,
} from '@/server/inventory'

type Notice = {
  type: 'success' | 'error'
  message: string
}

type InventoryApiResponse =
  | VariantStockUpdate
  | {
      threshold: number
      variants: LowStockVariant[]
    }

async function readResponseBody<T extends InventoryApiResponse>(
  response: Response,
): Promise<T> {
  const body =
    (await response
      .json()
      .catch(() => null)) as
    | (T &
        {
          error?: string
        })
    | null

  if (!response.ok) {
    throw new Error(
      body?.error ??
        'Não foi possível guardar o stock.',
    )
  }

  return body as T
}

/**
 * Alertas de ruptura (etapa 7): tabela das variantes com stock igual
 * ou inferior ao limiar e correção rápida inline — o admin escreve o
 * stock novo e guarda sem sair do dashboard.
 */
export default function InventoryAlerts(
  {
    threshold,
    variants:
      initialVariants,
  }: {
    threshold: number
    variants: LowStockVariant[]
  },
) {
  const [variants, setVariants] =
    useState(initialVariants)

  const [drafts, setDrafts] =
    useState<Record<
      string,
      string
    >>({})

  const [savingSku, setSavingSku] =
    useState<string | null>(
      null,
    )

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false)

  const [notice, setNotice] =
    useState<Notice | null>(
      null,
    )

  function setDraft(
    variantId: string,
    value: string,
  ) {
    setDrafts(
      (current) => ({
        ...current,
        [variantId]:
          value,
      }),
    )
  }

  async function handleSave(
    variant: LowStockVariant,
  ) {
    const raw =
      drafts[
        variant.variantId
      ] ?? ''

    if (!raw.trim()) {
      setNotice({
        type: 'error',
        message:
          'Introduz o novo stock antes de guardar.',
      })

      return
    }

    setSavingSku(
      variant.sku,
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
            body: JSON.stringify(
              {
                variantId:
                  variant.variantId,
                stock: Number(
                  raw,
                ),
              },
            ),
          },
        )

      const result =
        await readResponseBody<VariantStockUpdate>(
          response,
        )

      setVariants(
        (current) => {
          if (
            result.variant.stock >
            threshold
          ) {
            return current.filter(
              (item) =>
                item.variantId !==
                result.variant
                  .variantId,
            )
          }

          return current.map((item) =>
            item.variantId ===
            result.variant.variantId
              ? result.variant
              : item,
          )
        },
      )

      setDrafts(
        (current) => {
          const next = {
            ...current,
          }

          delete next[
            result.variant
              .variantId
          ]

          return next
        },
      )

      setNotice({
        type: 'success',
        message: `Stock de ${result.variant.productName} guardado (${result.previousStock} → ${result.variant.stock} unidades).`,
      })
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error &&
          error.message
            ? error.message
            : 'Não foi possível guardar o stock.',
      })
    } finally {
      setSavingSku(null)
    }
  }

  async function handleRefresh() {
    setIsRefreshing(
      true,
    )

    setNotice(null)

    try {
      const response =
        await fetch(
          `/api/admin/inventory?threshold=${threshold}`,
        )

      const result =
        await readResponseBody<{
          threshold: number
          variants: LowStockVariant[]
        }>(response)

      setVariants(
        result.variants,
      )

      setDrafts({})
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error &&
          error.message
            ? error.message
            : 'Não foi possível atualizar a lista.',
      })
    } finally {
      setIsRefreshing(
        false,
      )
    }
  }

  return (
    <section className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#17181c]">
            Alertas de ruptura
          </h3>

          <p className="mt-1 text-sm text-[#687078]">
            Variantes ativas com stock igual ou
            inferior a {threshold} unidades.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={
            isRefreshing ||
            savingSku !== null
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRefreshing
            ? 'A atualizar...'
            : 'Atualizar lista'}
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="mt-5 text-sm text-[#687078]">
          Sem variantes com stock baixo.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-[0.08em] text-[#687078]">
                <th
                  scope="col"
                  className="py-2 pr-3 font-bold"
                >
                  Produto
                </th>

                <th
                  scope="col"
                  className="py-2 pr-3 font-bold"
                >
                  SKU
                </th>

                <th
                  scope="col"
                  className="py-2 pr-3 font-bold"
                >
                  Stock
                </th>

                <th
                  scope="col"
                  className="py-2 pr-3 font-bold"
                >
                  Novo stock
                </th>

                <th scope="col">
                  <span className="sr-only">
                    Ações
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {variants.map(
                (variant) => (
                  <tr
                    key={
                      variant.variantId
                    }
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-3 pr-3 font-semibold text-[#17181c]">
                      {
                        variant.productName
                      }
                    </td>

                    <td className="py-3 pr-3 font-mono text-xs text-[#687078]">
                      {variant.sku}
                    </td>

                    <td className="py-3 pr-3">
                      <span className="font-bold text-[#17181c]">
                        {variant.stock}
                      </span>

                      <span
                        className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                          variant.stock ===
                          0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {variant.stock ===
                        0
                          ? 'Sem stock'
                          : 'Stock baixo'}
                      </span>
                    </td>

                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={
                          drafts[
                            variant
                              .variantId
                          ] ??
                          String(
                            variant.stock,
                          )
                        }
                        disabled={
                          savingSku !==
                          null
                        }
                        aria-label={`Novo stock de ${variant.sku}`}
                        onChange={(
                          event,
                        ) =>
                          setDraft(
                            variant.variantId,
                            event.target
                              .value,
                          )
                        }
                        className="w-24 rounded border border-gray-300 px-2 py-1.5"
                      />
                    </td>

                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleSave(
                            variant,
                          )
                        }
                        disabled={
                          savingSku !==
                          null
                        }
                        aria-label={`Guardar stock de ${variant.sku}`}
                        className="rounded-lg bg-[#ef5b2a] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[#d94a1b] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingSku ===
                        variant.sku
                          ? 'A guardar...'
                          : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {notice ? (
        <p
          role={
            notice.type === 'error'
              ? 'alert'
              : 'status'
          }
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            notice.type === 'error'
              ? 'border border-red-200 bg-red-50 text-red-800'
              : 'border border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      <div className="mt-4">
        <Link
          href="/admin/products"
          className="text-sm font-bold text-[#ef5b2a]"
        >
          Gerir stock em produtos →
        </Link>
      </div>
    </section>
  )
}
