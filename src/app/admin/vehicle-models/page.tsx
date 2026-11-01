'use client'

import Link from 'next/link'
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
  makeId: string
  name: string
  slug: string
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

function sortVehicleMakes(
  makes: VehicleMake[],
) {
  return [...makes].sort((a, b) =>
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

export default function VehicleModelsPage() {
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
    loadingMakes,
    setLoadingMakes,
  ] = useState(true)
  const [
    loadingModels,
    setLoadingModels,
  ] = useState(false)

  const [loadError, setLoadError] =
    useState('')
  const [actionError, setActionError] =
    useState('')

  const [formMakeId, setFormMakeId] =
    useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

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

        const sortedMakes =
          sortVehicleMakes(data)

        setMakes(sortedMakes)

        if (sortedMakes.length > 0) {
          const firstmakeId =
            sortedMakes[0].id

          setSelectedMakeId(firstmakeId)
          setFormMakeId(firstmakeId)
        } else {
          setSelectedMakeId('')
          setFormMakeId('')
          setModels([])
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
  if (!selectedMakeId) {
    return
  }

    const controller = new AbortController()

    async function loadVehicleModels() {
      try {
        setLoadingModels(true)
        setLoadError('')
        setActionError('')
        setEditingId(null)
        setName('')
        setSlug('')
        setFormMakeId(selectedMakeId)

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
          sortVehicleModels(data),
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

  function resetForm() {
    setFormMakeId(selectedMakeId)
    setName('')
    setSlug('')
    setEditingId(null)
    setActionError('')
  }

  function startEditing(
    vehicleModel: VehicleModel,
  ) {
    setEditingId(vehicleModel.id)
    setFormMakeId(vehicleModel.makeId)
    setName(vehicleModel.name)
    setSlug(vehicleModel.slug)
    setActionError('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (submitting) {
      return
    }

    if (!formMakeId) {
      setActionError(
        'Selecione uma marca de veículo.',
      )
      return
    }

    setSubmitting(true)
    setActionError('')

    try {
      const url = editingId
        ? `/api/admin/vehicle-models/${editingId}`
        : '/api/admin/vehicle-models'

      const response = await fetch(url, {
        method: editingId
          ? 'PATCH'
          : 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          makeId: formMakeId,
          name,
          slug,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      const savedVehicleModel =
        (await response.json()) as VehicleModel

      setModels((current) => {
        const withoutSavedModel =
          current.filter(
            (vehicleModel) =>
              vehicleModel.id !==
              savedVehicleModel.id,
          )

        if (
          savedVehicleModel.makeId !==
          selectedMakeId
        ) {
          return sortVehicleModels(
            withoutSavedModel,
          )
        }

        return sortVehicleModels([
          ...withoutSavedModel,
          savedVehicleModel,
        ])
      })

      resetForm()
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar o modelo de veículo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(
    vehicleModel: VehicleModel,
  ) {
    if (
      !window.confirm(
        `Apagar o modelo "${vehicleModel.name}"?`,
      )
    ) {
      return
    }

    setDeletingId(vehicleModel.id)
    setActionError('')

    try {
      const response = await fetch(
        `/api/admin/vehicle-models/${vehicleModel.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      setModels((current) =>
        current.filter(
          (item) =>
            item.id !== vehicleModel.id,
        ),
      )

      if (
        editingId === vehicleModel.id
      ) {
        resetForm()
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível apagar o modelo de veículo',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const operationInProgress =
    submitting || deletingId !== null

  const hasMakes = makes.length > 0

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          Modelos de veículos
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Gerir modelos associados às marcas de veículos.
        </p>
      </div>

      <section className="mb-8 rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-medium">
          {editingId
            ? 'Editar modelo'
            : 'Novo modelo'}
        </h2>

        {loadingMakes && (
          <p className="text-sm text-gray-600">
            A carregar marcas...
          </p>
        )}

        {!loadingMakes &&
          !loadError &&
          !hasMakes && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Ainda não existem marcas de veículos.
              </p>

              <Link
                href="/admin/vehicle-makes"
                className="inline-block text-sm font-medium underline"
              >
                Gerir marcas de veículos
              </Link>
            </div>
          )}

        {!loadingMakes &&
          hasMakes && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="vehicle-model-make"
                  className="mb-1 block text-sm font-medium"
                >
                  Marca
                </label>

                <select
                  id="vehicle-model-make"
                  value={formMakeId}
                  onChange={(event) =>
                    setFormMakeId(
                      event.target.value,
                    )
                  }
                  disabled={
                    operationInProgress
                  }
                  required
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
                  htmlFor="vehicle-model-name"
                  className="mb-1 block text-sm font-medium"
                >
                  Nome
                </label>

                <input
                  id="vehicle-model-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
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
                  htmlFor="vehicle-model-slug"
                  className="mb-1 block text-sm font-medium"
                >
                  Slug
                </label>

                <input
                  id="vehicle-model-slug"
                  type="text"
                  value={slug}
                  onChange={(event) =>
                    setSlug(
                      event.target.value,
                    )
                  }
                  disabled={
                    operationInProgress
                  }
                  required
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
                    operationInProgress
                  }
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'A guardar...'
                    : editingId
                      ? 'Guardar alterações'
                      : 'Criar modelo'}
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-medium">
            Modelos existentes
          </h2>

          {hasMakes && (
            <div className="w-full sm:w-72">
              <label
                htmlFor="vehicle-model-filter-make"
                className="mb-1 block text-sm font-medium"
              >
                Marca apresentada
              </label>

              <select
                id="vehicle-model-filter-make"
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
          )}
        </div>

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
          loadError && (
            <p
              role="alert"
              className="text-sm text-red-600"
            >
              {loadError}
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
          !loadingModels &&
          !loadError &&
          hasMakes &&
          models.length === 0 && (
            <p className="text-sm text-gray-600">
              Ainda não existem modelos para esta marca.
            </p>
          )}

        {!loadingMakes &&
          !loadingModels &&
          !loadError &&
          hasMakes &&
          models.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Nome
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Slug
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {models.map(
                    (vehicleModel) => (
                      <tr
                        key={
                          vehicleModel.id
                        }
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          {
                            vehicleModel.name
                          }
                        </td>

                        <td className="px-4 py-3">
                          {
                            vehicleModel.slug
                          }
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  vehicleModel,
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
                                  vehicleModel,
                                )
                              }
                              disabled={
                                operationInProgress
                              }
                              className="rounded-md border px-3 py-1.5 text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              vehicleModel.id
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