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

export default function VehicleModelsPage() {
  const [brands, setBrands] = useState<
    VehicleBrand[]
  >([])
  const [
    selectedBrandId,
    setSelectedBrandId,
  ] = useState('')
  const [models, setModels] = useState<
    VehicleModel[]
  >([])

  const [
    loadingBrands,
    setLoadingBrands,
  ] = useState(true)
  const [
    loadingModels,
    setLoadingModels,
  ] = useState(false)

  const [loadError, setLoadError] =
    useState('')
  const [actionError, setActionError] =
    useState('')

  const [formBrandId, setFormBrandId] =
    useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] =
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
          setFormBrandId('')
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

    async function loadVehicleModels() {
      try {
        setLoadingModels(true)
        setLoadError('')
        setActionError('')
        setEditingId(null)
        setName('')
        setSlug('')
        setDescription('')
        setFormBrandId(selectedBrandId)

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
  }, [selectedBrandId])

  function resetForm() {
    setFormBrandId(selectedBrandId)
    setName('')
    setSlug('')
    setDescription('')
    setEditingId(null)
    setActionError('')
  }

  function startEditing(
    vehicleModel: VehicleModel,
  ) {
    setEditingId(vehicleModel.id)
    setFormBrandId(vehicleModel.brandId)
    setName(vehicleModel.name)
    setSlug(vehicleModel.slug)
    setDescription(
      vehicleModel.description ?? '',
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

    if (!formBrandId) {
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
          brandId: formBrandId,
          name,
          slug,
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
          savedVehicleModel.brandId !==
          selectedBrandId
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

  const hasBrands = brands.length > 0

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
                Ainda não existem marcas de veículos.
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
                  htmlFor="vehicle-model-brand"
                  className="mb-1 block text-sm font-medium"
                >
                  Marca
                </label>

                <select
                  id="vehicle-model-brand"
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

              <div>
                <label
                  htmlFor="vehicle-model-description"
                  className="mb-1 block text-sm font-medium"
                >
                  Descrição
                </label>

                <textarea
                  id="vehicle-model-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  disabled={
                    operationInProgress
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-medium">
            Modelos existentes
          </h2>

          {hasBrands && (
            <div className="w-full sm:w-72">
              <label
                htmlFor="vehicle-model-filter-brand"
                className="mb-1 block text-sm font-medium"
              >
                Marca apresentada
              </label>

              <select
                id="vehicle-model-filter-brand"
                value={selectedBrandId}
                onChange={(event) =>
                  setSelectedBrandId(
                    event.target.value,
                  )
                }
                disabled={
                  loadingModels ||
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
          )}
        </div>

        {loadingBrands && (
          <p className="text-sm text-gray-600">
            A carregar marcas...
          </p>
        )}

        {!loadingBrands &&
          hasBrands &&
          loadingModels && (
            <p className="text-sm text-gray-600">
              A carregar modelos...
            </p>
          )}

        {!loadingBrands &&
          !loadingModels &&
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
          !loadingModels &&
          !loadError &&
          hasBrands &&
          models.length === 0 && (
            <p className="text-sm text-gray-600">
              Ainda não existem modelos para esta marca.
            </p>
          )}

        {!loadingBrands &&
          !loadingModels &&
          !loadError &&
          hasBrands &&
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

                    <th className="px-4 py-3 font-medium">
                      Descrição
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
                          {vehicleModel.description ??
                            '—'}
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