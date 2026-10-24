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
 * Selector em cascata de veículo (Épico 2 — Etapa
 * 4): Marca → Modelo → Configuração, combinando os
 * endpoints públicos do serviço de pesquisa de
 * veículos. A configuração escolhida é persistida
 * (localStorage + evento) e consultada pelo filtro
 * da grelha de categoria e pelo badge de ficha.
 *
 * Os `slugs` demasiado vagos não são guardados como
 * identidade — o que persiste é o
 * `configurationId`; os slugs servem apenas para
 * voltar a pré-selecionar a cascata.
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

type VehicleConfigurationPayload = {
  id: string
  name: string
  engineCode: string | null
  powerKw: string | number | null
}

type VehicleGenerationPayload = {
  id: string
  name: string
  configurations: VehicleConfigurationPayload[]
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

function findConfiguration(
  generations: VehicleGenerationPayload[],
  configurationId: string,
) {
  for (const generation of generations) {
    const configuration =
      generation.configurations.find(
        (item) => item.id === configurationId,
      )

    if (configuration) {
      return configuration
    }
  }

  return null
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
  const [generations, setGenerations] =
    useState<VehicleGenerationPayload[]>([])
  const [makeSlug, setMakeSlug] = useState('')
  const [modelSlug, setModelSlug] = useState('')
  const [selected, setSelected] =
    useState<VehicleSelection | null>(null)
  const [loadingMakes, setLoadingMakes] =
    useState(true)
  const [loadingModels, setLoadingModels] =
    useState(false)
  const [
    loadingGenerations,
    setLoadingGenerations,
  ] = useState(false)
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
        await fetchJson<VehicleMakePayload[]>(
          '/api/vehicles/makes',
        )

      setMakes(Array.isArray(data) ? data : [])

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

  /**
   * Carga inicial: lista de marcas + pré-seleção da
   * cadeia guardada (marca → modelo → configuração).
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

      const nextMakeRequest =
        ++makeRequestRef.current

      setLoadingModels(true)

      try {
        const data =
          await fetchJson<
            VehicleModelPayload[]
          >(
            `/api/vehicles/makes/${encodeURIComponent(stored.makeSlug)}/models`,
          )

        if (
          cancelled ||
          nextMakeRequest !==
            makeRequestRef.current
        ) {
          return
        }

        setModels(
          Array.isArray(data)
            ? data
            : [],
        )
        setMakeSlug(stored.makeSlug)
      } catch {
        if (cancelled) {
          return
        }

        setError(
          'Não foi possível restaurar os modelos do veículo guardado.',
        )

        return
      } finally {
        if (
          !cancelled &&
          nextMakeRequest ===
            makeRequestRef.current
        ) {
          setLoadingModels(false)
        }
      }

      const nextModelRequest =
        ++modelRequestRef.current

      setLoadingGenerations(true)

      try {
        const data =
          await fetchJson<
            VehicleGenerationPayload[]
          >(
            `/api/vehicles/models/${encodeURIComponent(stored.modelSlug)}/generations`,
          )

        if (
          cancelled ||
          nextModelRequest !==
            modelRequestRef.current
        ) {
          return
        }

        setGenerations(
          Array.isArray(data)
            ? data
            : [],
        )
        setModelSlug(stored.modelSlug)
      } catch {
        if (cancelled) {
          return
        }

        setError(
          'Não foi possível restaurar as configurações do veículo guardado.',
        )
      } finally {
        if (
          !cancelled &&
          nextModelRequest ===
            modelRequestRef.current
        ) {
          setLoadingGenerations(false)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [loadMakes])

  const handleMakeChange: ChangeEventHandler<HTMLSelectElement> =
    async (event) => {
      const nextMakeSlug =
        event.target.value

      setMakeSlug(nextMakeSlug)
      setModelSlug('')
      setModels([])
      setGenerations([])

      if (!nextMakeSlug) {
        return
      }

      const request =
        ++makeRequestRef.current

      setLoadingModels(true)
      setError(null)

      try {
        const data =
          await fetchJson<
            VehicleModelPayload[]
          >(
            `/api/vehicles/makes/${encodeURIComponent(nextMakeSlug)}/models`,
          )

        if (
          request !==
          makeRequestRef.current
        ) {
          return
        }

        setModels(
          Array.isArray(data)
            ? data
            : [],
        )
      } catch {
        if (
          request !==
          makeRequestRef.current
        ) {
          return
        }

        setModels([])
        setError(
          'Não foi possível carregar os modelos desta marca. Tenta novamente.',
        )
      } finally {
        if (
          request ===
          makeRequestRef.current
        ) {
          setLoadingModels(false)
        }
      }
    }

  const handleModelChange: ChangeEventHandler<HTMLSelectElement> =
    async (event) => {
      const nextModelSlug =
        event.target.value

      setModelSlug(nextModelSlug)
      setGenerations([])

      if (!nextModelSlug) {
        return
      }

      const request =
        ++modelRequestRef.current

      setLoadingGenerations(true)
      setError(null)

      try {
        const data =
          await fetchJson<
            VehicleGenerationPayload[]
          >(
            `/api/vehicles/models/${encodeURIComponent(nextModelSlug)}/generations`,
          )

        if (
          request !==
          modelRequestRef.current
        ) {
          return
        }

        setGenerations(
          Array.isArray(data)
            ? data
            : [],
        )
      } catch {
        if (
          request !==
          modelRequestRef.current
        ) {
          return
        }

        setGenerations([])
        setError(
          'Não foi possível carregar as configurações deste modelo. Tenta novamente.',
        )
      } finally {
        if (
          request ===
          modelRequestRef.current
        ) {
          setLoadingGenerations(false)
        }
      }
    }

  const handleConfigurationChange: ChangeEventHandler<HTMLSelectElement> =
    (event) => {
      const configurationId =
        event.target.value

      if (
        !configurationId ||
        !makeSlug ||
        !modelSlug
      ) {
        return
      }

      const make = makes.find(
        (item) => item.slug === makeSlug,
      )
      const model = models.find(
        (item) => item.slug === modelSlug,
      )
      const configuration =
        findConfiguration(
          generations,
          configurationId,
        )

      if (
        !make ||
        !model ||
        !configuration
      ) {
        return
      }

      const next: VehicleSelection = {
        configurationId:
          configuration.id,
        label:
          buildVehicleSelectionLabel({
            makeName: make.name,
            modelName: model.name,
            configurationName:
              configuration.name,
          }),
        makeSlug,
        modelSlug,
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
            value={makeSlug}
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
                value={make.slug}
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
            value={modelSlug}
            onChange={handleModelChange}
            disabled={
              !makeSlug ||
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
                value={model.slug}
              >
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="vehicle-configuration"
            className={LABEL_CLASS}
          >
            Configuração
          </label>

          <select
            id="vehicle-configuration"
            value={selected?.configurationId ?? ''}
            onChange={handleConfigurationChange}
            disabled={
              !modelSlug ||
              loadingGenerations ||
              generations.length === 0
            }
            className={SELECT_CLASS}
          >
            <option value="">
              {loadingGenerations
                ? 'A carregar…'
                : 'Escolhe a configuração'}
            </option>

            {generations.map(
              (generation) => (
                <optgroup
                  key={generation.id}
                  label={generation.name}
                >
                  {generation.configurations.map(
                    (configuration) => (
                      <option
                        key={configuration.id}
                        value={configuration.id}
                      >
                        {configuration.engineCode
                          ? `${configuration.name} (${configuration.engineCode})`
                          : configuration.name}
                      </option>
                    ),
                  )}
                </optgroup>
              ),
            )}
          </select>
        </div>
      </div>
    </div>
  )
}
