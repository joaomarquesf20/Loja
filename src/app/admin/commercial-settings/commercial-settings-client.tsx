'use client'

import {
  FormEvent,
  useEffect,
  useState,
} from 'react'

type CheckoutRegion =
  | 'PORTUGAL_MAINLAND'
  | 'MADEIRA'
  | 'AZORES'
  | 'INTERNATIONAL'

type ShippingClass =
  | 'SMALL'
  | 'STANDARD'
  | 'BULKY'
  | 'HEAVY'
  | 'QUOTE_REQUIRED'
  | 'UNASSIGNED'

type EditableShippingClass =
  | 'SMALL'
  | 'STANDARD'
  | 'BULKY'

type CommercialShippingRule = {
  id: string
  region: CheckoutRegion
  shippingClass: ShippingClass
  checkoutEnabled: boolean
  shippingCost: string | null
  maximumShippingCost: string | null
  freeShippingThreshold: string | null
}

type CommercialRegionRule = {
  region: CheckoutRegion
  checkoutEnabled: boolean
  taxRatePercent: string | null
  shippingRules: CommercialShippingRule[]
}

type CommercialSettings = {
  store: {
    id: string
    pricesIncludeTax: boolean
  }
  regions: CommercialRegionRule[]
}

type StoreForm = {
  pricesIncludeTax: boolean
}

type RegionForm = {
  checkoutEnabled: boolean
  taxRatePercent: string
}

type ShippingForm = {
  checkoutEnabled: boolean
  shippingCost: string
  maximumShippingCost: string
  freeShippingThreshold: string
}

type ShippingForms = Record<
  EditableShippingClass,
  ShippingForm
>

type LoadedForms = {
  storeForm: StoreForm
  regionForm: RegionForm
  shippingForms: ShippingForms
}

type Notice = {
  type: 'success' | 'error'
  message: string
}

const emptyShippingForm: ShippingForm = {
  checkoutEnabled: false,
  shippingCost: '',
  maximumShippingCost: '',
  freeShippingThreshold: '',
}

const shippingMeta: Record<
  EditableShippingClass,
  {
    title: string
    description: string
  }
> = {
  SMALL: {
    title: 'Pequeno',
    description:
      'Artigos pequenos, como tampas de espelho, ponteiras e acessórios de pequenas dimensões.',
  },
  STANDARD: {
    title: 'Normal',
    description:
      'Artigos de dimensões normais, como lips, embaladeiras e peças semelhantes.',
  },
  BULKY: {
    title: 'Volumoso',
    description:
      'Artigos volumosos usam a tarifa específica definida em cada produto e nunca beneficiam de portes grátis.',
  },
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message
  }

  return fallback
}

async function readJson<T>(
  response: Response,
): Promise<T> {
  const body = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    if (
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (
        body as {
          error?: unknown
        }
      ).error === 'string'
    ) {
      throw new Error(
        (
          body as {
            error: string
          }
        ).error,
      )
    }

    throw new Error(
      'Não foi possível concluir a operação',
    )
  }

  return body as T
}

function parseDecimal(
  value: string,
  label: string,
  options?: {
    allowEmpty?: boolean
    maximum?: number
  },
): number | null {
  const trimmed = value.trim()

  if (!trimmed) {
    if (options?.allowEmpty) {
      return null
    }

    throw new Error(
      `${label} é obrigatório`,
    )
  }

  const normalized =
    trimmed.replace(',', '.')

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(
      normalized,
    )
  ) {
    throw new Error(
      `${label} deve ter no máximo duas casas decimais`,
    )
  }

  const number = Number(normalized)

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    throw new Error(
      `${label} deve ser um valor válido`,
    )
  }

  if (
    options?.maximum !== undefined &&
    number > options.maximum
  ) {
    throw new Error(
      `${label} não pode ser superior a ${options.maximum}`,
    )
  }

  return number
}

function shippingRuleToForm(
  rule: CommercialShippingRule,
): ShippingForm {
  return {
    checkoutEnabled:
      rule.checkoutEnabled,
    shippingCost:
      rule.shippingCost ?? '',
    maximumShippingCost:
      rule.maximumShippingCost ?? '',
    freeShippingThreshold:
      rule.freeShippingThreshold ?? '',
  }
}

