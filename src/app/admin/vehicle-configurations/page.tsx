'use client'

import Link from 'next/link'
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

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
  platform: string | null
  description: string | null
}

type VehicleConfiguration = {
  id: string
  generationId: string
  name: string
  engineCode: string | null
  engineType: string | null
  displacementCc: number | null
  powerKw: number | null
  bodyType: string | null
  yearFrom: number | null
  yearTo: number | null
}

function sortVehicleBrands(
  items: VehicleBrand[],
) {
  return [...items].sort((a, b) =>
    a.name.localeCompare(
      b.name,
      'pt-PT',
    ),
  )
}

function sortVehicleModels(
  items: VehicleModel[],
) {
  return [...items].sort((a, b) =>
    a.name.localeCompare(
      b.name,
      'pt-PT',
    ),
  )
}

function sortVehicleGenerations(
  items: VehicleGeneration[],
) {
  return [...items].sort((a, b) =>
    a.name.localeCompare(
      b.name,
      'pt-PT',
    ),
  )
}

function sortVehicleConfigurations(
  items: VehicleConfiguration[],
) {
  return [...items].sort((a, b) =>
    a.name.localeCompare(
      b.name,
      'pt-PT',
    ),
  )
}

async function getApiError(
  response: Response,
) {
  try {
    const data =
      (await response.json()) as {
        error?: unknown
      }

    if (
      typeof data.error === 'string' &&
      data.error.trim() !== ''
    ) {
      return data.error
    }
  } catch {
    // A resposta pode não conter JSON.
  }

  return `Erro HTTP ${response.status}`
}

function nullableText(
  value: string,
) {
  const trimmed = value.trim()

  return trimmed === ''
    ? null
    : trimmed
}

function nullablePositiveNumber(
  value: string,
  label: string,
  integer = false,
) {
  const trimmed = value.trim()

  if (trimmed === '') {
    return null
  }

  const parsed = Number(
    trimmed.replace(',', '.'),
  )

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    (integer &&
      !Number.isInteger(parsed))
  ) {
    throw new Error(
      `${label} inválido.`,
    )
  }

  return parsed
}

function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      maximumFractionDigits: 2,
    },
  ).format(value)
}

function formatYears(
  yearFrom: number | null,
  yearTo: number | null,
) {
  if (
    yearFrom === null &&
    yearTo === null
  ) {
    return '—'
  }

  if (
    yearFrom !== null &&
    yearTo !== null
  ) {
    if (yearFrom === yearTo) {
      return String(yearFrom)
    }

    return `${yearFrom}–${yearTo}`
  }

  if (yearFrom !== null) {
    return `Desde ${yearFrom}`
  }

  return `Até ${yearTo}`
}

