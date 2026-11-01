'use client'

import type { ChangeEventHandler } from 'react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  buildVehicleSelectionLabel,
  clearVehicleSelection,
  readVehicleSelection,
  writeVehicleSelection,
  type VehicleSelection,
} from './vehicle-selection'

/**
 * Selector em cascata de veículo (Épico 8):
 * Marca → Modelo → Especificação, sobre os
 * endpoints públicos do motor de fitment
 * (/api/vehicles/makes, /models?makeId=,
 * /specs?modelId=). A especificação escolhida é
 * persistida (localStorage + evento) e consultada
 * pelo filtro da grelha de categoria e pelo badge
 * da ficha.
 *
 * O que persiste como identidade é o `specId`;
 * `makeId`/`modelId` viajam na seleção para voltar
 * a pré-selecionar a cascata após recarregar.
 */

type VehicleMakePayload = {
  id: string
  name: string
  slug: string
}

type VehicleModelPayload = {
  id: string
  name: string
  slug: string
}

type VehicleSpecPayload = {
  id: string
  engine: string
  engineCode: string | null
  yearStart: number
  yearEnd: number | null
  fuelType: string
  powerHp: number | null
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Pedido falhou (${response.status})`,
    )
  }

  return (await response.json()) as T
}

function specOptionLabel(
  spec: VehicleSpecPayload,
) {
  const years =
    spec.yearEnd !== null
      ? `${spec.yearStart}–${spec.yearEnd}`
      : `desde ${spec.yearStart}`

  return spec.engineCode
    ? `${spec.engine} (${spec.engineCode}) · ${years}`
    : `${spec.engine} · ${years}`
}

const SELECT_CLASS =
  'mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400'

const LABEL_CLASS =
  'text-[10px] font-black uppercase tracking-[0.14em] text-gray-400'

const SECONDARY_BUTTON_CLASS =
  'inline-flex min-h-9 items-center justify-center rounded-sm border border-gray-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-gray-600 transition hover:border-gray-400 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

export default function VehicleSelector() {
  const [makes, setMakes] = useState<
    VehicleMakePayload[]
  >([])
  const [models, setModels] = useState<
    VehicleModelPayload[]
  >([])
  const [specs, setSpecs] = useState<
    VehicleSpecPayload[]
  >([])
  const [makeId, setMakeId] = useState('')
  const [modelId, setModelId] = useState('')
  const [selected, setSelected] =
    useState<VehicleSelection | null>(null)
  const [loadingMakes, setLoadingMakes] =
    useState(true)
  const [loadingModels, setLoadingModels] =
    useState(false)
  const [loadingSpecs, setLoadingSpecs] =
    useState(false)
  const [error, setError] = useState<
    string | null
  >(null)

  /**
   * Protecção contra respostas fora de ordem: se o
   * utilizador muda de passo enquanto a resposta
   * anterior ainda está a chegar, a última escolha
   * é a que ganha.
   */
  const makeRequestRef = useRef(0)
  const modelRequestRef = useRef(0)

  const loadMakes = useCallback(async () => {
    setLoadingMakes(true)
    setError(null)

    try {
      const data =
        await fetchJson<{
          makes: VehicleMakePayload[]
        }>('/api/vehicles/makes')

      setMakes(
        Array.isArray(data.makes)
          ? data.makes
          : [],
      )

      return true
    } catch {
      setMakes([])
      setError(
        'Não foi possível carregar as marcas de veículo. Verifica a ligação e tenta novamente.',
      )

      return false
    } finally {
      setLoadingMakes(false)
    }
  }, [])

  const loadModelsForMake =
    useCallback(
      async (
        nextMakeId: string,
      ): Promise<VehicleModelPayload[]> => {
        const request =
          ++makeRequestRef.current

        setLoadingModels(true)
        setError(null)

        try {
          const data =
            await fetchJson<{
              models: VehicleModelPayload[]
            }>(
              `/api/vehicles/models?makeId=${encodeURIComponent(nextMakeId)}`,
            )

          const loadedModels =
            Array.isArray(data.models)
              ? data.models
              : []

          if (
            request ===
            makeRequestRef.current
          ) {
            setModels(loadedModels)
          }

          return loadedModels
        } catch {
          if (
            request ===
            makeRequestRef.current
          ) {
            setModels([])
            setError(
              'Não foi possível carregar os modelos desta marca. Tenta novamente.',
            )
          }

          return []
        } finally {
          if (
            request ===
            makeRequestRef.current
          ) {
            setLoadingModels(false)
          }
        }
      },
      [],
    )

  const loadSpecsForModel =
    useCallback(
      async (
        nextModelId: string,
      ): Promise<VehicleSpecPayload[]> => {
        const request =
          ++modelRequestRef.current

        setLoadingSpecs(true)
        setError(null)

        try {
          const data =
            await fetchJson<{
              specs: VehicleSpecPayload[]
            }>(
              `/api/vehicles/specs?modelId=${encodeURIComponent(nextModelId)}`,
            )

          const loadedSpecs =
            Array.isArray(data.specs)
              ? data.specs
              : []

          if (
            request ===
            modelRequestRef.current
          ) {
            setSpecs(loadedSpecs)
          }

          return loadedSpecs
        } catch {
          if (
            request ===
            modelRequestRef.current
          ) {
            setSpecs([])
            setError(
              'Não foi possível carregar as especificações deste modelo. Tenta novamente.',
            )
          }

          return []
        } finally {
          if (
            request ===
            modelRequestRef.current
          ) {
            setLoadingSpecs(false)
          }
        }
      },
      [],
    )

  /**
   * Carga inicial: lista de marcas + pré-seleção da
   * cadeia guardada (marca → modelo → especificação).
   */
  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const stored =
        readVehicleSelection()

      const loaded = await loadMakes()

      if (cancelled || !loaded) {
        return
      }

      if (stored) {
        setSelected(stored)
      } else {
        return
      }

      const loadedModels =
        await loadModelsForMake(
          stored.makeId,
        )

      if (
        cancelled ||
        !loadedModels.some(
          (model) =>
            model.id === stored.modelId,
        )
      ) {
        return
      }

      setMakeId(stored.makeId)

      const loadedSpecs =
        await loadSpecsForModel(
          stored.modelId,
        )

      if (
        cancelled ||
        !loadedSpecs.some(
          (spec) => spec.id === stored.specId,
        )
      ) {
        return
      }

      setModelId(stored.modelId)
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [loadMakes, loadModelsForMake, loadSpecsForModel])

  const handleMakeChange: ChangeEventHandler<HTMLSelectElement> =
    async (event) => {
      const nextMakeId =
        event.target.value

      setMakeId(nextMakeId)
      setModelId('')
      setSpecs([])

      if (!nextMakeId) {
        return
      }

      await loadModelsForMake(nextMakeId)
    }

  const handleModelChange: ChangeEventHandler<HTMLSelectElement> =
    async (event) => {
      const nextModelId =
        event.target.value

      setModelId(nextModelId)

      if (!nextModelId) {
        setSpecs([])
        return
      }

      await loadSpecsForModel(nextModelId)
    }

  const handleSpecChange: ChangeEventHandler<HTMLSelectElement> =
    (event) => {
      const nextSpecId =
        event.target.value

      if (
        !nextSpecId ||
        !makeId ||
        !modelId
      ) {
        return
      }

      const make = makes.find(
        (item) => item.id === makeId,
      )
      const model = models.find(
        (item) => item.id === modelId,
      )
      const spec = specs.find(
        (item) => item.id === nextSpecId,
      )

      if (!make || !model || !spec) {
        return
      }

      const next: VehicleSelection = {
        specId: spec.id,
        label: buildVehicleSelectionLabel({
          makeName: make.name,
          modelName: model.name,
          specLabel: spec.engine,
        }),
        makeId,
        modelId,
      }

      setSelected(next)
      writeVehicleSelection(next)
    }

  const handleClear = () => {
    setSelected(null)
    clearVehicleSelection()
  }

  const handleRetry = () => {
    void loadMakes()
  }

  return (
    <div>
      {error ? (
        <div
          className="border border-red-200 bg-red-50 px-4 py-3"
          data-testid="vehicle-selector-error"
        >
          <p
            role="alert"
            className="text-sm font-semibold text-red-700"
          >
            {error}
          </p>

          <button
            type="button"
            onClick={handleRetry}
            className={SECONDARY_BUTTON_CLASS}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      <div
        aria-live="polite"
        data-testid="vehicle-selector-status"
        className="border border-gray-200 bg-gray-50 px-4 py-3"
      >
        {selected ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-gray-900">
              Veículo guardado:{' '}
              <span className="text-brand">
                {selected.label}
              </span>
            </p>

            <button
              type="button"
              onClick={handleClear}
              className={SECONDARY_BUTTON_CLASS}
            >
              Limpar
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Nenhum veículo guardado
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="vehicle-make"
            className={LABEL_CLASS}
          >
            Marca
          </label>

          <select
            id="vehicle-make"
            value={makeId}
            onChange={handleMakeChange}
            disabled={
              loadingMakes || makes.length === 0
            }
            className={SELECT_CLASS}
          >
            <option value="">
              Escolhe a marca
            </option>

            {makes.map((make) => (
              <option
                key={make.id}
                value={make.id}
              >
                {make.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="vehicle-model"
            className={LABEL_CLASS}
          >
            Modelo
          </label>

          <select
            id="vehicle-model"
            value={modelId}
            onChange={handleModelChange}
            disabled={
              !makeId ||
              loadingModels ||
              models.length === 0
            }
            className={SELECT_CLASS}
          >
            <option value="">
              {loadingModels
                ? 'A carregar…'
                : 'Escolhe o modelo'}
            </option>

            {models.map((model) => (
              <option
                key={model.id}
                value={model.id}
              >
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="vehicle-spec"
            className={LABEL_CLASS}
          >
            Especificação
          </label>

          <select
            id="vehicle-spec"
            value={selected?.specId ?? ''}
            onChange={handleSpecChange}
            disabled={
              !modelId ||
              loadingSpecs ||
              specs.length === 0
            }
            className={SELECT_CLASS}
          >
            <option value="">
              {loadingSpecs
                ? 'A carregar…'
                : 'Escolhe a especificação'}
            </option>

            {specs.map((spec) => (
              <option
                key={spec.id}
                value={spec.id}
              >
                {specOptionLabel(spec)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