async function fetchCommercialForms(): Promise<LoadedForms> {
  const response = await fetch(
    '/api/admin/commercial-settings',
    {
      cache: 'no-store',
    },
  )

  const settings =
    await readJson<CommercialSettings>(
      response,
    )

  const mainland =
    settings.regions.find(
      (region) =>
        region.region ===
        'PORTUGAL_MAINLAND',
    )

  if (!mainland) {
    throw new Error(
      'A configuração de Portugal Continental não está disponível',
    )
  }

  const small =
    mainland.shippingRules.find(
      (rule) =>
        rule.shippingClass ===
        'SMALL',
    )

  const standard =
    mainland.shippingRules.find(
      (rule) =>
        rule.shippingClass ===
        'STANDARD',
    )

  const bulky =
    mainland.shippingRules.find(
      (rule) =>
        rule.shippingClass ===
        'BULKY',
    )

  if (
    !small ||
    !standard ||
    !bulky
  ) {
    throw new Error(
      'As regras de transporte de Portugal Continental estão incompletas',
    )
  }

  return {
    storeForm: {
      pricesIncludeTax:
        settings.store
          .pricesIncludeTax,
    },
    regionForm: {
      checkoutEnabled:
        mainland.checkoutEnabled,
      taxRatePercent:
        mainland.taxRatePercent ??
        '',
    },
    shippingForms: {
      SMALL:
        shippingRuleToForm(
          small,
        ),
      STANDARD:
        shippingRuleToForm(
          standard,
        ),
      BULKY:
        shippingRuleToForm(
          bulky,
        ),
    },
  }
}

