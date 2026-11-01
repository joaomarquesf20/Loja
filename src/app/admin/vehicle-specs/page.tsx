'use client'

import {
  FormEvent,
  useEffect,
  useState,
} from 'react'

type VehicleMake = {
  id: string
  name: string
  slug: string
}

type VehicleModel = {
  id: string
  name: string
  slug: string
}

type VehicleSpec = {
  id: string
  modelId: string
  engine: string
  engineCode: string | null
  yearStart: number
  yearEnd: number | null
  fuelType: string
  powerHp: number | null
}

type ApiError = {
  error?: unknown
}

async function getApiError(
  response: Response,
): Promise<string> {
  try {
    const body = (await response.json()) as ApiError

    if (typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // A resposta pode não conter JSON válido.
  }

  return `Erro no pedido (${response.status})`
}

function sortVehicleSpecs(
  specs: VehicleSpec[],
) {
  return [...specs].sort(
    (a, b) =>
      a.engine.localeCompare(b.engine, 'pt') ||
      a.yearStart - b.yearStart,
  )
}

export default function VehicleSpecsPage() {
  const [makes, setMakes] = useState<
    VehicleMake[]
  >([])
  const [
    selectedMakeId,
    setSelectedMakeId,
  ] = useState('')
  const [models, setModels] = useState<
    VehicleModel[]
  >([])
  const [
    selectedModelId,
    setSelectedModelId,
  ] = useState('')
  const [specs, setSpecs] = useState<
    VehicleSpec[]
  >([])

  const [loadingMakes, setLoadingMakes] =
    useState(true)
  const [loadingModels, setLoadingModels] =
    useState(false)
  const [loadingSpecs, setLoadingSpecs] =
    useState(false)

  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] =
    useState('')

  const [formModelId, setFormModelId] =
    useState('')
  const [engine, setEngine] = useState('')
  const [engineCode, setEngineCode] =
    useState('')
  const [yearStart, setYearStart] = useState('')
  const [yearEnd, setYearEnd] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [powerHp, setPowerHp] = useState('')

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [submitting, setSubmitting] =
    useState(false)
  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadVehicleMakes() {
      try {
        setLoadingMakes(true)
        setLoadError('')

        const response = await fetch(
          '/api/admin/vehicle-makes',
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(response),
          )
        }

        const data =
          (await response.json()) as VehicleMake[]

        const sortedMakes = [...data].sort(
          (a, b) =>
            a.name.localeCompare(b.name, 'pt'),
        )

        setMakes(sortedMakes)

        if (sortedMakes.length > 0) {
          setSelectedMakeId(sortedMakes[0].id)
        } else {
          setSelectedMakeId('')
          setModels([])
          setSpecs([])
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as marcas de veículos',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingMakes(false)
        }
      }
    }

    void loadVehicleMakes()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadVehicleModels() {
      if (!selectedMakeId) {
        setModels([])
        return
      }

      try {
        setLoadingModels(true)
        setLoadError('')
        setActionError('')
        setEditingId(null)
        setSelectedModelId('')
        setSpecs([])

        const response = await fetch(
          `/api/admin/vehicle-models?makeId=${encodeURIComponent(
            selectedMakeId,
          )}`,
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(response),
          )
        }

        const data =
          (await response.json()) as VehicleModel[]

        setModels(
          [...data].sort((a, b) =>
            a.name.localeCompare(b.name, 'pt'),
          ),
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setModels([])

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os modelos de veículos',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingModels(false)
        }
      }
    }

    void loadVehicleModels()

    return () => {
      controller.abort()
    }
  }, [selectedMakeId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadVehicleSpecs() {
      if (!selectedModelId) {
        setSpecs([])
        return
      }

      try {
        setLoadingSpecs(true)
        setLoadError('')
        setActionError('')
        setEditingId(null)
        setFormModelId(selectedModelId)

        const response = await fetch(
          `/api/admin/vehicle-specs?modelId=${encodeURIComponent(
            selectedModelId,
          )}`,
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(response),
          )
        }

        const data =
          (await response.json()) as VehicleSpec[]

        setSpecs(sortVehicleSpecs(data))
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setSpecs([])

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as especificações de veículos',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSpecs(false)
        }
      }
    }

    void loadVehicleSpecs()

    return () => {
      controller.abort()
    }
  }, [selectedModelId])

  function resetForm() {
    setFormModelId(selectedModelId)
    setEngine('')
    setEngineCode('')
    setYearStart('')
    setYearEnd('')
    setFuelType('')
    setPowerHp('')
    setEditingId(null)
    setActionError('')
  }

  function startEditing(
    vehicleSpec: VehicleSpec,
  ) {
    setEditingId(vehicleSpec.id)
    setFormModelId(vehicleSpec.modelId)
    setEngine(vehicleSpec.engine)
    setEngineCode(vehicleSpec.engineCode ?? '')
    setYearStart(String(vehicleSpec.yearStart))
    setYearEnd(
      vehicleSpec.yearEnd === null
        ? ''
        : String(vehicleSpec.yearEnd),
    )
    setFuelType(vehicleSpec.fuelType)
    setPowerHp(
      vehicleSpec.powerHp === null
        ? ''
        : String(vehicleSpec.powerHp),
    )
    setActionError('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (submitting) {
      return
    }

    if (!formModelId) {
      setActionError(
        'Selecione um modelo de veículo.',
      )
      return
    }

    setSubmitting(true)
    setActionError('')

    try {
      const url = editingId
        ? `/api/admin/vehicle-specs/${editingId}`
        : '/api/admin/vehicle-specs'

      const response = await fetch(url, {
        method: editingId
          ? 'PATCH'
          : 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          modelId: formModelId,
          engine,
          engineCode:
            engineCode.trim() === ''
              ? null
              : engineCode,
          yearStart: Number(yearStart),
          yearEnd:
            yearEnd.trim() === ''
              ? null
              : Number(yearEnd),
          fuelType,
          powerHp:
            powerHp.trim() === ''
              ? null
              : Number(powerHp),
        }),
      })

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      const savedVehicleSpec =
        (await response.json()) as VehicleSpec

      setSpecs((current) => {
        const withoutSavedSpec =
          current.filter(
            (vehicleSpec) =>
              vehicleSpec.id !==
              savedVehicleSpec.id,
          )

        if (
          savedVehicleSpec.modelId !==
          selectedModelId
        ) {
          return sortVehicleSpecs(
            withoutSavedSpec,
          )
        }

        return sortVehicleSpecs([
          ...withoutSavedSpec,
          savedVehicleSpec,
        ])
      })

      resetForm()
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar a especificação de veículo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(
    vehicleSpec: VehicleSpec,
  ) {
    if (
      !window.confirm(
        `Apagar a especificação "${vehicleSpec.engine}"?`,
      )
    ) {
      return
    }

    setDeletingId(vehicleSpec.id)
    setActionError('')

    try {
      const response = await fetch(
        `/api/admin/vehicle-specs/${vehicleSpec.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      setSpecs((current) =>
        current.filter(
          (item) =>
            item.id !== vehicleSpec.id,
        ),
      )

      if (
        editingId === vehicleSpec.id
      ) {
        resetForm()
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível apagar a especificação de veículo',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const operationInProgress =
    submitting || deletingId !== null

  const hasMakes = makes.length > 0
  const hasModels = models.length > 0

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          Especificações de veículos
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Gerir o fitment por motor: designação,
          código, anos, combustível e potência.
        </p>
      </div>

      <section className="mb-8 rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-medium">
          {editingId
            ? 'Editar especificação'
            : 'Nova especificação'}
        </h2>

        {loadingMakes && (
          <p className="text-sm text-gray-600">
            A carregar marcas...
          </p>
        )}

        {!loadingMakes &&
          !loadError &&
          !hasMakes && (
            <p className="text-sm text-gray-600">
              Ainda não existem marcas de veículos.
            </p>
          )}

        {!loadingMakes &&
          hasMakes && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="vehicle-spec-filter-make"
                    className="mb-1 block text-sm font-medium"
                  >
                    Marca
                  </label>

                  <select
                    id="vehicle-spec-filter-make"
                    value={selectedMakeId}
                    onChange={(event) =>
                      setSelectedMakeId(
                        event.target.value,
                      )
                    }
                    disabled={
                      loadingModels ||
                      operationInProgress
                    }
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  >
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
                    htmlFor="vehicle-spec-model"
                    className="mb-1 block text-sm font-medium"
                  >
                    Modelo
                  </label>

                  <select
                    id="vehicle-spec-model"
                    value={formModelId}
                    onChange={(event) =>
                      setFormModelId(
                        event.target.value,
                      )
                    }
                    disabled={
                      loadingModels ||
                      operationInProgress ||
                      !hasModels
                    }
                    required
                    className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                  >
                    {hasModels ? (
                      models.map((model) => (
                        <option
                          key={model.id}
                          value={model.id}
                        >
                          {model.name}
                        </option>
                      ))
                    ) : (
                      <option value="">
                        Sem modelos nesta marca
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {hasModels && (
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="vehicle-spec-engine"
                        className="mb-1 block text-sm font-medium"
                      >
                        Motor
                      </label>

                      <input
                        id="vehicle-spec-engine"
                        type="text"
                        value={engine}
                        onChange={(event) =>
                          setEngine(
                            event.target.value,
                          )
                        }
                        disabled={
                          operationInProgress
                        }
                        required
                        maxLength={120}
                        className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="vehicle-spec-engine-code"
                        className="mb-1 block text-sm font-medium"
                      >
                        Código do motor
                      </label>

                      <input
                        id="vehicle-spec-engine-code"
                        type="text"
                        value={engineCode}
                        onChange={(event) =>
                          setEngineCode(
                            event.target.value,
                          )
                        }
                        disabled={
                          operationInProgress
                        }
                        maxLength={80}
                        className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="vehicle-spec-year-start"
                        className="mb-1 block text-sm font-medium"
                      >
                        Ano inicial
                      </label>

                      <input
                        id="vehicle-spec-year-start"
                        type="number"
                        value={yearStart}
                        onChange={(event) =>
                          setYearStart(
                            event.target.value,
                          )
                        }
                        disabled={
                          operationInProgress
                        }
                        required
                        min={1900}
                        max={2100}
                        className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="vehicle-spec-year-end"
                        className="mb-1 block text-sm font-medium"
                      >
                        Ano final
                      </label>

                      <input
                        id="vehicle-spec-year-end"
                        type="number"
                        value={yearEnd}
                        onChange={(event) =>
                          setYearEnd(
                            event.target.value,
                          )
                        }
                        disabled={
                          operationInProgress
                        }
                        min={1900}
                        max={2100}
                        className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="vehicle-spec-fuel-type"
                        className="mb-1 block text-sm font-medium"
                      >
                        Combustível
                      </label>

                      <input
                        id="vehicle-spec-fuel-type"
                        type="text"
                        value={fuelType}
                        onChange={(event) =>
                          setFuelType(
                            event.target.value,
                          )
                        }
                        disabled={
                          operationInProgress
                        }
                        required
                        maxLength={40}
                        placeholder="DIESEL"
                        className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="vehicle-spec-power"
                        className="mb-1 block text-sm font-medium"
                      >
                        Potência (cv)
                      </label>

                      <input
                        id="vehicle-spec-power"
                        type="number"
                        value={powerHp}
                        onChange={(event) =>
                          setPowerHp(
                            event.target.value,
                          )
                        }
                        disabled={
                          operationInProgress
                        }
                        min={1}
                        max={2000}
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
                        operationInProgress
                      }
                      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting
                        ? 'A guardar...'
                        : editingId
                          ? 'Guardar alterações'
                          : 'Criar especificação'}
                    </button>

                    {editingId && (
                      <button
                        type="button"
                        onClick={resetForm}
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
            </div>
          )}

        {!loadingMakes &&
          loadError &&
          !hasMakes && (
            <p
              role="alert"
              className="text-sm text-red-600"
            >
              {loadError}
            </p>
          )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">
          Especificações existentes
        </h2>

        {loadingMakes && (
          <p className="text-sm text-gray-600">
            A carregar marcas...
          </p>
        )}

        {!loadingMakes &&
          hasMakes &&
          loadingModels && (
            <p className="text-sm text-gray-600">
              A carregar modelos...
            </p>
          )}

        {!loadingMakes &&
          !loadingModels &&
          hasMakes &&
          !hasModels && (
            <p className="text-sm text-gray-600">
              Ainda não existem modelos para esta marca.
            </p>
          )}

        {!loadingMakes &&
          !loadingModels &&
          hasModels &&
          loadingSpecs && (
            <p className="text-sm text-gray-600">
              A carregar especificações...
            </p>
          )}

        {!loadingMakes &&
          !loadingModels &&
          !loadingSpecs &&
          loadError && (
            <p
              role="alert"
              className="text-sm text-red-600"
            >
              {loadError}
            </p>
          )}

        {!loadingMakes &&
          !loadingModels &&
          !loadingSpecs &&
          !loadError &&
          hasModels &&
          specs.length === 0 && (
            <p className="text-sm text-gray-600">
              Ainda não existem especificações para este modelo.
            </p>
          )}

        {!loadingMakes &&
          !loadingModels &&
          !loadingSpecs &&
          !loadError &&
          hasModels &&
          specs.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Motor
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Código
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Anos
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Combustível
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Potência
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {specs.map(
                    (vehicleSpec) => (
                      <tr
                        key={
                          vehicleSpec.id
                        }
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          {
                            vehicleSpec.engine
                          }
                        </td>

                        <td className="px-4 py-3">
                          {vehicleSpec.engineCode ??
                            '—'}
                        </td>

                        <td className="px-4 py-3">
                          {vehicleSpec.yearStart}
                          {
                            '–'
                          }
                          {vehicleSpec.yearEnd ??
                            ''}
                        </td>

                        <td className="px-4 py-3">
                          {
                            vehicleSpec.fuelType
                          }
                        </td>

                        <td className="px-4 py-3">
                          {vehicleSpec.powerHp ===
                          null
                            ? '—'
                            : `${vehicleSpec.powerHp} cv`}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  vehicleSpec,
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
                                  vehicleSpec,
                                )
                              }
                              disabled={
                                operationInProgress
                              }
                              className="rounded-md border px-3 py-1.5 text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              vehicleSpec.id
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
