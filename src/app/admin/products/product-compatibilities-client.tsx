'use client'

import { FormEvent, useEffect, useState } from 'react'

type VehicleBrand = {
  id: string
  name: string
}

type VehicleModel = {
  id: string
  brandId: string
  name: string
}

type VehicleGeneration = {
  id: string
  modelId: string
  name: string
}

type VehicleConfiguration = {
  id: string
  generationId: string
  name: string
  engineCode: string | null
  engineType: string | null
  displacementCc: number | null
  powerKw: number | string | null
  bodyType: string | null
  yearFrom: number | null
  yearTo: number | null
}

type ProductCompatibility = {
  id: string
  productId: string
  vehicleConfigurationId: string | null
  vehicleBrand: {
    id: string
    name: string
  }
  vehicleModel: {
    id: string
    name: string
  }
  vehicleGeneration: {
    id: string
    name: string
  } | null
  vehicleConfiguration: {
    id: string
    name: string
    engineCode: string | null
    engineType: string | null
    displacementCc: number | null
    powerKw: number | null
    bodyType: string | null
    yearFrom: number | null
    yearTo: number | null
  } | null
}

type Props = {
  productId: string
  productName: string
  onClose: () => void
}

async function getErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as {
      error?: string
    }

    return data.error ?? 'Ocorreu um erro inesperado'
  } catch {
    return 'Ocorreu um erro inesperado'
  }
}

function configurationDetails(
  configuration: ProductCompatibility['vehicleConfiguration'],
) {
  if (!configuration) {
    return null
  }

  const details: string[] = []

  if (configuration.engineCode) {
    details.push(`Motor ${configuration.engineCode}`)
  }

  if (configuration.engineType) {
    details.push(configuration.engineType)
  }

  if (configuration.displacementCc !== null) {
    details.push(`${configuration.displacementCc} cc`)
  }

  if (configuration.powerKw !== null) {
    details.push(`${configuration.powerKw} kW`)
  }

  if (configuration.bodyType) {
    details.push(configuration.bodyType)
  }

  if (
    configuration.yearFrom !== null ||
    configuration.yearTo !== null
  ) {
    if (
      configuration.yearFrom !== null &&
      configuration.yearTo !== null
    ) {
      details.push(
        `${configuration.yearFrom}–${configuration.yearTo}`,
      )
    } else if (configuration.yearFrom !== null) {
      details.push(`Desde ${configuration.yearFrom}`)
    } else if (configuration.yearTo !== null) {
      details.push(`Até ${configuration.yearTo}`)
    }
  }

  return details.length > 0
    ? details.join(' · ')
    : null
}

