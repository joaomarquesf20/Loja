'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import type { CatalogProduct } from '@/server/catalog'
import ProductCard from './product-card'
import VehicleSelector from './vehicle-selector'
import {
  clearVehicleSelection,
  useVehicleSelection,
} from './vehicle-selection'

/**
 * Filtro de compatibilidade da grelha de produtos
 * (Épico 2 — Etapa 4): vê o veículo guardado no
 * localStorage (vehicle-selection), interroga o
 * endpoint público de produtos compatíveis e
 * esconde as fichas sem ligação registada.
 *
 * Integra o indicador: "A mostrar peças compatíveis
 * para: {veículo}" com ações Mudar (selector em
 * cascata embutido) e Limpar. Sem veículo guardado,
 * devolve a grelha normal, tal como o servidor a
 * renderiza.
 *
 * Falha aberta: se o pedido falhar, mostra o
 * catálogo completo — uma loja nunca fica vazia por
 * causa da verificação de compatibilidade.
 */

type ProductsOutcome =
  | {
      configurationId: string
      kind: 'ready'
      compatibleProductIds: string[]
    }
  | {
      configurationId: string
      kind: 'error'
    }

const PRIMARY_BUTTON_CLASS =
  'inline-flex min-h-9 items-center justify-center rounded-sm bg-brand px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

const SECONDARY_BUTTON_CLASS =
  'inline-flex min-h-9 items-center justify-center rounded-sm border border-gray-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-gray-600 transition hover:border-gray-400 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

function getProductGridClass(
  productCount: number,
) {
  return `grid gap-5 sm:grid-cols-2 ${
    productCount === 1
      ? 'max-w-md'
      : productCount === 2
        ? 'max-w-3xl'
        : 'xl:grid-cols-3'
  }`
}

type VehicleCompatibleProductsProps = {
  products: CatalogProduct[]
  clearFiltersHref?: string
}

export default function VehicleCompatibleProducts({
  products,
  clearFiltersHref,
}: VehicleCompatibleProductsProps) {
  const selection = useVehicleSelection()
  const [outcome, setOutcome] =
    useState<ProductsOutcome | null>(null)
  const [
    selectorVisible,
    setSelectorVisible,
  ] = useState(false)

  const activeConfigurationId =
    selection?.configurationId ?? ''

  const vehicleFilterActive =
    activeConfigurationId !== ''

  const outcomeIsCurrent =
    vehicleFilterActive &&
    outcome?.configurationId ===
      activeConfigurationId

  const checkingCompatibility =
    vehicleFilterActive && !outcomeIsCurrent

  const failedVerification =
    outcomeIsCurrent &&
    outcome?.kind === 'error'

  useEffect(() => {
    if (!activeConfigurationId) {
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const response = await fetch(
          `/api/vehicles/configurations/${encodeURIComponent(
            activeConfigurationId,
          )}/products`,
        )

        if (!response.ok) {
          throw new Error(
            `Pedido falhou (${response.status})`,
          )
        }

        const body = (await response.json()) as {
          products: Array<{
            id: string
            slug: string
          }>
        }

        if (cancelled) {
          return
        }

        setOutcome({
          configurationId:
            activeConfigurationId,
          kind: 'ready',
          compatibleProductIds:
            body.products.map(
              (product) => product.id,
            ),
        })
      } catch {
        if (!cancelled) {
          setOutcome({
            configurationId:
              activeConfigurationId,
            kind: 'error',
          })
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [activeConfigurationId])

  const compatibleProductIdSet =
    outcomeIsCurrent &&
    outcome?.kind === 'ready'
      ? new Set(outcome.compatibleProductIds)
      : null

  const filteredProducts =
    compatibleProductIdSet
      ? products.filter((product) =>
          compatibleProductIdSet.has(
            product.id,
          ),
        )
      : products

  const visibleProducts = !vehicleFilterActive
    ? products
    : checkingCompatibility
      ? null
      : failedVerification
        ? products
        : filteredProducts

  const productCountForGrid =
    visibleProducts?.length ?? 0

  const showServerEmptyPanel =
    visibleProducts !== null &&
    products.length === 0

  const showCompatibilityEmptyPanel =
    visibleProducts !== null &&
    products.length > 0 &&
    compatibleProductIdSet !== null &&
    filteredProducts.length === 0

  const showProductGrid =
    visibleProducts !== null &&
    !showServerEmptyPanel &&
    !showCompatibilityEmptyPanel

  return (
    <>
      {vehicleFilterActive && selection ? (
        <div
          aria-live="polite"
          className="mb-6 border border-gray-200 bg-white px-4 py-4 sm:px-6"
          data-testid="vehicle-compatibility-banner"
        >
          <p className="text-sm font-semibold text-gray-900">
            A mostrar peças compatíveis para:{' '}
            <span className="text-brand">
              {selection.label}
            </span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectorVisible(
                  (visible) => !visible,
                )
              }
              aria-expanded={selectorVisible}
              className={SECONDARY_BUTTON_CLASS}
            >
              {selectorVisible
                ? 'Fechar selector'
                : 'Mudar veículo'}
            </button>

            <button
              type="button"
              onClick={clearVehicleSelection}
              className={PRIMARY_BUTTON_CLASS}
            >
              Limpar
            </button>

            {outcomeIsCurrent &&
            outcome?.kind === 'ready' &&
            filteredProducts.length > 0 ? (
              <p className="text-xs font-semibold text-gray-500">
                {filteredProducts.length ===
                1
                  ? '1 peça compatível'
                  : `${filteredProducts.length} peças compatíveis`}{' '}
                nesta categoria
              </p>
            ) : null}
          </div>

          {selectorVisible ? (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <VehicleSelector />
            </div>
          ) : null}
        </div>
      ) : null}

      {checkingCompatibility ? (
        <p
          role="status"
          className="border border-gray-200 bg-white px-6 py-6 text-sm font-semibold text-gray-500"
        >
          A verificar compatibilidade…
        </p>
      ) : null}

      {failedVerification ? (
        <p
          role="status"
          className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          Não foi possível verificar a
          compatibilidade — a mostrar todo o
          catálogo.
        </p>
      ) : null}

      {showServerEmptyPanel ? (
        <div className="border border-gray-200 bg-white px-6 py-12 sm:px-8">
          <p className="text-xl font-black tracking-tight">
            Nenhum produto encontrado
          </p>

          <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500">
            Não existem produtos que
            correspondam aos filtros
            selecionados. Remove um ou
            mais filtros para voltares
            a ver esta categoria.
          </p>

          {clearFiltersHref ? (
            <Link
              href={clearFiltersHref}
              className="mt-6 inline-flex rounded-sm bg-brand px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Remover filtros
            </Link>
          ) : null}
        </div>
      ) : showCompatibilityEmptyPanel && selection ? (
        <div className="border border-gray-200 bg-white px-6 py-12 sm:px-8">
          <p className="text-xl font-black tracking-tight">
            {`Nenhuma peça compatível com ${selection.label}`}
          </p>

          <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500">
            Esta categoria não tem peças
            registadas para o veículo
            selecionado. Limpa o veículo
            para veres o catálogo completo.
          </p>

          <button
            type="button"
            onClick={clearVehicleSelection}
            className={`${PRIMARY_BUTTON_CLASS} mt-6`}
          >
            Limpar
          </button>
        </div>
      ) : showProductGrid ? (
        <div
          className={getProductGridClass(
            productCountForGrid,
          )}
        >
          {visibleProducts.map(
            (product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="category"
              />
            ),
          )}
        </div>
      ) : null}
    </>
  )
}