export default function VehicleConfigurationsPage() {
  const [
    brands,
    setBrands,
  ] = useState<VehicleBrand[]>([])

  const [
    filterModels,
    setFilterModels,
  ] = useState<VehicleModel[]>([])

  const [
    filterGenerations,
    setFilterGenerations,
  ] = useState<
    VehicleGeneration[]
  >([])

  const [
    configurations,
    setConfigurations,
  ] = useState<
    VehicleConfiguration[]
  >([])

  const [
    formModels,
    setFormModels,
  ] = useState<VehicleModel[]>([])

  const [
    formGenerations,
    setFormGenerations,
  ] = useState<
    VehicleGeneration[]
  >([])

  const [
    selectedBrandId,
    setSelectedBrandId,
  ] = useState('')

  const [
    selectedModelId,
    setSelectedModelId,
  ] = useState('')

  const [
    selectedGenerationId,
    setSelectedGenerationId,
  ] = useState('')

  const [
    formBrandId,
    setFormBrandId,
  ] = useState('')

  const [
    formModelId,
    setFormModelId,
  ] = useState('')

  const [
    formGenerationId,
    setFormGenerationId,
  ] = useState('')

  const [
    name,
    setName,
  ] = useState('')

  const [
    engineCode,
    setEngineCode,
  ] = useState('')

  const [
    engineType,
    setEngineType,
  ] = useState('')

  const [
    displacementCc,
    setDisplacementCc,
  ] = useState('')

  const [
    powerKw,
    setPowerKw,
  ] = useState('')

  const [
    bodyType,
    setBodyType,
  ] = useState('')

  const [
    yearFrom,
    setYearFrom,
  ] = useState('')

  const [
    yearTo,
    setYearTo,
  ] = useState('')

  const [
    editingId,
    setEditingId,
  ] = useState<
    string | null
  >(null)

  const [
    loadingBrands,
    setLoadingBrands,
  ] = useState(true)

  const [
    loadingFilterModels,
    setLoadingFilterModels,
  ] = useState(false)

  const [
    loadingFilterGenerations,
    setLoadingFilterGenerations,
  ] = useState(false)

  const [
    loadingConfigurations,
    setLoadingConfigurations,
  ] = useState(false)

  const [
    loadingFormModels,
    setLoadingFormModels,
  ] = useState(false)

  const [
    loadingFormGenerations,
    setLoadingFormGenerations,
  ] = useState(false)

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    deletingId,
    setDeletingId,
  ] = useState<
    string | null
  >(null)

  const [
    loadError,
    setLoadError,
  ] = useState('')

  const [
    formModelsError,
    setFormModelsError,
  ] = useState('')

  const [
    formGenerationsError,
    setFormGenerationsError,
  ] = useState('')

  const [
    actionError,
    setActionError,
  ] = useState('')

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadVehicleBrands() {
      try {
        setLoadingBrands(true)
        setLoadError('')

        const response = await fetch(
          '/api/admin/vehicle-brands',
          {
            signal:
              controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(
              response,
            ),
          )
        }

        const data =
          (await response.json()) as VehicleBrand[]

        const sortedBrands =
          sortVehicleBrands(data)

        setBrands(sortedBrands)

        if (
          sortedBrands.length > 0
        ) {
          const firstBrandId =
            sortedBrands[0].id

          setSelectedBrandId(
            firstBrandId,
          )
          setFormBrandId(
            firstBrandId,
          )
        } else {
          setSelectedBrandId('')
          setSelectedModelId('')
          setSelectedGenerationId('')
          setFormBrandId('')
          setFormModelId('')
          setFormGenerationId('')
          setFilterModels([])
          setFilterGenerations([])
          setFormModels([])
          setFormGenerations([])
          setConfigurations([])
        }
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as marcas de veículos',
        )
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingBrands(
            false,
          )
        }
      }
    }

    void loadVehicleBrands()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!selectedBrandId) {
      return
    }

    const controller =
      new AbortController()

    async function loadFilterModels() {
      try {
        setLoadingFilterModels(
          true,
        )
        setLoadError('')
        setSelectedModelId('')
        setSelectedGenerationId('')
        setFilterGenerations([])
        setConfigurations([])

        const response = await fetch(
          `/api/admin/vehicle-models?brandId=${encodeURIComponent(
            selectedBrandId,
          )}`,
          {
            signal:
              controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(
              response,
            ),
          )
        }

        const data =
          (await response.json()) as VehicleModel[]

        const sortedModels =
          sortVehicleModels(data)

        setFilterModels(
          sortedModels,
        )

        if (
          sortedModels.length > 0
        ) {
          setSelectedModelId(
            sortedModels[0].id,
          )
        } else {
          setSelectedModelId('')
          setSelectedGenerationId('')
          setFilterGenerations([])
          setConfigurations([])
        }
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        setFilterModels([])
        setFilterGenerations([])
        setSelectedModelId('')
        setSelectedGenerationId('')
        setConfigurations([])

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os modelos de veículos',
        )
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingFilterModels(
            false,
          )
        }
      }
    }

    void loadFilterModels()

    return () => {
      controller.abort()
    }
  }, [selectedBrandId])

  useEffect(() => {
    if (!selectedModelId) {
      return
    }

    const controller =
      new AbortController()

    async function loadFilterGenerations() {
      try {
        setLoadingFilterGenerations(
          true,
        )
        setLoadError('')
        setSelectedGenerationId('')
        setConfigurations([])

        const response = await fetch(
          `/api/admin/vehicle-generations?modelId=${encodeURIComponent(
            selectedModelId,
          )}`,
          {
            signal:
              controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(
              response,
            ),
          )
        }

        const data =
          (await response.json()) as VehicleGeneration[]

        const sortedGenerations =
          sortVehicleGenerations(
            data,
          )

        setFilterGenerations(
          sortedGenerations,
        )

        if (
          sortedGenerations.length >
          0
        ) {
          setSelectedGenerationId(
            sortedGenerations[0].id,
          )
        } else {
          setSelectedGenerationId('')
          setConfigurations([])
        }
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        setFilterGenerations([])
        setSelectedGenerationId('')
        setConfigurations([])

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as gerações de veículos',
        )
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingFilterGenerations(
            false,
          )
        }
      }
    }

    void loadFilterGenerations()

    return () => {
      controller.abort()
    }
  }, [selectedModelId])

  useEffect(() => {
    if (!formBrandId) {
      return
    }

    const controller =
      new AbortController()

    async function loadFormModels() {
      try {
        setLoadingFormModels(
          true,
        )
        setFormModelsError('')

        const response = await fetch(
          `/api/admin/vehicle-models?brandId=${encodeURIComponent(
            formBrandId,
          )}`,
          {
            signal:
              controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(
              response,
            ),
          )
        }

        const data =
          (await response.json()) as VehicleModel[]

        const sortedModels =
          sortVehicleModels(data)

        setFormModels(
          sortedModels,
        )

        if (
          sortedModels.length === 0
        ) {
          setFormModelId('')
          setFormGenerationId('')
          setFormGenerations([])
          return
        }

        setFormModelId(
          (current) => {
            if (
              sortedModels.some(
                (vehicleModel) =>
                  vehicleModel.id ===
                  current,
              )
            ) {
              return current
            }

            return sortedModels[0].id
          },
        )
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        setFormModels([])
        setFormGenerations([])
        setFormModelId('')
        setFormGenerationId('')

        setFormModelsError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os modelos de veículos',
        )
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingFormModels(
            false,
          )
        }
      }
    }

    void loadFormModels()

    return () => {
      controller.abort()
    }
  }, [formBrandId])

  useEffect(() => {
    if (!formModelId) {
      return
    }

    const controller =
      new AbortController()

    async function loadFormGenerations() {
      try {
        setLoadingFormGenerations(
          true,
        )
        setFormGenerationsError(
          '',
        )

        const response = await fetch(
          `/api/admin/vehicle-generations?modelId=${encodeURIComponent(
            formModelId,
          )}`,
          {
            signal:
              controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(
              response,
            ),
          )
        }

        const data =
          (await response.json()) as VehicleGeneration[]

        const sortedGenerations =
          sortVehicleGenerations(
            data,
          )

        setFormGenerations(
          sortedGenerations,
        )

        if (
          sortedGenerations.length ===
          0
        ) {
          setFormGenerationId('')
          return
        }

        setFormGenerationId(
          (current) => {
            if (
              sortedGenerations.some(
                (
                  vehicleGeneration,
                ) =>
                  vehicleGeneration.id ===
                  current,
              )
            ) {
              return current
            }

            return sortedGenerations[0]
              .id
          },
        )
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        setFormGenerations([])
        setFormGenerationId('')

        setFormGenerationsError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as gerações de veículos',
        )
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingFormGenerations(
            false,
          )
        }
      }
    }

    void loadFormGenerations()

    return () => {
      controller.abort()
    }
  }, [formModelId])

  useEffect(() => {
    if (!selectedGenerationId) {
      return
    }

    const controller =
      new AbortController()

    async function loadVehicleConfigurations() {
      try {
        setLoadingConfigurations(
          true,
        )
        setLoadError('')
        setActionError('')
        setEditingId(null)

        setFormBrandId(
          selectedBrandId,
        )
        setFormModelId(
          selectedModelId,
        )
        setFormGenerationId(
          selectedGenerationId,
        )

        setName('')
        setEngineCode('')
        setEngineType('')
        setDisplacementCc('')
        setPowerKw('')
        setBodyType('')
        setYearFrom('')
        setYearTo('')

        const response = await fetch(
          `/api/admin/vehicle-configurations?generationId=${encodeURIComponent(
            selectedGenerationId,
          )}`,
          {
            signal:
              controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(
              response,
            ),
          )
        }

        const data =
          (await response.json()) as VehicleConfiguration[]

        setConfigurations(
          sortVehicleConfigurations(
            data,
          ),
        )
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        setConfigurations([])

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as configurações de veículos',
        )
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingConfigurations(
            false,
          )
        }
      }
    }

    void loadVehicleConfigurations()

    return () => {
      controller.abort()
    }
  }, [
    selectedBrandId,
    selectedModelId,
    selectedGenerationId,
  ])

  function resetForm() {
    setFormBrandId(
      selectedBrandId,
    )
    setFormModelId(
      selectedModelId,
    )
    setFormGenerationId(
      selectedGenerationId,
    )

    setName('')
    setEngineCode('')
    setEngineType('')
    setDisplacementCc('')
    setPowerKw('')
    setBodyType('')
    setYearFrom('')
    setYearTo('')

    setEditingId(null)
    setActionError('')
    setFormModelsError('')
    setFormGenerationsError('')
  }

  function startEditing(
    vehicleConfiguration:
      VehicleConfiguration,
  ) {
    setEditingId(
      vehicleConfiguration.id,
    )

    setFormBrandId(
      selectedBrandId,
    )
    setFormModelId(
      selectedModelId,
    )
    setFormGenerationId(
      vehicleConfiguration.generationId,
    )

    setName(
      vehicleConfiguration.name,
    )

    setEngineCode(
      vehicleConfiguration.engineCode ??
        '',
    )

    setEngineType(
      vehicleConfiguration.engineType ??
        '',
    )

    setDisplacementCc(
      vehicleConfiguration.displacementCc ===
        null
        ? ''
        : String(
            vehicleConfiguration.displacementCc,
          ),
    )

    setPowerKw(
      vehicleConfiguration.powerKw ===
        null
        ? ''
        : String(
            vehicleConfiguration.powerKw,
          ),
    )

    setBodyType(
      vehicleConfiguration.bodyType ??
        '',
    )

    setYearFrom(
      vehicleConfiguration.yearFrom ===
        null
        ? ''
        : String(
            vehicleConfiguration.yearFrom,
          ),
    )

    setYearTo(
      vehicleConfiguration.yearTo ===
        null
        ? ''
        : String(
            vehicleConfiguration.yearTo,
          ),
    )

    setActionError('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      submitting ||
      loadingFormModels ||
      loadingFormGenerations
    ) {
      return
    }

    if (!formBrandId) {
      setActionError(
        'Selecione uma marca de veículo.',
      )
      return
    }

    if (!formModelId) {
      setActionError(
        'Selecione um modelo de veículo.',
      )
      return
    }

    if (!formGenerationId) {
      setActionError(
        'Selecione uma geração de veículo.',
      )
      return
    }

    setSubmitting(true)
    setActionError('')

    try {
      const parsedDisplacementCc =
        nullablePositiveNumber(
          displacementCc,
          'Cilindrada',
          true,
        )

      const parsedPowerKw =
        nullablePositiveNumber(
          powerKw,
          'Potência',
        )

      const parsedYearFrom =
        nullablePositiveNumber(
          yearFrom,
          'Ano inicial',
          true,
        )

      const parsedYearTo =
        nullablePositiveNumber(
          yearTo,
          'Ano final',
          true,
        )

      if (
        parsedYearFrom !== null &&
        parsedYearTo !== null &&
        parsedYearTo <
          parsedYearFrom
      ) {
        throw new Error(
          'O ano final não pode ser inferior ao ano inicial.',
        )
      }

      const url = editingId
        ? `/api/admin/vehicle-configurations/${editingId}`
        : '/api/admin/vehicle-configurations'

      const response = await fetch(
        url,
        {
          method: editingId
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            generationId:
              formGenerationId,
            name: name.trim(),
            engineCode:
              nullableText(
                engineCode,
              ),
            engineType:
              nullableText(
                engineType,
              ),
            displacementCc:
              parsedDisplacementCc,
            powerKw:
              parsedPowerKw,
            bodyType:
              nullableText(
                bodyType,
              ),
            yearFrom:
              parsedYearFrom,
            yearTo:
              parsedYearTo,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          await getApiError(
            response,
          ),
        )
      }

      const savedVehicleConfiguration =
        (await response.json()) as VehicleConfiguration

      setConfigurations(
        (current) => {
          const withoutSavedConfiguration =
            current.filter(
              (
                vehicleConfiguration,
              ) =>
                vehicleConfiguration.id !==
                savedVehicleConfiguration.id,
            )

          if (
            savedVehicleConfiguration.generationId !==
            selectedGenerationId
          ) {
            return sortVehicleConfigurations(
              withoutSavedConfiguration,
            )
          }

          return sortVehicleConfigurations(
            [
              ...withoutSavedConfiguration,
              savedVehicleConfiguration,
            ],
          )
        },
      )

      resetForm()
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar a configuração de veículo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(
    vehicleConfiguration:
      VehicleConfiguration,
  ) {
    if (
      !window.confirm(
        `Apagar a configuração "${vehicleConfiguration.name}"?`,
      )
    ) {
      return
    }

    setDeletingId(
      vehicleConfiguration.id,
    )
    setActionError('')

    try {
      const response = await fetch(
        `/api/admin/vehicle-configurations/${vehicleConfiguration.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error(
          await getApiError(
            response,
          ),
        )
      }

      setConfigurations(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              vehicleConfiguration.id,
          ),
      )

      if (
        editingId ===
        vehicleConfiguration.id
      ) {
        resetForm()
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível apagar a configuração de veículo',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const operationInProgress =
    submitting ||
    deletingId !== null

  const hasBrands =
    brands.length > 0

  const hasFilterModels =
    filterModels.length > 0

  const hasFilterGenerations =
    filterGenerations.length > 0

  const hasFormModels =
    formModels.length > 0

  const hasFormGenerations =
    formGenerations.length > 0

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          Configurações de veículos
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Gerir motorizações e
          configurações associadas às
          gerações de veículos.
        </p>
      </div>

      <section className="mb-8 rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-medium">
          {editingId
            ? 'Editar configuração'
            : 'Nova configuração'}
        </h2>

        {loadingBrands && (
          <p className="text-sm text-gray-600">
            A carregar marcas...
          </p>
        )}

        {!loadingBrands &&
          !loadError &&
          !hasBrands && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Ainda não existem
                marcas de veículos.
              </p>

              <Link
                href="/admin/vehicle-brands"
                className="inline-block text-sm font-medium underline"
              >
                Gerir marcas de
                veículos
              </Link>
            </div>
          )}

        {!loadingBrands &&
          hasBrands && (
            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="vehicle-configuration-brand"
                    className="mb-1 block text-sm font-medium"
                  >
                    Marca
                  </label>

                  <select
                    id="vehicle-configuration-brand"
                    value={
                      formBrandId
                    }
                    onChange={(
                      event,
                    ) =>
                      setFormBrandId(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress
                    }
                    required
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  >
                    {brands.map(
                      (brand) => (
                        <option
                          key={
                            brand.id
                          }
                          value={
                            brand.id
                          }
                        >
                          {
                            brand.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="vehicle-configuration-model"
                    className="mb-1 block text-sm font-medium"
                  >
                    Modelo
                  </label>

                  <select
                    id="vehicle-configuration-model"
                    value={
                      formModelId
                    }
                    onChange={(
                      event,
                    ) =>
                      setFormModelId(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      loadingFormModels ||
                      !hasFormModels
                    }
                    required
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  >
                    {formModels.map(
                      (
                        vehicleModel,
                      ) => (
                        <option
                          key={
                            vehicleModel.id
                          }
                          value={
                            vehicleModel.id
                          }
                        >
                          {
                            vehicleModel.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="vehicle-configuration-generation"
                    className="mb-1 block text-sm font-medium"
                  >
                    Geração
                  </label>

                  <select
                    id="vehicle-configuration-generation"
                    value={
                      formGenerationId
                    }
                    onChange={(
                      event,
                    ) =>
                      setFormGenerationId(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      loadingFormModels ||
                      loadingFormGenerations ||
                      !hasFormGenerations
                    }
                    required
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  >
                    {formGenerations.map(
                      (
                        vehicleGeneration,
                      ) => (
                        <option
                          key={
                            vehicleGeneration.id
                          }
                          value={
                            vehicleGeneration.id
                          }
                        >
                          {
                            vehicleGeneration.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {loadingFormModels && (
                <p className="text-sm text-gray-600">
                  A carregar
                  modelos...
                </p>
              )}

              {!loadingFormModels &&
                formModelsError && (
                  <p
                    role="alert"
                    className="text-sm text-red-600"
                  >
                    {
                      formModelsError
                    }
                  </p>
                )}

              {!loadingFormModels &&
                !formModelsError &&
                !hasFormModels && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Ainda não
                      existem modelos
                      para esta marca.
                    </p>

                    <Link
                      href="/admin/vehicle-models"
                      className="inline-block text-sm font-medium underline"
                    >
                      Gerir modelos
                      de veículos
                    </Link>
                  </div>
                )}

              {loadingFormGenerations && (
                <p className="text-sm text-gray-600">
                  A carregar
                  gerações...
                </p>
              )}

              {!loadingFormGenerations &&
                formGenerationsError && (
                  <p
                    role="alert"
                    className="text-sm text-red-600"
                  >
                    {
                      formGenerationsError
                    }
                  </p>
                )}

              {!loadingFormGenerations &&
                !formGenerationsError &&
                hasFormModels &&
                !hasFormGenerations && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Ainda não
                      existem gerações
                      para este modelo.
                    </p>

                    <Link
                      href="/admin/vehicle-generations"
                      className="inline-block text-sm font-medium underline"
                    >
                      Gerir gerações
                      de veículos
                    </Link>
                  </div>
                )}

              <div>
                <label
                  htmlFor="vehicle-configuration-name"
                  className="mb-1 block text-sm font-medium"
                >
                  Nome
                </label>

                <input
                  id="vehicle-configuration-name"
                  type="text"
                  value={name}
                  onChange={(
                    event,
                  ) =>
                    setName(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    operationInProgress ||
                    !hasFormGenerations
                  }
                  required
                  maxLength={120}
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="vehicle-configuration-engine-code"
                    className="mb-1 block text-sm font-medium"
                  >
                    Código do motor
                  </label>

                  <input
                    id="vehicle-configuration-engine-code"
                    type="text"
                    value={
                      engineCode
                    }
                    onChange={(
                      event,
                    ) =>
                      setEngineCode(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      !hasFormGenerations
                    }
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vehicle-configuration-engine-type"
                    className="mb-1 block text-sm font-medium"
                  >
                    Tipo de motor
                  </label>

                  <input
                    id="vehicle-configuration-engine-type"
                    type="text"
                    value={
                      engineType
                    }
                    onChange={(
                      event,
                    ) =>
                      setEngineType(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      !hasFormGenerations
                    }
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vehicle-configuration-displacement"
                    className="mb-1 block text-sm font-medium"
                  >
                    Cilindrada
                    (cm³)
                  </label>

                  <input
                    id="vehicle-configuration-displacement"
                    type="number"
                    min="1"
                    step="1"
                    value={
                      displacementCc
                    }
                    onChange={(
                      event,
                    ) =>
                      setDisplacementCc(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      !hasFormGenerations
                    }
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vehicle-configuration-power"
                    className="mb-1 block text-sm font-medium"
                  >
                    Potência (kW)
                  </label>

                  <input
                    id="vehicle-configuration-power"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      powerKw
                    }
                    onChange={(
                      event,
                    ) =>
                      setPowerKw(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      !hasFormGenerations
                    }
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vehicle-configuration-body-type"
                    className="mb-1 block text-sm font-medium"
                  >
                    Carroçaria
                  </label>

                  <input
                    id="vehicle-configuration-body-type"
                    type="text"
                    value={
                      bodyType
                    }
                    onChange={(
                      event,
                    ) =>
                      setBodyType(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      !hasFormGenerations
                    }
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  />
                </div>

                <div />

                <div>
                  <label
                    htmlFor="vehicle-configuration-year-from"
                    className="mb-1 block text-sm font-medium"
                  >
                    Ano inicial
                  </label>

                  <input
                    id="vehicle-configuration-year-from"
                    type="number"
                    min="1"
                    step="1"
                    value={
                      yearFrom
                    }
                    onChange={(
                      event,
                    ) =>
                      setYearFrom(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      !hasFormGenerations
                    }
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vehicle-configuration-year-to"
                    className="mb-1 block text-sm font-medium"
                  >
                    Ano final
                  </label>

                  <input
                    id="vehicle-configuration-year-to"
                    type="number"
                    min="1"
                    step="1"
                    value={yearTo}
                    onChange={(
                      event,
                    ) =>
                      setYearTo(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      operationInProgress ||
                      !hasFormGenerations
                    }
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  />
                </div>
              </div>

              {actionError && (
                <p
                  role="alert"
                  className="text-sm text-red-600"
                >
                  {actionError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={
                    operationInProgress ||
                    loadingFormModels ||
                    loadingFormGenerations ||
                    !hasFormModels ||
                    !hasFormGenerations ||
                    !formGenerationId
                  }
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'A guardar...'
                    : editingId
                      ? 'Guardar alterações'
                      : 'Criar configuração'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={
                      resetForm
                    }
                    disabled={
                      operationInProgress
                    }
                    className="rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

        {!loadingBrands &&
          loadError &&
          !hasBrands && (
            <p
              role="alert"
              className="text-sm text-red-600"
            >
              {loadError}
            </p>
          )}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            Configurações
            existentes
          </h2>

          {hasBrands && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="vehicle-configuration-filter-brand"
                  className="mb-1 block text-sm font-medium"
                >
                  Marca apresentada
                </label>

                <select
                  id="vehicle-configuration-filter-brand"
                  value={
                    selectedBrandId
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedBrandId(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    loadingFilterModels ||
                    loadingFilterGenerations ||
                    loadingConfigurations ||
                    operationInProgress
                  }
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                >
                  {brands.map(
                    (brand) => (
                      <option
                        key={
                          brand.id
                        }
                        value={
                          brand.id
                        }
                      >
                        {
                          brand.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="vehicle-configuration-filter-model"
                  className="mb-1 block text-sm font-medium"
                >
                  Modelo apresentado
                </label>

                <select
                  id="vehicle-configuration-filter-model"
                  value={
                    selectedModelId
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedModelId(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    loadingFilterModels ||
                    loadingFilterGenerations ||
                    loadingConfigurations ||
                    operationInProgress ||
                    !hasFilterModels
                  }
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                >
                  {filterModels.map(
                    (
                      vehicleModel,
                    ) => (
                      <option
                        key={
                          vehicleModel.id
                        }
                        value={
                          vehicleModel.id
                        }
                      >
                        {
                          vehicleModel.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="vehicle-configuration-filter-generation"
                  className="mb-1 block text-sm font-medium"
                >
                  Geração apresentada
                </label>

                <select
                  id="vehicle-configuration-filter-generation"
                  value={
                    selectedGenerationId
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedGenerationId(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    loadingFilterModels ||
                    loadingFilterGenerations ||
                    loadingConfigurations ||
                    operationInProgress ||
                    !hasFilterGenerations
                  }
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                >
                  {filterGenerations.map(
                    (
                      vehicleGeneration,
                    ) => (
                      <option
                        key={
                          vehicleGeneration.id
                        }
                        value={
                          vehicleGeneration.id
                        }
                      >
                        {
                          vehicleGeneration.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        {loadingBrands && (
          <p className="text-sm text-gray-600">
            A carregar marcas...
          </p>
        )}

        {!loadingBrands &&
          hasBrands &&
          loadingFilterModels && (
            <p className="text-sm text-gray-600">
              A carregar modelos...
            </p>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          hasFilterModels &&
          loadingFilterGenerations && (
            <p className="text-sm text-gray-600">
              A carregar gerações...
            </p>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadingFilterGenerations &&
          hasFilterGenerations &&
          loadingConfigurations && (
            <p className="text-sm text-gray-600">
              A carregar
              configurações...
            </p>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadingFilterGenerations &&
          !loadingConfigurations &&
          loadError && (
            <p
              role="alert"
              className="text-sm text-red-600"
            >
              {loadError}
            </p>
          )}

        {!loadingBrands &&
          !loadError &&
          !hasBrands && (
            <p className="text-sm text-gray-600">
              Ainda não existem
              marcas de veículos.
            </p>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadError &&
          hasBrands &&
          !hasFilterModels && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Ainda não existem
                modelos para esta
                marca.
              </p>

              <Link
                href="/admin/vehicle-models"
                className="inline-block text-sm font-medium underline"
              >
                Gerir modelos de
                veículos
              </Link>
            </div>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadingFilterGenerations &&
          !loadError &&
          hasBrands &&
          hasFilterModels &&
          !hasFilterGenerations && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Ainda não existem
                gerações para este
                modelo.
              </p>

              <Link
                href="/admin/vehicle-generations"
                className="inline-block text-sm font-medium underline"
              >
                Gerir gerações de
                veículos
              </Link>
            </div>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadingFilterGenerations &&
          !loadingConfigurations &&
          !loadError &&
          hasBrands &&
          hasFilterModels &&
          hasFilterGenerations &&
          configurations.length ===
            0 && (
            <p className="text-sm text-gray-600">
              Ainda não existem
              configurações para
              esta geração.
            </p>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadingFilterGenerations &&
          !loadingConfigurations &&
          !loadError &&
          hasBrands &&
          hasFilterModels &&
          hasFilterGenerations &&
          configurations.length >
            0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-[1000px] w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Nome
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Motor
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Cilindrada
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Potência
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Carroçaria
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Anos
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {configurations.map(
                    (
                      vehicleConfiguration,
                    ) => (
                      <tr
                        key={
                          vehicleConfiguration.id
                        }
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          {
                            vehicleConfiguration.name
                          }
                        </td>

                        <td className="px-4 py-3">
                          <div>
                            {vehicleConfiguration.engineCode ??
                              '—'}
                          </div>

                          {vehicleConfiguration.engineType && (
                            <div className="text-xs text-gray-500">
                              {
                                vehicleConfiguration.engineType
                              }
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {vehicleConfiguration.displacementCc ===
                          null
                            ? '—'
                            : `${formatNumber(
                                vehicleConfiguration.displacementCc,
                              )} cm³`}
                        </td>

                        <td className="px-4 py-3">
                          {vehicleConfiguration.powerKw ===
                          null
                            ? '—'
                            : `${formatNumber(
                                vehicleConfiguration.powerKw,
                              )} kW`}
                        </td>

                        <td className="px-4 py-3">
                          {vehicleConfiguration.bodyType ??
                            '—'}
                        </td>

                        <td className="px-4 py-3">
                          {formatYears(
                            vehicleConfiguration.yearFrom,
                            vehicleConfiguration.yearTo,
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  vehicleConfiguration,
                                )
                              }
                              disabled={
                                operationInProgress
                              }
                              className="rounded-md border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(
                                  vehicleConfiguration,
                                )
                              }
                              disabled={
                                operationInProgress
                              }
                              className="rounded-md border px-3 py-1.5 text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              vehicleConfiguration.id
                                ? 'A apagar...'
                                : 'Apagar'}
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
      </section>
    </main>
  )
}
