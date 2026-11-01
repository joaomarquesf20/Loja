'use client'

import { useEffect, useState } from 'react'

import { useVehicleSelection } from './vehicle-selection'

/**
 * Badge de compatibilidade da ficha de produto
 * (Épico 8): com uma especificação de veículo
 * guardada, interroga o endpoint público de estado
 * de compatibilidade e apresenta "Compatível com o
 * teu veículo" ou "Não compatível" (com as notas do
 * administrador em tooltip).
 *
 * Sem veículo selecionado, erro de rede ou falha
 * (produto/especificação removida), o badge não é
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
  productId: string
}

type CompatibilityOutcome =
  | {
      specId: string
      kind: 'compatible'
      notes: string | null
    }
  | {
      specId: string
      kind: 'incompatible'
    }
  | {
      specId: string
      kind: 'error'
    }

export default function VehicleCompatibilityBadge({
  productId,
}: VehicleCompatibilityBadgeProps) {
  const selection = useVehicleSelection()
  const [outcome, setOutcome] =
    useState<CompatibilityOutcome | null>(
      null,
    )

  const activeSpecId =
    selection?.specId ?? ''

  const outcomeIsCurrent =
    activeSpecId !== '' &&
    outcome?.specId === activeSpecId

  useEffect(() => {
    if (!activeSpecId) {
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const response = await fetch(
          `/api/vehicles/compatibility?productId=${encodeURIComponent(
            productId,
          )}&specId=${encodeURIComponent(
            activeSpecId,
          )}`,
        )

        if (cancelled) {
          return
        }

        if (!response.ok) {
          // 404/400: produto ou especificação já
          // não existe → badge silencioso.
          setOutcome({
            specId: activeSpecId,
            kind: 'error',
          })

          return
        }

        const body = (await response.json()) as {
          compatible: boolean
          notes?: string | null
        }

        setOutcome({
          specId: activeSpecId,
          kind: body.compatible
            ? 'compatible'
            : 'incompatible',
          notes: body.compatible
            ? (body.notes ?? null)
            : null,
        })
      } catch {
        if (!cancelled) {
          setOutcome({
            specId: activeSpecId,
            kind: 'error',
          })
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [activeSpecId, productId])

  if (
    !activeSpecId ||
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
      title={
        compatible && outcome.notes
          ? outcome.notes
          : undefined
      }
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
