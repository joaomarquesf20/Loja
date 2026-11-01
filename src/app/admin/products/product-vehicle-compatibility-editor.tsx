'use client'

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react'

import type {
  VehicleCompatibilityTree,
} from '@/server/vehicle-compatibility-tree'

/**
 * Épico 8 — a compatibilidade é definida ao nível da
 * especificação de veículo (motor + anos), com cascata
 * Make → Model → Spec e criação inline dos 3 níveis.
 */

export type ProductCompatibilityDraft = {
  key: string
  vehicleMakeId: string
  vehicleModelId: string
  vehicleSpecId: string
  notes: string
}

type Props = {
  value: ProductCompatibilityDraft[]
  onChange: (
    value: ProductCompatibilityDraft[],
  ) => void
  required?: boolean
}

type CreateLevel = 'make' | 'model' | 'spec'

type SpecOption =
  VehicleCompatibilityTree[number]['models'][number]['specs'][number]

let draftSequence = 0

function createDraft(
  values: Partial<ProductCompatibilityDraft> = {},
): ProductCompatibilityDraft {
  draftSequence += 1

  return {
    key: `compatibility-${Date.now()}-${draftSequence}`,
    vehicleMakeId: '',
    vehicleModelId: '',
    vehicleSpecId: '',
    notes: '',
    ...values,
  }
}

async function getErrorMessage(
  response: Response,
) {
  try {
    const data = (await response.json()) as {
      error?: string
    }
    return (
      data.error ??
      `Erro HTTP ${response.status}`
    )
  } catch {
    return `Erro HTTP ${response.status}`
  }
}

function toSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('pt-PT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function specOptionLabel(spec: SpecOption) {
  const years =
    spec.yearEnd !== null
      ? `${spec.yearStart}–${spec.yearEnd}`
      : `desde ${spec.yearStart}`

  return `${spec.engine} · ${years}`
}

