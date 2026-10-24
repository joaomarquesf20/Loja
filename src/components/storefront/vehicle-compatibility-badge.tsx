'use client'

import { useEffect, useState } from 'react'

import { useVehicleSelection } from './vehicle-selection'

/**
 * Badge de compatibilidade da ficha de produto
 * (Épico 2 — Etapa 4): com um veículo guardado,
 * interroga o endpoint público de estado de
 * compatibilidade e apresenta "Compatível com o teu
 * veículo" ou "Não compatível".
 *
 * Sem veículo selecionado, erro de rede ou 404
 * (produto/configuração removida), o badge não é
 * apresentado — a ficha nunca fica poluída.
 */

const BADGE_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold'

function getCompatibilityStateClass(
  compatible: boolean,
) {
  return compatible
    ? `${BADGE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-700`
    : `${BADGE_CLASS} border-red-200 bg-red-50 text-red-700`
}

type VehicleCompatibilityBadgeProps = {
  productSlug: string
}

type CompatibilityOutcome =
  | {
      configurationId: string
      kind: 'compatible'
    }
  | {
      configurationId: string
      kind: 'incompatible'
    }
  | {
      configurationId: string
      kind: 'error'
    }

export default function VehicleCompatibilityBadge({
  productSlug,
}: VehicleCompatibilityBadgeProps) {
  const selection = useVehicleSelection()
  const [outcome, setOutcome] =
    useState<CompatibilityOutcome | null>(
      null,
    )

  const activeConfigurationId =
    selection?.configurationId ?? ''

  const outcomeIsCurrent =
    activeConfigurationId !== '' &&
    outcome?.configurationId ===
      activeConfigurationId

  useEffect(() => {
    if (!activeConfigurationId) {
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const response = await fetch(
          `/api/vehicles/products/${encodeURIComponent(
            productSlug,
          )}/compatibility?configurationId=${encodeURIComponent(
            activeConfigurationId,
          )}`,
        )

        if (cancelled) {
          return
        }

        if (!response.ok) {
          // 404: produto/configuração já não existe
          // → badge silencioso.
          setOutcome({
            configurationId:
              activeConfigurationId,
            kind: 'error',
          })

          return
        }

        const body = (await response.json()) as {
          compatible: boolean
        }

        setOutcome({
          configurationId:
            activeConfigurationId,
          kind: body.compatible
            ? 'compatible'
            : 'incompatible',
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
  }, [activeConfigurationId, productSlug])

  if (
    !activeConfigurationId ||
    (outcomeIsCurrent &&
      outcome?.kind === 'error')
  ) {
    return null
  }

  // Sem resultado atual (mudança de veículo ou
  // primeira verificação) → estado de verificação.
  if (!outcomeIsCurrent) {
    return (
      <p
        className="mt-4 text-xs font-semibold text-gray-400"
        role="status"
      >
        A verificar compatibilidade…
      </p>
    )
  }

  const compatible =
    outcome.kind === 'compatible'

  return (
    <p
      className={getCompatibilityStateClass(
        compatible,
      )}
      data-testid="vehicle-compatibility-badge"
    >
      <span aria-hidden="true">
        {compatible ? '✓' : '✕'}
      </span>

      {compatible
        ? 'Compatível com o teu veículo'
        : 'Não compatível'}
    </p>
  )
}