async function patchCommercialSettings<T>(
  body: unknown,
): Promise<T> {
  const response = await fetch(
    '/api/admin/commercial-settings',
    {
      method: 'PATCH',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  return readJson<T>(response)
}

export default function CommercialSettingsClient() {
  const [loading, setLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState<string | null>(null)

  const [notice, setNotice] =
    useState<Notice | null>(null)

  const [saving, setSaving] =
    useState<string | null>(null)

  const [storeForm, setStoreForm] =
    useState<StoreForm>({
      pricesIncludeTax: true,
    })

  const [regionForm, setRegionForm] =
    useState<RegionForm>({
      checkoutEnabled: false,
      taxRatePercent: '',
    })

  const [
    shippingForms,
    setShippingForms,
  ] = useState<ShippingForms>({
    SMALL: {
      ...emptyShippingForm,
    },
    STANDARD: {
      ...emptyShippingForm,
    },
    BULKY: {
      ...emptyShippingForm,
    },
  })

  useEffect(() => {
    let cancelled = false

    void fetchCommercialForms()
      .then((forms) => {
        if (cancelled) {
          return
        }

        setStoreForm(
          forms.storeForm,
        )

        setRegionForm(
          forms.regionForm,
        )

        setShippingForms(
          forms.shippingForms,
        )

        setLoadError(null)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setLoadError(
          getErrorMessage(
            error,
            'Não foi possível carregar a configuração comercial',
          ),
        )
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function retryLoadSettings() {
    if (loading) {
      return
    }

    setLoading(true)
    setLoadError(null)

    try {
      const forms =
        await fetchCommercialForms()

      setStoreForm(
        forms.storeForm,
      )

      setRegionForm(
        forms.regionForm,
      )

      setShippingForms(
        forms.shippingForms,
      )
    } catch (error) {
      setLoadError(
        getErrorMessage(
          error,
          'Não foi possível carregar a configuração comercial',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  function updateShippingForm(
    shippingClass:
      EditableShippingClass,
    patch: Partial<ShippingForm>,
  ) {
    setShippingForms(
      (current) => ({
        ...current,
        [shippingClass]: {
          ...current[
            shippingClass
          ],
          ...patch,
        },
      }),
    )
  }

  async function saveStore(
    event: FormEvent,
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    setSaving('store')
    setNotice(null)

    try {
      const result =
        await patchCommercialSettings<{
          id: string
          pricesIncludeTax: boolean
        }>({
          target: 'store',
          data: {
            pricesIncludeTax:
              storeForm
                .pricesIncludeTax,
          },
        })

      setStoreForm({
        pricesIncludeTax:
          result.pricesIncludeTax,
      })

      setNotice({
        type: 'success',
        message:
          'Configuração global guardada.',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        message: getErrorMessage(
          error,
          'Não foi possível guardar a configuração global',
        ),
      })
    } finally {
      setSaving(null)
    }
  }

  async function saveRegion(
    event: FormEvent,
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    setNotice(null)

    let taxRatePercent:
      | number
      | null

    try {
      taxRatePercent =
        parseDecimal(
          regionForm
            .taxRatePercent,
          'A taxa de IVA',
          {
            allowEmpty:
              !regionForm
                .checkoutEnabled,
            maximum: 100,
          },
        )
    } catch (error) {
      setNotice({
        type: 'error',
        message: getErrorMessage(
          error,
          'Taxa de IVA inválida',
        ),
      })

      return
    }

    setSaving('region')

    try {
      const result =
        await patchCommercialSettings<{
          region:
            CheckoutRegion
          checkoutEnabled: boolean
          taxRatePercent:
            | string
            | null
        }>({
          target: 'region',
          region:
            'PORTUGAL_MAINLAND',
          data: {
            checkoutEnabled:
              regionForm
                .checkoutEnabled,
            taxRatePercent,
          },
        })

      setRegionForm({
        checkoutEnabled:
          result.checkoutEnabled,
        taxRatePercent:
          result.taxRatePercent ??
          '',
      })

      setNotice({
        type: 'success',
        message:
          'Região guardada.',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        message: getErrorMessage(
          error,
          'Não foi possível guardar a região',
        ),
      })
    } finally {
      setSaving(null)
    }
  }

  async function saveShippingRule(
    event: FormEvent,
    shippingClass:
      EditableShippingClass,
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    setNotice(null)

    const form =
      shippingForms[
        shippingClass
      ]

    let shippingCost:
      | number
      | null

    let maximumShippingCost:
      | number
      | null = null

    let freeShippingThreshold:
      | number
      | null = null

    try {
      shippingCost =
        parseDecimal(
          form.shippingCost,
          shippingClass ===
            'BULKY'
            ? 'Os portes mínimos'
            : 'Os portes',
          {
            allowEmpty:
              !form.checkoutEnabled,
          },
        )

      if (
        shippingClass ===
        'BULKY'
      ) {
        maximumShippingCost =
          parseDecimal(
            form.maximumShippingCost,
            'Os portes máximos',
            {
              allowEmpty:
                !form.checkoutEnabled,
            },
          )

        if (
          shippingCost !== null &&
          maximumShippingCost !==
            null &&
          maximumShippingCost <
            shippingCost
        ) {
          throw new Error(
            'Os portes máximos não podem ser inferiores aos portes mínimos',
          )
        }
      } else {
        freeShippingThreshold =
          parseDecimal(
            form.freeShippingThreshold,
            'O limite de portes grátis',
            {
              allowEmpty: true,
            },
          )
      }
    } catch (error) {
      setNotice({
        type: 'error',
        message: getErrorMessage(
          error,
          'Regra de transporte inválida',
        ),
      })

      return
    }

    const savingKey =
      `shipping-${shippingClass}`

    setSaving(savingKey)

    try {
      const result =
        await patchCommercialSettings<CommercialShippingRule>(
          {
            target:
              'shipping-rule',
            region:
              'PORTUGAL_MAINLAND',
            shippingClass,
            data: {
              checkoutEnabled:
                form.checkoutEnabled,
              shippingCost,
              maximumShippingCost,
              freeShippingThreshold,
            },
          },
        )

      updateShippingForm(
        shippingClass,
        shippingRuleToForm(
          result,
        ),
      )

      setNotice({
        type: 'success',
        message: `Regra “${shippingMeta[shippingClass].title}” guardada.`,
      })
    } catch (error) {
      setNotice({
        type: 'error',
        message: getErrorMessage(
          error,
          'Não foi possível guardar a regra de transporte',
        ),
      })
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-4">
        A carregar configuração
        comercial...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4">
        <p className="text-red-800">
          {loadError}
        </p>

        <button
          type="button"
          onClick={() => {
            void retryLoadSettings()
          }}
          className="mt-3 rounded border border-red-400 px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        Nesta versão, o checkout
        comercial está preparado apenas
        para Portugal Continental. Madeira,
        Açores e destinos internacionais
        ficam desativados até serem
        definidas regras próprias.
      </div>

      {notice && (
        <div
          role={
            notice.type === 'error'
              ? 'alert'
              : 'status'
          }
          className={
            notice.type === 'error'
              ? 'rounded-lg border border-red-300 bg-red-50 p-4 text-red-800'
              : 'rounded-lg border border-green-300 bg-green-50 p-4 text-green-800'
          }
        >
          {notice.message}
        </div>
      )}

      <form
        onSubmit={saveStore}
        className="rounded-lg border p-5"
      >
        <h2 className="text-lg font-semibold">
          Configuração global
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Define como os preços da loja
          são interpretados.
        </p>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            aria-label="Os preços incluem IVA"
            checked={
              storeForm
                .pricesIncludeTax
            }
            disabled={saving !== null}
            onChange={(event) => {
              setStoreForm({
                pricesIncludeTax:
                  event.target
                    .checked,
              })
            }}
            className="mt-1"
          />

          <span>
            <span className="block font-medium">
              Os preços incluem IVA
            </span>

            <span className="block text-sm text-gray-600">
              Quando ativo, o preço
              apresentado ao cliente já
              inclui o imposto.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={saving !== null}
          className="mt-4 rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving === 'store'
            ? 'A guardar...'
            : 'Guardar configuração global'}
        </button>
      </form>

      <form
        onSubmit={saveRegion}
        className="rounded-lg border p-5"
      >
        <h2 className="text-lg font-semibold">
          Portugal Continental
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Região disponível na primeira
          versão do checkout.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              aria-label="Checkout ativo"
              checked={
                regionForm
                  .checkoutEnabled
              }
              disabled={
                saving !== null
              }
              onChange={(
                event,
              ) => {
                setRegionForm(
                  (current) => ({
                    ...current,
                    checkoutEnabled:
                      event.target
                        .checked,
                  }),
                )
              }}
              className="mt-1"
            />

            <span>
              <span className="block font-medium">
                Checkout ativo
              </span>

              <span className="block text-sm text-gray-600">
                Permite encomendas para
                Portugal Continental.
              </span>
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium">
              Taxa de IVA (%)
            </span>

            <input
              type="text"
              inputMode="decimal"
              value={
                regionForm
                  .taxRatePercent
              }
              disabled={
                saving !== null
              }
              onChange={(
                event,
              ) => {
                setRegionForm(
                  (current) => ({
                    ...current,
                    taxRatePercent:
                      event.target
                        .value,
                  }),
                )
              }}
              className="rounded border px-3 py-2"
              placeholder="23.00"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving !== null}
          className="mt-4 rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving === 'region'
            ? 'A guardar...'
            : 'Guardar Portugal Continental'}
        </button>
      </form>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">
            Regras de transporte
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Valores aplicáveis a Portugal
            Continental.
          </p>
        </div>

        {(
          [
            'SMALL',
            'STANDARD',
            'BULKY',
          ] as const
        ).map(
          (shippingClass) => {
            const form =
              shippingForms[
                shippingClass
              ]

            const meta =
              shippingMeta[
                shippingClass
              ]

            const savingKey =
              `shipping-${shippingClass}`

            return (
              <form
                key={
                  shippingClass
                }
                onSubmit={(
                  event,
                ) => {
                  void saveShippingRule(
                    event,
                    shippingClass,
                  )
                }}
                className="rounded-lg border p-5"
              >
                <h3 className="text-lg font-semibold">
                  {meta.title}
                </h3>

                <p className="mt-1 text-sm text-gray-600">
                  {
                    meta.description
                  }
                </p>

                <label className="mt-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Checkout automático — ${meta.title}`}
                    checked={
                      form.checkoutEnabled
                    }
                    disabled={
                      saving !==
                      null
                    }
                    onChange={(
                      event,
                    ) => {
                      updateShippingForm(
                        shippingClass,
                        {
                          checkoutEnabled:
                            event
                              .target
                              .checked,
                        },
                      )
                    }}
                    className="mt-1"
                  />

                  <span>
                    <span className="block font-medium">
                      Checkout
                      automático
                    </span>

                    <span className="block text-sm text-gray-600">
                      Permite
                      calcular
                      automaticamente
                      os portes desta
                      classe.
                    </span>
                  </span>
                </label>

                {shippingClass ===
                'BULKY' ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="font-medium">
                        Portes
                        mínimos (€)
                      </span>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          form.shippingCost
                        }
                        disabled={
                          saving !==
                          null
                        }
                        onChange={(
                          event,
                        ) => {
                          updateShippingForm(
                            shippingClass,
                            {
                              shippingCost:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }}
                        className="rounded border px-3 py-2"
                        placeholder="19.90"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-medium">
                        Portes
                        máximos (€)
                      </span>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          form.maximumShippingCost
                        }
                        disabled={
                          saving !==
                          null
                        }
                        onChange={(
                          event,
                        ) => {
                          updateShippingForm(
                            shippingClass,
                            {
                              maximumShippingCost:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }}
                        className="rounded border px-3 py-2"
                        placeholder="29.90"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="font-medium">
                        Portes (€)
                      </span>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          form.shippingCost
                        }
                        disabled={
                          saving !==
                          null
                        }
                        onChange={(
                          event,
                        ) => {
                          updateShippingForm(
                            shippingClass,
                            {
                              shippingCost:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }}
                        className="rounded border px-3 py-2"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-medium">
                        Portes grátis
                        a partir de
                        (€)
                      </span>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          form.freeShippingThreshold
                        }
                        disabled={
                          saving !==
                          null
                        }
                        onChange={(
                          event,
                        ) => {
                          updateShippingForm(
                            shippingClass,
                            {
                              freeShippingThreshold:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }}
                        className="rounded border px-3 py-2"
                        placeholder="150.00"
                      />
                    </label>
                  </div>
                )}

                {shippingClass ===
                  'BULKY' && (
                  <p className="mt-3 text-sm text-gray-600">
                    Cada produto
                    volumoso continua
                    a precisar da sua
                    tarifa específica
                    dentro deste
                    intervalo.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    saving !== null
                  }
                  className="mt-4 rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ===
                  savingKey
                    ? 'A guardar...'
                    : `Guardar regra ${meta.title}`}
                </button>
              </form>
            )
          },
        )}
      </section>

      <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
        Produtos classificados como
        Pesado, Sob consulta ou Por
        classificar não têm checkout
        automático nesta fase.
      </div>
    </div>
  )
}
