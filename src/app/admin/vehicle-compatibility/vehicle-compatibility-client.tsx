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
 * Épico 8 — consola de compatibilidade: árvore Make → Model → Spec
 * (a especificação funde o que antes eram geração + configuração).
 */

type CreateTarget = {
  level: 'make' | 'model' | 'spec'
  parentId?: string
  parentName: string
}

type SpecNode =
  VehicleCompatibilityTree[number]['models'][number]['specs'][number]

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

function specSummary(spec: SpecNode) {
  const details: string[] = []

  if (spec.engineCode) {
    details.push(`Código ${spec.engineCode}`)
  }
  details.push(spec.fuelType)
  details.push(
    spec.yearEnd !== null
      ? `${spec.yearStart}–${spec.yearEnd}`
      : `Desde ${spec.yearStart}`,
  )
  if (spec.powerHp !== null) {
    details.push(`${spec.powerHp} cv`)
  }

  return details.join(' · ')
}

export default function VehicleCompatibilityClient() {
  const [tree, setTree] =
    useState<VehicleCompatibilityTree>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] =
    useState(false)
  const [error, setError] = useState<string | null>(
    null,
  )
  const [createTarget, setCreateTarget] =
    useState<CreateTarget | null>(null)
  const [name, setName] = useState('')
  const [engineCode, setEngineCode] =
    useState('')
  const [fuelType, setFuelType] = useState(
    'DIESEL',
  )
  const [yearStart, setYearStart] = useState('')
  const [yearEnd, setYearEnd] = useState('')
  const [powerHp, setPowerHp] = useState('')

  const load = useCallback(async () => {
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
          : 'Não foi possível carregar a compatibilidade de veículos',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  function openCreate(target: CreateTarget) {
    setCreateTarget(target)
    setName('')
    setEngineCode('')
    setFuelType('DIESEL')
    setYearStart('')
    setYearEnd('')
    setPowerHp('')
    setError(null)
  }

  async function createNode(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!createTarget) {
      return
    }

    setSubmitting(true)
    setError(null)

    const endpoint =
      createTarget.level === 'make'
        ? '/api/admin/vehicle-makes'
        : createTarget.level === 'model'
          ? '/api/admin/vehicle-models'
          : '/api/admin/vehicle-specs'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(
          createTarget.level === 'spec'
            ? {
                modelId:
                  createTarget.parentId,
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
            : createTarget.level === 'model'
              ? {
                  makeId:
                    createTarget.parentId,
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

      setCreateTarget(null)
      setName('')
      setEngineCode('')
      setYearStart('')
      setYearEnd('')
      setPowerHp('')
      await load()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Não foi possível criar o registo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function removeNode(
    endpoint: string,
    label: string,
  ) {
    if (
      !window.confirm(
        `Apagar “${label}”? Esta ação só é possível quando não existem registos dependentes.`,
      )
    ) {
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }
      await load()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível apagar o registo',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <p className="rounded-lg border border-black/8 bg-white p-5 text-sm text-[#687078]">
        A carregar hierarquia de veículos...
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/8 bg-white p-4 shadow-sm">
        <p className="max-w-2xl text-sm leading-6 text-[#687078]">
          A estrutura é partilhada por todos
          os produtos. Cria primeiro a marca,
          depois o modelo e finalmente as
          especificações (motor, anos,
          combustível e potência).
        </p>
        <button
          type="button"
          onClick={() =>
            openCreate({
              level: 'make',
              parentName: '',
            })
          }
          className="rounded-lg bg-[#ef5b2a] px-4 py-2 text-sm font-black text-white"
        >
          + Nova marca
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {createTarget && (
        <form
          onSubmit={createNode}
          className="grid gap-3 rounded-xl border border-[#ef5b2a]/30 bg-[#fff7f3] p-4 sm:grid-cols-[minmax(200px,1fr)_minmax(180px,1fr)_auto_auto] sm:items-end"
        >
          <label className="grid gap-1 text-xs font-bold">
            {createTarget.level === 'make'
              ? 'Nome da marca'
              : createTarget.level === 'model'
                ? `Modelo de ${createTarget.parentName}`
                : `Motor de ${createTarget.parentName}`}
            <input
              autoFocus
              required
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
            />
          </label>

          {createTarget.level === 'spec' && (
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
                    setPowerHp(
                      event.target.value,
                    )
                  }
                  className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
            </>
          )}

          <button
            disabled={submitting}
            className="rounded-md bg-[#171a1d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting
              ? 'A criar...'
              : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() =>
              setCreateTarget(null)
            }
            className="rounded-md border bg-white px-4 py-2 text-sm font-bold"
          >
            Cancelar
          </button>
        </form>
      )}

      {tree.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/20 bg-white p-10 text-center">
          <h2 className="font-black">
            Começa pela marca do veículo
          </h2>
          <p className="mt-2 text-sm text-[#687078]">
            Depois poderás adicionar modelos e
            especificações de fitment.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tree.map((make) => (
            <details
              key={make.id}
              className="group rounded-xl border border-black/8 bg-white shadow-sm"
              open
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-black">
                <span>
                  {make.name}
                  <span className="ml-2 text-xs font-normal text-[#687078]">
                    {make.models.length} modelo{make.models.length === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="flex items-center gap-3 text-xs font-bold">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      openCreate({
                        level: 'model',
                        parentId: make.id,
                        parentName: make.name,
                      })
                    }}
                    className="text-[#ef5b2a]"
                  >
                    + Modelo
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      void removeNode(
                        `/api/admin/vehicle-makes/${make.id}`,
                        make.name,
                      )
                    }}
                    className="text-red-700"
                  >
                    Apagar
                  </button>
                </span>
              </summary>

              <div className="space-y-3 border-t border-black/6 bg-[#f8f8f7] p-4">
                {make.models.length === 0 ? (
                  <p className="text-sm text-[#687078]">
                    Ainda não existem modelos para {make.name}.
                  </p>
                ) : (
                  make.models.map((model) => (
                    <details
                      key={model.id}
                      className="rounded-lg border border-black/8 bg-white"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold">
                        <span>{model.name}</span>
                        <span className="flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()
                              openCreate({
                                level: 'spec',
                                parentId: model.id,
                                parentName: model.name,
                              })
                            }}
                            className="font-bold text-[#ef5b2a]"
                          >
                            + Especificação
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()
                              void removeNode(
                                `/api/admin/vehicle-models/${model.id}`,
                                model.name,
                              )
                            }}
                            className="font-bold text-red-700"
                          >
                            Apagar
                          </button>
                        </span>
                      </summary>

                      <div className="space-y-2 border-t border-black/6 p-3">
                        {model.specs.length === 0 ? (
                          <p className="text-sm text-[#687078]">
                            Ainda não existem especificações.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {model.specs.map(
                              (spec) => (
                                <li
                                  key={spec.id}
                                  className="flex items-center justify-between gap-3 rounded-md border border-black/6 bg-[#f8f8f7] px-3 py-2"
                                >
                                  <div>
                                    <p className="text-sm font-semibold">
                                      {spec.engine}
                                    </p>
                                    <p className="text-xs text-[#687078]">
                                      {specSummary(
                                        spec,
                                      )}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void removeNode(
                                        `/api/admin/vehicle-specs/${spec.id}`,
                                        spec.engine,
                                      )
                                    }
                                    className="text-xs font-bold text-red-700"
                                  >
                                    Apagar
                                  </button>
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                      </div>
                    </details>
                  ))
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