function InlineCreateForm({
  level,
  draft,
  onCreated,
  onCancel,
}: {
  level: CreateLevel
  draft: ProductCompatibilityDraft
  onCreated: (
    level: CreateLevel,
    id: string,
  ) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [engineCode, setEngineCode] =
    useState('')
  const [fuelType, setFuelType] = useState(
    'DIESEL',
  )
  const [yearStart, setYearStart] = useState('')
  const [yearEnd, setYearEnd] = useState('')
  const [powerHp, setPowerHp] = useState('')
  const [submitting, setSubmitting] =
    useState(false)
  const [error, setError] = useState<string | null>(
    null,
  )

  const titles: Record<CreateLevel, string> = {
    make: 'Criar marca de veículo',
    model: 'Criar modelo de veículo',
    spec: 'Criar especificação / motor',
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const endpoint =
        level === 'make'
          ? '/api/admin/vehicle-makes'
          : level === 'model'
            ? '/api/admin/vehicle-models'
            : '/api/admin/vehicle-specs'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(
          level === 'spec'
            ? {
                modelId:
                  draft.vehicleModelId,
                engine: name,
                engineCode:
                  engineCode || null,
                yearStart: Number(yearStart),
                yearEnd: yearEnd
                  ? Number(yearEnd)
                  : null,
                fuelType,
                powerHp: powerHp
                  ? Number(powerHp)
                  : null,
              }
            : level === 'model'
              ? {
                  makeId:
                    draft.vehicleMakeId,
                  name,
                  slug: toSlug(name),
                }
              : {
                  name,
                  slug: toSlug(name),
                },
        ),
      })

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }

      const created =
        (await response.json()) as { id: string }
      onCreated(level, created.id)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível criar o registo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 grid gap-3 rounded-lg border border-brand/30 bg-brand-soft p-4 sm:grid-cols-2"
    >
      <h4 className="font-black sm:col-span-2">
        {titles[level]}
      </h4>

      <label className="grid gap-1 text-xs font-bold">
        {level === 'spec'
          ? 'Designação do motor'
          : 'Nome'}
        <input
          required
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
        />
      </label>

      {level === 'spec' && (
        <>
          <label className="grid gap-1 text-xs font-bold">
            Código de motor
            <input
              value={engineCode}
              onChange={(event) =>
                setEngineCode(
                  event.target.value,
                )
              }
              className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold">
            Combustível
            <select
              value={fuelType}
              onChange={(event) =>
                setFuelType(
                  event.target.value,
                )
              }
              className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
            >
              <option>DIESEL</option>
              <option>GASOLINA</option>
              <option>HÍBRIDO</option>
              <option>ELÉTRICO</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-bold">
              Ano inicial
              <input
                type="number"
                min="1900"
                max="2100"
                required
                value={yearStart}
                onChange={(event) =>
                  setYearStart(
                    event.target.value,
                  )
                }
                className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold">
              Ano final
              <input
                type="number"
                min="1900"
                max="2100"
                value={yearEnd}
                onChange={(event) =>
                  setYearEnd(
                    event.target.value,
                  )
                }
                className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-bold">
            Potência (cv)
            <input
              type="number"
              min="1"
              max="2000"
              value={powerHp}
              onChange={(event) =>
                setPowerHp(event.target.value)
              }
              className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-red-700 sm:col-span-2"
        >
          {error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          disabled={submitting}
          className="rounded-md bg-[#171a1d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting
            ? 'A criar...'
            : 'Criar e selecionar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm font-bold"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function ProductVehicleCompatibilityEditor({
  value,
  onChange,
  required = false,
}: Props) {
  const [tree, setTree] =
    useState<VehicleCompatibilityTree>([])
  const [loading, setLoading] = useState(true)
  const [createTarget, setCreateTarget] =
    useState<{
      level: CreateLevel
      draftKey: string
    } | null>(null)
  const [error, setError] = useState<string | null>(
    null,
  )

  const loadTree = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(
        '/api/admin/vehicle-compatibility',
        { cache: 'no-store' },
      )
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }
      setTree(
        (await response.json()) as VehicleCompatibilityTree,
      )
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a hierarquia de veículos',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadTree()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadTree])

  function updateDraft(
    key: string,
    patch: Partial<ProductCompatibilityDraft>,
  ) {
    onChange(
      value.map((draft) =>
        draft.key === key
          ? { ...draft, ...patch }
          : draft,
      ),
    )
  }

  async function handleInlineCreated(
    draftKey: string,
    level: CreateLevel,
    id: string,
  ) {
    await loadTree()
    setCreateTarget(null)

    if (level === 'make') {
      updateDraft(draftKey, {
        vehicleMakeId: id,
        vehicleModelId: '',
        vehicleSpecId: '',
      })
    }
    if (level === 'model') {
      updateDraft(draftKey, {
        vehicleModelId: id,
        vehicleSpecId: '',
      })
    }
    if (level === 'spec') {
      updateDraft(draftKey, {
        vehicleSpecId: id,
      })
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">
            Aplicações de veículo
          </h3>
          <p className="mt-1 text-sm text-[#687078]">
            Define marca, modelo e especificação
            (motor e anos) sem sair do produto.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...value,
              createDraft(),
            ])
          }
          className="rounded-md border border-black/12 px-4 py-2 text-sm font-bold hover:border-black/30"
        >
          + Adicionar aplicação
        </button>
      </div>

      {required && value.length === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          A suspensão precisa de pelo menos uma
          aplicação de veículo.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[#687078]">
          A carregar hierarquia de veículos...
        </p>
      ) : (
        <div className="space-y-4">
          {value.map((draft, index) => {
            const make = tree.find(
              (item) =>
                item.id ===
                draft.vehicleMakeId,
            )
            const model = make?.models.find(
              (item) =>
                item.id ===
                draft.vehicleModelId,
            )

            return (
              <article
                key={draft.key}
                className="rounded-xl border border-black/8 bg-[#f8f8f7] p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h4 className="font-black">
                    Aplicação {index + 1}
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChange([
                          ...value,
                          {
                            ...draft,
                            key: createDraft()
                              .key,
                          },
                        ])
                      }
                      className="text-xs font-bold"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          value.filter(
                            (item) =>
                              item.key !==
                              draft.key,
                          ),
                        )
                      }
                      className="text-xs font-bold text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-1 text-xs font-bold">
                    Marca
                    <select
                      required
                      value={draft.vehicleMakeId}
                      onChange={(event) =>
                        updateDraft(draft.key, {
                          vehicleMakeId:
                            event.target.value,
                          vehicleModelId: '',
                          vehicleSpecId: '',
                        })
                      }
                      className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                    >
                      <option value="">
                        Selecionar
                      </option>
                      {tree.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setCreateTarget({
                          level: 'make',
                          draftKey: draft.key,
                        })
                      }
                      className="justify-self-start text-xs font-bold text-brand"
                    >
                      + Criar marca
                    </button>
                  </label>

                  <label className="grid gap-1 text-xs font-bold">
                    Modelo
                    <select
                      required
                      disabled={!make}
                      value={draft.vehicleModelId}
                      onChange={(event) =>
                        updateDraft(draft.key, {
                          vehicleModelId:
                            event.target.value,
                          vehicleSpecId: '',
                        })
                      }
                      className="rounded-md border bg-white px-3 py-2 text-sm font-normal disabled:opacity-50"
                    >
                      <option value="">
                        Selecionar
                      </option>
                      {make?.models.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!make}
                      onClick={() =>
                        setCreateTarget({
                          level: 'model',
                          draftKey: draft.key,
                        })
                      }
                      className="justify-self-start text-xs font-bold text-brand disabled:opacity-40"
                    >
                      + Criar modelo
                    </button>
                  </label>

                  <label className="grid gap-1 text-xs font-bold">
                    Especificação
                    <select
                      required
                      disabled={!model}
                      value={draft.vehicleSpecId}
                      onChange={(event) =>
                        updateDraft(draft.key, {
                          vehicleSpecId:
                            event.target.value,
                        })
                      }
                      className="rounded-md border bg-white px-3 py-2 text-sm font-normal disabled:opacity-50"
                    >
                      <option value="">
                        Selecionar
                      </option>
                      {model?.specs.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {specOptionLabel(
                            item,
                          )}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!model}
                      onClick={() =>
                        setCreateTarget({
                          level: 'spec',
                          draftKey: draft.key,
                        })
                      }
                      className="justify-self-start text-xs font-bold text-brand disabled:opacity-40"
                    >
                      + Criar especificação
                    </button>
                  </label>

                  <label className="grid gap-1 text-xs font-bold">
                    Notas (opcional)
                    <input
                      type="text"
                      value={draft.notes}
                      maxLength={500}
                      placeholder="Ex.: requer apoios originais"
                      onChange={(event) =>
                        updateDraft(draft.key, {
                          notes:
                            event.target.value,
                        })
                      }
                      className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                    />
                  </label>
                </div>

                {createTarget
                  ?.draftKey === draft.key && (
                  <InlineCreateForm
                    level={createTarget.level}
                    draft={draft}
                    onCreated={(level, id) =>
                      void handleInlineCreated(
                        draft.key,
                        level,
                        id,
                      )
                    }
                    onCancel={() =>
                      setCreateTarget(null)
                    }
                  />
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export { createDraft }
