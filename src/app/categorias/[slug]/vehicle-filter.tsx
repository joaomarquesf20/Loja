'use client'

import {
  useMemo,
  useState,
} from 'react'
import {
  useRouter,
  useSearchParams,
} from 'next/navigation'
import type { CatalogVehicleConfiguration } from '@/server/catalog'

type VehicleFilterProps = {
  categorySlug: string
  configurations: CatalogVehicleConfiguration[]
  selectedConfigurationId?: string
}

type VehicleBrandOption = {
  id: string
  name: string
}

type VehicleModelOption = {
  id: string
  name: string
}

type VehicleGenerationOption = {
  id: string
  name: string
}

const selectClass =
  'mt-1.5 block h-10 w-full rounded-sm border border-white/10 bg-[#15181b] px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-35 focus:border-brand/60'

function uniqueById<
  T extends { id: string },
>(items: T[]) {
  const itemsById =
    new Map<string, T>()

  for (const item of items) {
    if (!itemsById.has(item.id)) {
      itemsById.set(item.id, item)
    }
  }

  return Array.from(
    itemsById.values(),
  )
}

function formatYears(
  yearFrom: number | null,
  yearTo: number | null,
) {
  if (
    yearFrom !== null &&
    yearTo !== null
  ) {
    return `${yearFrom}–${yearTo}`
  }

  if (yearFrom !== null) {
    return `desde ${yearFrom}`
  }

  if (yearTo !== null) {
    return `até ${yearTo}`
  }

  return null
}

function formatConfigurationLabel(
  configuration: CatalogVehicleConfiguration,
) {
  const details: string[] = []

  const years = formatYears(
    configuration.yearFrom,
    configuration.yearTo,
  )

  if (years) {
    details.push(years)
  }

  if (configuration.engineCode) {
    details.push(
      `motor ${configuration.engineCode}`,
    )
  }

  if (configuration.powerKw !== null) {
    details.push(
      `${configuration.powerKw} kW`,
    )
  }

  if (details.length === 0) {
    return configuration.name
  }

  return `${configuration.name} — ${details.join(
    ' · ',
  )}`
}

