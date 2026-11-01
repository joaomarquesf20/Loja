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

export default function VehicleMakesPage() {
  const [VehicleMakes, setVehicleMakes] =
    useState<VehicleMake[]>([])
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

    async function loadVehicleMakes() {
      try {
        setLoading(true)
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

        setVehicleMakes(
          sortVehicleMakes(data),
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

    void loadVehicleMakes()

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
    VehicleMake: VehicleMake,
  ) {
    setEditingId(VehicleMake.id)
    setName(VehicleMake.name)
    setSlug(VehicleMake.slug)
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
        ? `/api/admin/vehicle-makes/${editingId}`
        : '/api/admin/vehicle-makes'

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

      const savedVehicleMake =
        (await response.json()) as VehicleMake

      setVehicleMakes((current) => {
        if (editingId) {
          return sortVehicleMakes(
            current.map((VehicleMake) =>
              VehicleMake.id ===
              savedVehicleMake.id
                ? savedVehicleMake
                : VehicleMake,
            ),
          )
        }

        return sortVehicleMakes([
          ...current,
          savedVehicleMake,
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
    VehicleMake: VehicleMake,
  ) {
    if (
      !window.confirm(
        `Apagar a marca "${VehicleMake.name}"?`,
      )
    ) {
      return
    }

    setDeletingId(VehicleMake.id)
    setActionError('')

    try {
      const response = await fetch(
        `/api/admin/vehicle-makes/${VehicleMake.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error(
          await getApiError(response),
        )
      }

      setVehicleMakes((current) =>
        current.filter(
          (item) =>
            item.id !== VehicleMake.id,
        ),
      )

      if (editingId === VehicleMake.id) {
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
              htmlFor="vehicle-make-name"
              className="mb-1 block text-sm font-medium"
            >
              Nome
            </label>

            <input
              id="vehicle-make-name"
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
              htmlFor="vehicle-make-slug"
              className="mb-1 block text-sm font-medium"
            >
              Slug
            </label>

            <input
              id="vehicle-make-slug"
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
          VehicleMakes.length === 0 && (
            <p className="text-sm text-gray-600">
              Ainda não existem marcas de veículos.
            </p>
          )}

        {!loading &&
          !loadError &&
          VehicleMakes.length > 0 && (
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
                  {VehicleMakes.map(
                    (VehicleMake) => (
                      <tr
                        key={VehicleMake.id}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          {VehicleMake.name}
                        </td>

                        <td className="px-4 py-3">
                          {VehicleMake.slug}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  VehicleMake,
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
                                  VehicleMake,
                                )
                              }
                              disabled={
                                operationInProgress
                              }
                              className="rounded-md border px-3 py-1.5 text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              VehicleMake.id
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