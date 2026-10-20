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

type CreateTarget = {
  level:
    | 'make'
    | 'model'
    | 'generation'
    | 'configuration'
  parentId?: string
  parentName: string
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

function configurationSummary(
  configuration: VehicleCompatibilityTree[number]['models'][number]['generations'][number]['configurations'][number],
) {
  const details: string[] = []

  if (configuration.engineCode) {
    details.push(`Motor ${configuration.engineCode}`)
  }
  if (configuration.engineType) {
    details.push(configuration.engineType)
  }
  if (configuration.displacementCc !== null) {
    details.push(`${configuration.displacementCc} cc`)
  }
  if (configuration.powerKw !== null) {
    details.push(`${configuration.powerKw} kW`)
  }
  if (configuration.yearFrom !== null) {
    details.push(
      configuration.yearTo !== null
        ? `${configuration.yearFrom}–${configuration.yearTo}`
        : `Desde ${configuration.yearFrom}`,
    )
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
  const [platform, setPlatform] = useState('')
  const [engineCode, setEngineCode] =
    useState('')
  const [engineType, setEngineType] =
    useState('Gasolina')
  const [displacementCc, setDisplacementCc] =
    useState('')
  const [powerKw, setPowerKw] = useState('')
  const [bodyType, setBodyType] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')

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
    setPlatform('')
    setEngineCode('')
    setEngineType('Gasolina')
    setDisplacementCc('')
    setPowerKw('')
    setBodyType('')
    setYearFrom('')
    setYearTo('')
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
        ? '/api/admin/vehicle-brands'
        : createTarget.level === 'model'
          ? '/api/admin/vehicle-models'
          : createTarget.level === 'generation'
            ? '/api/admin/vehicle-generations'
            : '/api/admin/vehicle-configurations'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(
          createTarget.level ===
            'configuration'
            ? {
                generationId:
                  createTarget.parentId,
                name,
                engineCode:
                  engineCode || null,
                engineType:
                  engineType || null,
                displacementCc:
                  displacementCc
                    ? Number(displacementCc)
                    : null,
                powerKw: powerKw
                  ? Number(powerKw)
                  : null,
                bodyType:
                  bodyType || null,
                yearFrom: yearFrom
                  ? Number(yearFrom)
                  : null,
                yearTo: yearTo
                  ? Number(yearTo)
                  : null,
              }
            : createTarget.level === 'model'
              ? {
                  brandId:
                    createTarget.parentId,
                  name,
                  slug: toSlug(name),
                  description: null,
                }
              : createTarget.level === 'generation'
                ? {
                    modelId:
                      createTarget.parentId,
                    name,
                    platform:
                      platform || null,
                    description: null,
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
      setPlatform('')
      setEngineCode('')
      setDisplacementCc('')
      setPowerKw('')
      setBodyType('')
      setYearFrom('')
      setYearTo('')
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
          os produtos. Cria primeiro a marca e
          depois desce até ao motor quando for
          necessário.
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
                : createTarget.level === 'generation'
                  ? `Geração de ${createTarget.parentName}`
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

          {createTarget.level === 'generation' && (
            <label className="grid gap-1 text-xs font-bold">
              Plataforma / chassis
              <input
                value={platform}
                onChange={(event) =>
                  setPlatform(event.target.value)
                }
                className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
          )}

          {createTarget.level ===
            'configuration' && (
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
                  value={engineType}
                  onChange={(event) =>
                    setEngineType(
                      event.target.value,
                    )
                  }
                  className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                >
                  <option>Gasolina</option>
                  <option>Diesel</option>
                  <option>Híbrido</option>
                  <option>Elétrico</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold">
                Cilindrada (cc)
                <input
                  type="number"
                  min="1"
                  value={displacementCc}
                  onChange={(event) =>
                    setDisplacementCc(
                      event.target.value,
                    )
                  }
                  className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-bold">
                Potência (kW)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={powerKw}
                  onChange={(event) =>
                    setPowerKw(
                      event.target.value,
                    )
                  }
                  className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-bold">
                Carroçaria
                <input
                  value={bodyType}
                  onChange={(event) =>
                    setBodyType(
                      event.target.value,
                    )
                  }
                  className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-bold">
                  Ano inicial
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={yearFrom}
                    onChange={(event) =>
                      setYearFrom(
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
                    value={yearTo}
                    onChange={(event) =>
                      setYearTo(
                        event.target.value,
                      )
                    }
                    className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                  />
                </label>
              </div>
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
            Depois poderás adicionar modelos,
            gerações e motores.
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
                        `/api/admin/vehicle-brands/${make.id}`,
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
                                level: 'generation',
                                parentId: model.id,
                                parentName: model.name,
                              })
                            }}
                            className="font-bold text-[#ef5b2a]"
                          >
                            + Geração
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
                        {model.generations.length === 0 ? (
                          <p className="text-sm text-[#687078]">
                            Ainda não existem gerações.
                          </p>
                        ) : (
                          model.generations.map(
                            (generation) => (
                              <div
                                key={generation.id}
                                className="rounded-lg border border-black/8 bg-[#f8f8f7] p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-bold">
                                      {generation.name}
                                    </p>
                                    {generation.platform && (
                                      <p className="text-xs text-[#687078]">
                                        Plataforma: {generation.platform}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openCreate({
                                          level: 'configuration',
                                          parentId:
                                            generation.id,
                                          parentName:
                                            generation.name,
                                        })
                                      }
                                      className="text-xs font-bold text-[#ef5b2a]"
                                    >
                                      + Motor
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void removeNode(
                                          `/api/admin/vehicle-generations/${generation.id}`,
                                          generation.name,
                                        )
                                      }
                                      className="text-xs font-bold text-red-700"
                                    >
                                      Apagar geração
                                    </button>
                                  </div>
                                </div>

                                <ul className="mt-3 space-y-2">
                                  {generation.configurations.length ===
                                  0 ? (
                                    <li className="text-xs text-[#687078]">
                                      Sem motores/configurações.
                                    </li>
                                  ) : (
                                    generation.configurations.map(
                                      (configuration) => (
                                        <li
                                          key={configuration.id}
                                          className="flex items-center justify-between gap-3 rounded-md border border-black/6 bg-white px-3 py-2"
                                        >
                                          <div>
                                            <p className="text-sm font-semibold">
                                              {configuration.name}
                                            </p>
                                            <p className="text-xs text-[#687078]">
                                              {configurationSummary(
                                                configuration,
                                              ) || 'Sem detalhes adicionais'}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void removeNode(
                                                `/api/admin/vehicle-configurations/${configuration.id}`,
                                                configuration.name,
                                              )
                                            }
                                            className="text-xs font-bold text-red-700"
                                          >
                                            Apagar
                                          </button>
                                        </li>
                                      ),
                                    )
                                  )}
                                </ul>
                              </div>
                            ),
                          )
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
