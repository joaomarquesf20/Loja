'use client'

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

export default function VehicleBrandsPage() {
  const [vehicleBrands, setVehicleBrands] =
    useState<VehicleBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

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

    async function loadVehicleBrands() {
      try {
        setLoading(true)
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

        setVehicleBrands(
          sortVehicleBrands(data),
        )
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
          setLoading(false)
        }
      }
    }

    void loadVehicleBrands()

    return () => {
      controller.abort()
    }
  }, [])

  function resetForm() {
    setName('')
    setSlug('')
    setEditingId(null)
    setActionError('')
  }

  function startEditing(
    vehicleBrand: VehicleBrand,
  ) {
    setEditingId(vehicleBrand.id)
    setName(vehicleBrand.name)
    setSlug(vehicleBrand.slug)
    setActionError('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (submitting) {
      return
    }

    setSubmitting(true)
    setActionError('')

    try {
      const url = editingId
        ? `/api/admin/vehicle-brands/${editingId}`
        : '/api/admin/vehicle-brands'

      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          slug,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      const savedVehicleBrand =
        (await response.json()) as VehicleBrand

      setVehicleBrands((current) => {
        if (editingId) {
          return sortVehicleBrands(
            current.map((vehicleBrand) =>
              vehicleBrand.id ===
              savedVehicleBrand.id
                ? savedVehicleBrand
                : vehicleBrand,
            ),
          )
        }

        return sortVehicleBrands([
          ...current,
          savedVehicleBrand,
        ])
      })

      resetForm()
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar a marca de veículo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(
    vehicleBrand: VehicleBrand,
  ) {
    if (
      !window.confirm(
        `Apagar a marca "${vehicleBrand.name}"?`,
      )
    ) {
      return
    }

    setDeletingId(vehicleBrand.id)
    setActionError('')

    try {
      const response = await fetch(
        `/api/admin/vehicle-brands/${vehicleBrand.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      setVehicleBrands((current) =>
        current.filter(
          (item) =>
            item.id !== vehicleBrand.id,
        ),
      )

      if (editingId === vehicleBrand.id) {
        resetForm()
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível apagar a marca de veículo',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const operationInProgress =
    submitting || deletingId !== null

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          Marcas de veículos
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Gerir as marcas utilizadas na
          compatibilidade de veículos.
        </p>
      </div>

      <section className="mb-8 rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-medium">
          {editingId
            ? 'Editar marca'
            : 'Nova marca'}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="vehicle-brand-name"
              className="mb-1 block text-sm font-medium"
            >
              Nome
            </label>

            <input
              id="vehicle-brand-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              disabled={operationInProgress}
              required
              maxLength={120}
              className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="vehicle-brand-slug"
              className="mb-1 block text-sm font-medium"
            >
              Slug
            </label>

            <input
              id="vehicle-brand-slug"
              type="text"
              value={slug}
              onChange={(event) =>
                setSlug(event.target.value)
              }
              disabled={operationInProgress}
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
              disabled={operationInProgress}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'A guardar...'
                : editingId
                  ? 'Guardar alterações'
                  : 'Criar marca'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={operationInProgress}
                className="rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">
          Marcas existentes
        </h2>

        {loading && (
          <p className="text-sm text-gray-600">
            A carregar marcas...
          </p>
        )}

        {!loading && loadError && (
          <p
            role="alert"
            className="text-sm text-red-600"
          >
            {loadError}
          </p>
        )}

        {!loading &&
          !loadError &&
          vehicleBrands.length === 0 && (
            <p className="text-sm text-gray-600">
              Ainda não existem marcas de veículos.
            </p>
          )}

        {!loading &&
          !loadError &&
          vehicleBrands.length > 0 && (
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
                  {vehicleBrands.map(
                    (vehicleBrand) => (
                      <tr
                        key={vehicleBrand.id}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          {vehicleBrand.name}
                        </td>

                        <td className="px-4 py-3">
                          {vehicleBrand.slug}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  vehicleBrand,
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
                                  vehicleBrand,
                                )
                              }
                              disabled={
                                operationInProgress
                              }
                              className="rounded-md border px-3 py-1.5 text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              vehicleBrand.id
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