export default function VehicleFilter({
  categorySlug,
  configurations,
  selectedConfigurationId,
}: VehicleFilterProps) {
  const router = useRouter()
  const searchParams =
    useSearchParams()

  const selectedConfiguration =
    useMemo(
      () =>
        configurations.find(
          (configuration) =>
            configuration.id ===
            selectedConfigurationId,
        ),
      [
        configurations,
        selectedConfigurationId,
      ],
    )

  const [brandId, setBrandId] =
    useState(
      selectedConfiguration?.generation
        .model.brand.id ?? '',
    )

  const [modelId, setModelId] =
    useState(
      selectedConfiguration?.generation
        .model.id ?? '',
    )

  const [
    generationId,
    setGenerationId,
  ] = useState(
    selectedConfiguration?.generation.id ??
      '',
  )

  const [
    configurationId,
    setConfigurationId,
  ] = useState(
    selectedConfiguration?.id ?? '',
  )

  const brands =
    useMemo<VehicleBrandOption[]>(
      () =>
        uniqueById(
          configurations.map(
            (configuration) => ({
              id:
                configuration.generation.model
                  .brand.id,
              name:
                configuration.generation.model
                  .brand.name,
            }),
          ),
        ).sort((first, second) =>
          first.name.localeCompare(
            second.name,
          ),
        ),
      [configurations],
    )

  const models =
    useMemo<VehicleModelOption[]>(
      () => {
        if (!brandId) {
          return []
        }

        return uniqueById(
          configurations
            .filter(
              (configuration) =>
                configuration.generation.model
                  .brand.id ===
                brandId,
            )
            .map(
              (configuration) => ({
                id:
                  configuration.generation
                    .model.id,
                name:
                  configuration.generation
                    .model.name,
              }),
            ),
        ).sort((first, second) =>
          first.name.localeCompare(
            second.name,
          ),
        )
      },
      [brandId, configurations],
    )

  const generations =
    useMemo<VehicleGenerationOption[]>(
      () => {
        if (!modelId) {
          return []
        }

        return uniqueById(
          configurations
            .filter(
              (configuration) =>
                configuration.generation.model
                  .id === modelId,
            )
            .map(
              (configuration) => ({
                id:
                  configuration.generation.id,
                name:
                  configuration.generation
                    .name,
              }),
            ),
        ).sort((first, second) =>
          first.name.localeCompare(
            second.name,
          ),
        )
      },
      [configurations, modelId],
    )

  const availableConfigurations =
    useMemo(() => {
      if (!generationId) {
        return []
      }

      return configurations.filter(
        (configuration) =>
          configuration.generation.id ===
          generationId,
      )
    }, [
      configurations,
      generationId,
    ])

  function navigateWithVehicle(
    nextConfigurationId?: string,
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString(),
      )

    if (nextConfigurationId) {
      params.set(
        'vehicle',
        nextConfigurationId,
      )
    } else {
      params.delete('vehicle')
    }

    const query = params.toString()

    router.push(
      query
        ? `/categorias/${categorySlug}?${query}`
        : `/categorias/${categorySlug}`,
    )
  }

  function handleBrandChange(
    nextBrandId: string,
  ) {
    setBrandId(nextBrandId)
    setModelId('')
    setGenerationId('')
    setConfigurationId('')
  }

  function handleModelChange(
    nextModelId: string,
  ) {
    setModelId(nextModelId)
    setGenerationId('')
    setConfigurationId('')
  }

  function handleGenerationChange(
    nextGenerationId: string,
  ) {
    setGenerationId(
      nextGenerationId,
    )
    setConfigurationId('')
  }

  function handleConfigurationChange(
    nextConfigurationId: string,
  ) {
    setConfigurationId(
      nextConfigurationId,
    )

    navigateWithVehicle(
      nextConfigurationId ||
        undefined,
    )
  }

  function removeVehicle() {
    setBrandId('')
    setModelId('')
    setGenerationId('')
    setConfigurationId('')
    navigateWithVehicle()
  }

  if (configurations.length === 0) {
    return null
  }

  return (
    <section className="border-t border-white/8 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">
          Compatibilidade
        </h3>

        {selectedConfigurationId && (
          <button
            type="button"
            onClick={removeVehicle}
            className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/34 transition hover:text-white"
          >
            Limpar
          </button>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-white/36">
        Mostra apenas produtos com
        compatibilidade registada para o
        veículo escolhido.
      </p>

      <div className="mt-4 grid gap-3">
        <label className="block text-xs font-semibold text-white/52">
          Marca
          <select
            value={brandId}
            onChange={(event) =>
              handleBrandChange(
                event.target.value,
              )
            }
            className={selectClass}
          >
            <option value="">
              Escolher marca
            </option>
            {brands.map((brand) => (
              <option
                key={brand.id}
                value={brand.id}
              >
                {brand.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-white/52">
          Modelo
          <select
            value={modelId}
            disabled={!brandId}
            onChange={(event) =>
              handleModelChange(
                event.target.value,
              )
            }
            className={selectClass}
          >
            <option value="">
              Escolher modelo
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
        </label>

        <label className="block text-xs font-semibold text-white/52">
          Geração
          <select
            value={generationId}
            disabled={!modelId}
            onChange={(event) =>
              handleGenerationChange(
                event.target.value,
              )
            }
            className={selectClass}
          >
            <option value="">
              Escolher geração
            </option>
            {generations.map(
              (generation) => (
                <option
                  key={
                    generation.id
                  }
                  value={
                    generation.id
                  }
                >
                  {generation.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block text-xs font-semibold text-white/52">
          Configuração
          <select
            value={configurationId}
            disabled={!generationId}
            onChange={(event) =>
              handleConfigurationChange(
                event.target.value,
              )
            }
            className={selectClass}
          >
            <option value="">
              Escolher configuração
            </option>
            {availableConfigurations.map(
              (configuration) => (
                <option
                  key={
                    configuration.id
                  }
                  value={
                    configuration.id
                  }
                >
                  {formatConfigurationLabel(
                    configuration,
                  )}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      {selectedConfiguration && (
        <p className="mt-3 text-xs font-semibold leading-5 text-white/56">
          {
            selectedConfiguration.generation
              .model.brand.name
          }{' '}
          {
            selectedConfiguration.generation
              .model.name
          }{' '}
          {
            selectedConfiguration.generation
              .name
          }
          {' · '}
          {selectedConfiguration.name}
        </p>
      )}
    </section>
  )
}