export default function ProductCompatibilitiesClient({
  productId,
  productName,
  onClose,
}: Props) {
  const [brands, setBrands] = useState<VehicleBrand[]>([])
  const [models, setModels] = useState<VehicleModel[]>([])
  const [generations, setGenerations] = useState<
    VehicleGeneration[]
  >([])
  const [configurations, setConfigurations] = useState<
    VehicleConfiguration[]
  >([])
  const [compatibilities, setCompatibilities] = useState<
    ProductCompatibility[]
  >([])

  const [brandId, setBrandId] = useState('')
  const [modelId, setModelId] = useState('')
  const [generationId, setGenerationId] = useState('')
  const [configurationId, setConfigurationId] = useState('')

  const [loading, setLoading] = useState(true)
  const [loadingModels, setLoadingModels] = useState(false)
  const [loadingGenerations, setLoadingGenerations] =
    useState(false)
  const [loadingConfigurations, setLoadingConfigurations] =
    useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reloadCompatibilities() {
    const response = await fetch(
      `/api/admin/products/${productId}/compatibilities`,
    )

    if (!response.ok) {
      throw new Error(await getErrorMessage(response))
    }

    const data =
      (await response.json()) as ProductCompatibility[]

    setCompatibilities(data)
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        setLoading(true)
        setError(null)

        const [brandsResponse, compatibilitiesResponse] =
          await Promise.all([
            fetch('/api/admin/vehicle-brands'),
            fetch(
              `/api/admin/products/${productId}/compatibilities`,
            ),
          ])

        if (!brandsResponse.ok) {
          throw new Error(
            await getErrorMessage(brandsResponse),
          )
        }

        if (!compatibilitiesResponse.ok) {
          throw new Error(
            await getErrorMessage(compatibilitiesResponse),
          )
        }

        const brandsData =
          (await brandsResponse.json()) as VehicleBrand[]
        const compatibilitiesData =
          (await compatibilitiesResponse.json()) as ProductCompatibility[]

        if (cancelled) {
          return
        }

        setBrands(brandsData)
        setCompatibilities(compatibilitiesData)
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar as compatibilidades',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

void loadInitialData()

    return () => {
      cancelled = true
    }
  }, [productId])

  async function handleBrandChange(nextBrandId: string) {
    setBrandId(nextBrandId)
    setModelId('')
    setGenerationId('')
    setConfigurationId('')
    setModels([])
    setGenerations([])
    setConfigurations([])
    setError(null)

    if (!nextBrandId) {
      return
    }

    try {
      setLoadingModels(true)

      const response = await fetch(
        `/api/admin/vehicle-models?brandId=${encodeURIComponent(
          nextBrandId,
        )}`,
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const data = (await response.json()) as VehicleModel[]
      setModels(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar os modelos',
      )
    } finally {
      setLoadingModels(false)
    }
  }

  async function handleModelChange(nextModelId: string) {
    setModelId(nextModelId)
    setGenerationId('')
    setConfigurationId('')
    setGenerations([])
    setConfigurations([])
    setError(null)

    if (!nextModelId) {
      return
    }

    try {
      setLoadingGenerations(true)

      const response = await fetch(
        `/api/admin/vehicle-generations?modelId=${encodeURIComponent(
          nextModelId,
        )}`,
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const data =
        (await response.json()) as VehicleGeneration[]

      setGenerations(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar as gerações',
      )
    } finally {
      setLoadingGenerations(false)
    }
  }

  async function handleGenerationChange(
    nextGenerationId: string,
  ) {
    setGenerationId(nextGenerationId)
    setConfigurationId('')
    setConfigurations([])
    setError(null)

    if (!nextGenerationId) {
      return
    }

    try {
      setLoadingConfigurations(true)

      const response = await fetch(
        `/api/admin/vehicle-configurations?generationId=${encodeURIComponent(
          nextGenerationId,
        )}`,
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const data =
        (await response.json()) as VehicleConfiguration[]

      setConfigurations(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar as configurações',
      )
    } finally {
      setLoadingConfigurations(false)
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (submitting) {
      return
    }

    if (!configurationId) {
      setError('Seleciona uma configuração de veículo')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch(
        `/api/admin/products/${productId}/compatibilities`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vehicleConfigurationId: configurationId,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      await reloadCompatibilities()

      setConfigurationId('')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível adicionar a compatibilidade',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(
    compatibility: ProductCompatibility,
  ) {
    if (submitting) {
      return
    }

    if (!compatibility.vehicleConfigurationId) {
      setError(
        'Esta associação não possui uma configuração de veículo removível',
      )
      return
    }

    const confirmed = window.confirm(
      `Remover esta compatibilidade de "${productName}"?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch(
        `/api/admin/products/${productId}/compatibilities`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vehicleConfigurationId:
              compatibility.vehicleConfigurationId,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      await reloadCompatibilities()
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Não foi possível remover a compatibilidade',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded border p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Compatibilidades
          </h2>
          <p className="text-sm text-gray-600">
            Produto: {productName}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Fechar
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p>A carregar compatibilidades...</p>
      ) : (
        <div className="space-y-6">
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <label className="flex flex-col gap-1">
              <span>Marca do veículo</span>
              <select
                value={brandId}
                disabled={submitting || brands.length === 0}
                onChange={(event) => {
                  void handleBrandChange(event.target.value)
                }}
                className="rounded border px-3 py-2"
              >
                <option value="">
                  Selecionar marca
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

            <label className="flex flex-col gap-1">
              <span>Modelo</span>
              <select
                value={modelId}
                disabled={
                  submitting ||
                  !brandId ||
                  loadingModels
                }
                onChange={(event) => {
                  void handleModelChange(event.target.value)
                }}
                className="rounded border px-3 py-2"
              >
                <option value="">
                  {loadingModels
                    ? 'A carregar modelos...'
                    : 'Selecionar modelo'}
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

            <label className="flex flex-col gap-1">
              <span>Geração</span>
              <select
                value={generationId}
                disabled={
                  submitting ||
                  !modelId ||
                  loadingGenerations
                }
                onChange={(event) => {
                  void handleGenerationChange(
                    event.target.value,
                  )
                }}
                className="rounded border px-3 py-2"
              >
                <option value="">
                  {loadingGenerations
                    ? 'A carregar gerações...'
                    : 'Selecionar geração'}
                </option>

                {generations.map((generation) => (
                  <option
                    key={generation.id}
                    value={generation.id}
                  >
                    {generation.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span>Configuração</span>
              <select
                value={configurationId}
                disabled={
                  submitting ||
                  !generationId ||
                  loadingConfigurations
                }
                onChange={(event) =>
                  setConfigurationId(event.target.value)
                }
                className="rounded border px-3 py-2"
              >
                <option value="">
                  {loadingConfigurations
                    ? 'A carregar configurações...'
                    : 'Selecionar configuração'}
                </option>

                {configurations.map((configuration) => (
                  <option
                    key={configuration.id}
                    value={configuration.id}
                  >
                    {configuration.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2 xl:col-span-4">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !configurationId
                }
                className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? 'A guardar...'
                  : 'Adicionar compatibilidade'}
              </button>
            </div>
          </form>

          {brands.length === 0 && (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
              Não existem marcas de veículos disponíveis.
              Cria primeiro a hierarquia automóvel no painel
              de administração.
            </p>
          )}

          <div>
            <h3 className="mb-3 text-lg font-semibold">
              Compatibilidades atuais
            </h3>

            {compatibilities.length === 0 ? (
              <p>
                Este produto ainda não possui
                compatibilidades de veículo.
              </p>
            ) : (
              <div className="space-y-3">
                {compatibilities.map((compatibility) => {
                  const details = configurationDetails(
                    compatibility.vehicleConfiguration,
                  )

                  return (
                    <div
                      key={compatibility.id}
                      className="flex flex-col gap-3 rounded border p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {compatibility.vehicleBrand.name}
                          {' → '}
                          {compatibility.vehicleModel.name}

                          {compatibility.vehicleGeneration && (
                            <>
                              {' → '}
                              {
                                compatibility
                                  .vehicleGeneration.name
                              }
                            </>
                          )}

                          {compatibility.vehicleConfiguration && (
                            <>
                              {' → '}
                              {
                                compatibility
                                  .vehicleConfiguration.name
                              }
                            </>
                          )}
                        </p>

                        {details && (
                          <p className="mt-1 text-sm text-gray-600">
                            {details}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={
                          submitting ||
                          !compatibility.vehicleConfigurationId
                        }
                        onClick={() => {
                          void handleRemove(compatibility)
                        }}
                        className="self-start rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50 md:self-auto"
                      >
                        Remover
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}