'use client'

import { FormEvent, useEffect, useState } from 'react'

/**
 * Épico 8 — gestão de compatibilidades do produto:
 * cascata Make → Model → Spec (compatibilidade por especificação).
 */

type VehicleMake = {
  id: string
  name: string
}

type VehicleModel = {
  id: string
  name: string
}

type VehicleSpec = {
  id: string
  engine: string
  engineCode: string | null
  yearStart: number
  yearEnd: number | null
  fuelType: string
  powerHp: number | null
}

type ProductCompatibility = {
  id: string
  vehicleSpecId: string
  notes: string | null
  vehicleSpec: {
    engine: string
    engineCode: string | null
    yearStart: number
    yearEnd: number | null
    fuelType: string
    powerHp: number | null
    model: {
      name: string
      make: {
        name: string
      }
    }
  }
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

function specOptionLabel(spec: VehicleSpec) {
  const years =
    spec.yearEnd !== null
      ? `${spec.yearStart}–${spec.yearEnd}`
      : `desde ${spec.yearStart}`

  return `${spec.engine} · ${years}`
}

function specDetails(spec: ProductCompatibility['vehicleSpec']) {
  const details: string[] = []

  if (spec.engineCode) {
    details.push(`Código ${spec.engineCode}`)
  }

  details.push(spec.fuelType)

  if (spec.yearEnd !== null) {
    details.push(`${spec.yearStart}–${spec.yearEnd}`)
  } else {
    details.push(`Desde ${spec.yearStart}`)
  }

  if (spec.powerHp !== null) {
    details.push(`${spec.powerHp} cv`)
  }

  return details.join(' · ')
}

export default function ProductCompatibilitiesClient({
  productId,
  productName,
  onClose,
}: Props) {
  const [makes, setMakes] = useState<VehicleMake[]>([])
  const [models, setModels] = useState<VehicleModel[]>([])
  const [specs, setSpecs] = useState<VehicleSpec[]>([])
  const [compatibilities, setCompatibilities] = useState<
    ProductCompatibility[]
  >([])

  const [makeId, setMakeId] = useState('')
  const [modelId, setModelId] = useState('')
  const [specId, setSpecId] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [loadingModels, setLoadingModels] = useState(false)
  const [loadingSpecs, setLoadingSpecs] = useState(false)
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

        const [makesResponse, compatibilitiesResponse] =
          await Promise.all([
            fetch('/api/admin/vehicle-makes'),
            fetch(
              `/api/admin/products/${productId}/compatibilities`,
            ),
          ])

        if (!makesResponse.ok) {
          throw new Error(
            await getErrorMessage(makesResponse),
          )
        }

        if (!compatibilitiesResponse.ok) {
          throw new Error(
            await getErrorMessage(compatibilitiesResponse),
          )
        }

        const makesData =
          (await makesResponse.json()) as VehicleMake[]
        const compatibilitiesData =
          (await compatibilitiesResponse.json()) as ProductCompatibility[]

        if (cancelled) {
          return
        }

        setMakes(makesData)
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

  async function handleMakeChange(nextMakeId: string) {
    setMakeId(nextMakeId)
    setModelId('')
    setSpecId('')
    setModels([])
    setSpecs([])
    setError(null)

    if (!nextMakeId) {
      return
    }

    try {
      setLoadingModels(true)

      const response = await fetch(
        `/api/admin/vehicle-models?makeId=${encodeURIComponent(
          nextMakeId,
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
    setSpecId('')
    setSpecs([])
    setError(null)

    if (!nextModelId) {
      return
    }

    try {
      setLoadingSpecs(true)

      const response = await fetch(
        `/api/admin/vehicle-specs?modelId=${encodeURIComponent(
          nextModelId,
        )}`,
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const data =
        (await response.json()) as VehicleSpec[]

      setSpecs(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar as especificações',
      )
    } finally {
      setLoadingSpecs(false)
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (submitting) {
      return
    }

    if (!specId) {
      setError('Seleciona uma especificação de veículo')
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
            vehicleSpecId: specId,
            notes:
              notes.trim() === '' ? undefined : notes,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      await reloadCompatibilities()

      setSpecId('')
      setNotes('')
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
            vehicleSpecId:
              compatibility.vehicleSpecId,
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
                value={makeId}
                disabled={submitting || makes.length === 0}
                onChange={(event) => {
                  void handleMakeChange(event.target.value)
                }}
                className="rounded border px-3 py-2"
              >
                <option value="">
                  Selecionar marca
                </option>

                {makes.map((make) => (
                  <option
                    key={make.id}
                    value={make.id}
                  >
                    {make.name}
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
                  !makeId ||
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
              <span>Especificação</span>
              <select
                value={specId}
                disabled={
                  submitting ||
                  !modelId ||
                  loadingSpecs
                }
                onChange={(event) =>
                  setSpecId(event.target.value)
                }
                className="rounded border px-3 py-2"
              >
                <option value="">
                  {loadingSpecs
                    ? 'A carregar especificações...'
                    : 'Selecionar especificação'}
                </option>

                {specs.map((spec) => (
                  <option
                    key={spec.id}
                    value={spec.id}
                  >
                    {specOptionLabel(spec)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span>Notas (opcional)</span>
              <input
                type="text"
                value={notes}
                maxLength={500}
                placeholder="Ex.: requer apoios originais"
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                className="rounded border px-3 py-2"
              />
            </label>

            <div className="md:col-span-2 xl:col-span-4">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !specId
                }
                className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? 'A guardar...'
                  : 'Adicionar compatibilidade'}
              </button>
            </div>
          </form>

          {makes.length === 0 && (
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
                  const spec =
                    compatibility.vehicleSpec

                  return (
                    <div
                      key={compatibility.id}
                      className="flex flex-col gap-3 rounded border p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {spec.model.make.name}
                          {' → '}
                          {spec.model.name}
                          {' → '}
                          {spec.engine}
                        </p>

                        <p className="mt-1 text-sm text-gray-600">
                          {specDetails(spec)}
                          {compatibility.notes && (
                            <>
                              {' · '}
                              {compatibility.notes}
                            </>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={submitting}
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
