'use client'

import { useSyncExternalStore } from 'react'

/**
 * Persistência do veículo selecionado na loja
 * (Épico 2 — Etapa 4): localStorage + eventos DOM
 * para sincronizar o selector (home), o filtro da
 * grelha de categoria e o badge de compatibilidade
 * da ficha de produto, sem todos partilharem prop
 * drilling. Em SSR devolve sempre null (leitura só
 * acontece em efeito, depois da hidratação).
 */

export type VehicleSelection = {
  configurationId: string
  label: string
  makeSlug: string
  modelSlug: string
}

const STORAGE_KEY = 'pfa-veiculo'
const CHANGE_EVENT = 'pfa-veiculo-mudou'

export function isVehicleSelection(
  value: unknown,
): value is VehicleSelection {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false
  }

  const candidate =
    value as Partial<VehicleSelection>

  return (
    typeof candidate.configurationId ===
      'string' &&
    candidate.configurationId.trim() !== '' &&
    typeof candidate.label === 'string' &&
    candidate.label.trim() !== '' &&
    typeof candidate.makeSlug === 'string' &&
    candidate.makeSlug.trim() !== '' &&
    typeof candidate.modelSlug === 'string' &&
    candidate.modelSlug.trim() !== ''
  )
}

/**
 * Etiqueta de apresentação: "Opel Corsa B 1.5 TD".
 */
export function buildVehicleSelectionLabel({
  makeName,
  modelName,
  configurationName,
}: {
  makeName: string
  modelName: string
  configurationName: string
}) {
  return `${makeName} ${modelName} ${configurationName}`
}

export function readVehicleSelection(): VehicleSelection | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed: unknown =
      JSON.parse(raw)

    if (!isVehicleSelection(parsed)) {
      return null
    }

    return parsed
  } catch {
    // JSON inválido ou storage indisponível.
    return null
  }
}

export function writeVehicleSelection(
  selection: VehicleSelection,
) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(selection),
  )
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT),
  )
}

export function clearVehicleSelection() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(
    STORAGE_KEY,
  )
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT),
  )
}

/**
 * Subscrição de mudanças: evento DOM local (mesma
 * página) + evento 'storage' (outros tabs).
 */
export function subscribeVehicleSelection(
  listener: (
    selection: VehicleSelection | null,
  ) => void,
) {
  const notify = () =>
    listener(readVehicleSelection())

  const onStorage = (
    event: StorageEvent,
  ) => {
    if (
      event.key === STORAGE_KEY ||
      event.key === null
    ) {
      notify()
    }
  }

  window.addEventListener(
    CHANGE_EVENT,
    notify,
  )
  window.addEventListener(
    'storage',
    onStorage,
  )

  return () => {
    window.removeEventListener(
      CHANGE_EVENT,
      notify,
    )
    window.removeEventListener(
      'storage',
      onStorage,
    )
  }
}

/**
 * Snapshot com cache pela string crua de storage:
 * identidade estável entre renders (exigido pelo
 * useSyncExternalStore) e invalidação automática
 * sempre que o localStorage muda, incluindo
 * mutações externas (outros tabs, testes).
 */
let cachedRaw: string | null | undefined
let cachedSelection: VehicleSelection | null =
  null

function parseSelectionRaw(
  raw: string | null,
): VehicleSelection | null {
  if (!raw) {
    return null
  }

  try {
    const parsed: unknown =
      JSON.parse(raw)

    return isVehicleSelection(parsed)
      ? parsed
      : null
  } catch {
    // JSON inválido ou storage indisponível.
    return null
  }
}

export function getVehicleSelectionSnapshot(): VehicleSelection | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw =
    window.localStorage.getItem(STORAGE_KEY)

  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedSelection =
      parseSelectionRaw(raw)
  }

  return cachedSelection
}

function getServerVehicleSelectionSnapshot() {
  return null
}

export function useVehicleSelection() {
  return useSyncExternalStore(
    subscribeVehicleSelection,
    getVehicleSelectionSnapshot,
    getServerVehicleSelectionSnapshot,
  )
}
