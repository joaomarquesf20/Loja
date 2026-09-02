'use client'

import Link from 'next/link'
import {
  FormEvent,
  useEffect,
  useState,
} from 'react'

type VehicleBrand = {
  id: string
  name: string
  slug: string
}

type VehicleModel = {
  id: string
  brandId: string
  name: string
  slug: string
  description: string | null
}

type VehicleGeneration = {
  id: string
  modelId: string
  name: string
  platform: string | null
  description: string | null
}

type ApiError = {
  error?: unknown
}

async function getApiError(
  response: Response,
): Promise<string> {
  try {
    const body =
      (await response.json()) as ApiError

    if (typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // A resposta pode não conter JSON válido.
  }

  return `Erro no pedido (${response.status})`
}

function sortVehicleBrands(
  brands: VehicleBrand[],
) {
  return [...brands].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt'),
  )
}

function sortVehicleModels(
  models: VehicleModel[],
) {
  return [...models].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt'),
  )
}

function sortVehicleGenerations(
  generations: VehicleGeneration[],
) {
  return [...generations].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt'),
  )
}

export default function VehicleGenerationsPage() {
  const [brands, setBrands] = useState<
    VehicleBrand[]
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
    filterModels,
    setFilterModels,
  ] = useState<VehicleModel[]>([])

  const [
    generations,
    setGenerations,
  ] = useState<VehicleGeneration[]>([])

  const [
    loadingBrands,
    setLoadingBrands,
  ] = useState(true)

  const [
    loadingFilterModels,
    setLoadingFilterModels,
  ] = useState(false)

  const [
    loadingGenerations,
    setLoadingGenerations,
  ] = useState(false)

  const [loadError, setLoadError] =
    useState('')

  const [
    formBrandId,
    setFormBrandId,
  ] = useState('')

  const [
    formModelId,
    setFormModelId,
  ] = useState('')

  const [
    formModels,
    setFormModels,
  ] = useState<VehicleModel[]>([])

  const [
    loadingFormModels,
    setLoadingFormModels,
  ] = useState(false)

  const [
    formModelsError,
    setFormModelsError,
  ] = useState('')

  const [name, setName] = useState('')
  const [platform, setPlatform] =
    useState('')
  const [description, setDescription] =
    useState('')

  const [actionError, setActionError] =
    useState('')

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [submitting, setSubmitting] =
    useState(false)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadVehicleBrands() {
      try {
        setLoadingBrands(true)
        setLoadError('')

        const response = await fetch(
          '/api/admin/vehicle-brands',
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
          (await response.json()) as VehicleBrand[]

        const sortedBrands =
          sortVehicleBrands(data)

        setBrands(sortedBrands)

        if (sortedBrands.length > 0) {
          const firstBrandId =
            sortedBrands[0].id

          setSelectedBrandId(firstBrandId)
          setFormBrandId(firstBrandId)
        } else {
          setSelectedBrandId('')
          setSelectedModelId('')
          setFormBrandId('')
          setFormModelId('')
          setFilterModels([])
          setFormModels([])
          setGenerations([])
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
          setLoadingBrands(false)
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

    const controller = new AbortController()

    async function loadFilterModels() {
      try {
        setLoadingFilterModels(true)
        setLoadError('')
        setSelectedModelId('')
        setGenerations([])

        const response = await fetch(
          `/api/admin/vehicle-models?brandId=${encodeURIComponent(
            selectedBrandId,
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

        const sortedModels =
          sortVehicleModels(data)

        setFilterModels(sortedModels)

        if (sortedModels.length > 0) {
          setSelectedModelId(
            sortedModels[0].id,
          )
        } else {
          setSelectedModelId('')
          setGenerations([])
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setFilterModels([])
        setSelectedModelId('')
        setGenerations([])

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os modelos de veículos',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingFilterModels(false)
        }
      }
    }

    void loadFilterModels()

    return () => {
      controller.abort()
    }
  }, [selectedBrandId])

  useEffect(() => {
  if (!formBrandId) {
    return
  }

    const controller = new AbortController()

    async function loadFormModels() {
      try {
        setLoadingFormModels(true)
        setFormModelsError('')

        const response = await fetch(
          `/api/admin/vehicle-models?brandId=${encodeURIComponent(
            formBrandId,
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

        const sortedModels =
          sortVehicleModels(data)

        setFormModels(sortedModels)

        setFormModelId((current) => {
          if (
            sortedModels.some(
              (vehicleModel) =>
                vehicleModel.id === current,
            )
          ) {
            return current
          }

          return sortedModels[0]?.id ?? ''
        })
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setFormModels([])
        setFormModelId('')

        setFormModelsError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os modelos de veículos',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingFormModels(false)
        }
      }
    }

    void loadFormModels()

    return () => {
      controller.abort()
    }
  }, [formBrandId])

  useEffect(() => {
  if (!selectedModelId) {
    return
  }

    const controller = new AbortController()

    async function loadVehicleGenerations() {
      try {
        setLoadingGenerations(true)
        setLoadError('')
        setActionError('')
        setEditingId(null)
        setName('')
        setPlatform('')
        setDescription('')
        setFormBrandId(selectedBrandId)
        setFormModelId(selectedModelId)

        const response = await fetch(
          `/api/admin/vehicle-generations?modelId=${encodeURIComponent(
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
          (await response.json()) as VehicleGeneration[]

        setGenerations(
          sortVehicleGenerations(data),
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setGenerations([])

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as gerações de veículos',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingGenerations(false)
        }
      }
    }

    void loadVehicleGenerations()

    return () => {
      controller.abort()
    }
  }, [selectedBrandId, selectedModelId])

  function resetForm() {
    setFormBrandId(selectedBrandId)
    setFormModelId(selectedModelId)
    setName('')
    setPlatform('')
    setDescription('')
    setEditingId(null)
    setActionError('')
    setFormModelsError('')
  }

  function startEditing(
    vehicleGeneration: VehicleGeneration,
  ) {
    setEditingId(vehicleGeneration.id)
    setFormBrandId(selectedBrandId)
    setFormModelId(
      vehicleGeneration.modelId,
    )
    setName(vehicleGeneration.name)
    setPlatform(
      vehicleGeneration.platform ?? '',
    )
    setDescription(
      vehicleGeneration.description ?? '',
    )
    setActionError('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      submitting ||
      loadingFormModels
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

    setSubmitting(true)
    setActionError('')

    try {
      const url = editingId
        ? `/api/admin/vehicle-generations/${editingId}`
        : '/api/admin/vehicle-generations'

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
          name,
          platform:
            platform.trim() === ''
              ? null
              : platform,
          description:
            description.trim() === ''
              ? null
              : description,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      const savedVehicleGeneration =
        (await response.json()) as VehicleGeneration

      setGenerations((current) => {
        const withoutSavedGeneration =
          current.filter(
            (vehicleGeneration) =>
              vehicleGeneration.id !==
              savedVehicleGeneration.id,
          )

        if (
          savedVehicleGeneration.modelId !==
          selectedModelId
        ) {
          return sortVehicleGenerations(
            withoutSavedGeneration,
          )
        }

        return sortVehicleGenerations([
          ...withoutSavedGeneration,
          savedVehicleGeneration,
        ])
      })

      resetForm()
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar a geração de veículo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(
    vehicleGeneration: VehicleGeneration,
  ) {
    if (
      !window.confirm(
        `Apagar a geração "${vehicleGeneration.name}"?`,
      )
    ) {
      return
    }

    setDeletingId(vehicleGeneration.id)
    setActionError('')

    try {
      const response = await fetch(
        `/api/admin/vehicle-generations/${vehicleGeneration.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      setGenerations((current) =>
        current.filter(
          (item) =>
            item.id !==
            vehicleGeneration.id,
        ),
      )

      if (
        editingId ===
        vehicleGeneration.id
      ) {
        resetForm()
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível apagar a geração de veículo',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const operationInProgress =
    submitting || deletingId !== null

  const hasBrands = brands.length > 0

  const hasFilterModels =
    filterModels.length > 0

  const hasFormModels =
    formModels.length > 0

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          Gerações de veículos
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Gerir gerações associadas aos modelos
          de veículos.
        </p>
      </div>

      <section className="mb-8 rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-medium">
          {editingId
            ? 'Editar geração'
            : 'Nova geração'}
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
                Ainda não existem marcas de
                veículos.
              </p>

              <Link
                href="/admin/vehicle-brands"
                className="inline-block text-sm font-medium underline"
              >
                Gerir marcas de veículos
              </Link>
            </div>
          )}

        {!loadingBrands &&
          hasBrands && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="vehicle-generation-brand"
                  className="mb-1 block text-sm font-medium"
                >
                  Marca
                </label>

                <select
                  id="vehicle-generation-brand"
                  value={formBrandId}
                  onChange={(event) =>
                    setFormBrandId(
                      event.target.value,
                    )
                  }
                  disabled={
                    operationInProgress
                  }
                  required
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                >
                  {brands.map((brand) => (
                    <option
                      key={brand.id}
                      value={brand.id}
                    >
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="vehicle-generation-model"
                  className="mb-1 block text-sm font-medium"
                >
                  Modelo
                </label>

                <select
                  id="vehicle-generation-model"
                  value={formModelId}
                  onChange={(event) =>
                    setFormModelId(
                      event.target.value,
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
                    (vehicleModel) => (
                      <option
                        key={vehicleModel.id}
                        value={vehicleModel.id}
                      >
                        {vehicleModel.name}
                      </option>
                    ),
                  )}
                </select>

                {loadingFormModels && (
                  <p className="mt-2 text-sm text-gray-600">
                    A carregar modelos...
                  </p>
                )}

                {!loadingFormModels &&
                  formModelsError && (
                    <p
                      role="alert"
                      className="mt-2 text-sm text-red-600"
                    >
                      {formModelsError}
                    </p>
                  )}

                {!loadingFormModels &&
                  !formModelsError &&
                  !hasFormModels && (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-gray-600">
                        Ainda não existem modelos
                        para esta marca.
                      </p>

                      <Link
                        href="/admin/vehicle-models"
                        className="inline-block text-sm font-medium underline"
                      >
                        Gerir modelos de veículos
                      </Link>
                    </div>
                  )}
              </div>

              <div>
                <label
                  htmlFor="vehicle-generation-name"
                  className="mb-1 block text-sm font-medium"
                >
                  Nome
                </label>

                <input
                  id="vehicle-generation-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                  disabled={
                    operationInProgress ||
                    !hasFormModels
                  }
                  required
                  maxLength={120}
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="vehicle-generation-platform"
                  className="mb-1 block text-sm font-medium"
                >
                  Plataforma
                </label>

                <input
                  id="vehicle-generation-platform"
                  type="text"
                  value={platform}
                  onChange={(event) =>
                    setPlatform(
                      event.target.value,
                    )
                  }
                  disabled={
                    operationInProgress ||
                    !hasFormModels
                  }
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="vehicle-generation-description"
                  className="mb-1 block text-sm font-medium"
                >
                  Descrição
                </label>

                <textarea
                  id="vehicle-generation-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  disabled={
                    operationInProgress ||
                    !hasFormModels
                  }
                  rows={4}
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                />
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
                    !hasFormModels ||
                    !formModelId
                  }
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'A guardar...'
                    : editingId
                      ? 'Guardar alterações'
                      : 'Criar geração'}
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
            Gerações existentes
          </h2>

          {hasBrands && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="vehicle-generation-filter-brand"
                  className="mb-1 block text-sm font-medium"
                >
                  Marca apresentada
                </label>

                <select
                  id="vehicle-generation-filter-brand"
                  value={selectedBrandId}
                  onChange={(event) =>
                    setSelectedBrandId(
                      event.target.value,
                    )
                  }
                  disabled={
                    loadingFilterModels ||
                    loadingGenerations ||
                    operationInProgress
                  }
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                >
                  {brands.map((brand) => (
                    <option
                      key={brand.id}
                      value={brand.id}
                    >
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="vehicle-generation-filter-model"
                  className="mb-1 block text-sm font-medium"
                >
                  Modelo apresentado
                </label>

                <select
                  id="vehicle-generation-filter-model"
                  value={selectedModelId}
                  onChange={(event) =>
                    setSelectedModelId(
                      event.target.value,
                    )
                  }
                  disabled={
                    loadingFilterModels ||
                    loadingGenerations ||
                    operationInProgress ||
                    !hasFilterModels
                  }
                  className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                >
                  {filterModels.map(
                    (vehicleModel) => (
                      <option
                        key={vehicleModel.id}
                        value={vehicleModel.id}
                      >
                        {vehicleModel.name}
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
          !loadingGenerations &&
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
              Ainda não existem marcas de veículos.
            </p>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadError &&
          hasBrands &&
          !hasFilterModels && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Ainda não existem modelos para
                esta marca.
              </p>

              <Link
                href="/admin/vehicle-models"
                className="inline-block text-sm font-medium underline"
              >
                Gerir modelos de veículos
              </Link>
            </div>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          hasFilterModels &&
          loadingGenerations && (
            <p className="text-sm text-gray-600">
              A carregar gerações...
            </p>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadingGenerations &&
          !loadError &&
          hasBrands &&
          hasFilterModels &&
          generations.length === 0 && (
            <p className="text-sm text-gray-600">
              Ainda não existem gerações para
              este modelo.
            </p>
          )}

        {!loadingBrands &&
          !loadingFilterModels &&
          !loadingGenerations &&
          !loadError &&
          hasBrands &&
          hasFilterModels &&
          generations.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Nome
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Plataforma
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Descrição
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {generations.map(
                    (vehicleGeneration) => (
                      <tr
                        key={
                          vehicleGeneration.id
                        }
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          {
                            vehicleGeneration.name
                          }
                        </td>

                        <td className="px-4 py-3">
                          {vehicleGeneration.platform ??
                            '—'}
                        </td>

                        <td className="px-4 py-3">
                          {vehicleGeneration.description ??
                            '—'}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  vehicleGeneration,
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
                                  vehicleGeneration,
                                )
                              }
                              disabled={
                                operationInProgress
                              }
                              className="rounded-md border px-3 py-1.5 text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              vehicleGeneration.id
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