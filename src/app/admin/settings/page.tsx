'use client'

import {
  FormEvent,
  useEffect,
  useState,
} from 'react'

import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_STORE_NAME,
} from '@/lib/brand-defaults'

type Branding = {
  storeName: string
  contactEmail: string | null
  contactPhone: string | null
  nif: string | null
  address: string | null
  primaryColorHex: string
  logoUrl: string
}

type RawSettings = {
  storeName: string | null
  contactEmail: string | null
  contactPhone: string | null
  nif: string | null
  address: string | null
  primaryColorHex: string | null
  logoUrl: string | null
} | null

type SettingsPayload = {
  branding: Branding
  raw: RawSettings
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

    if (
      typeof body.error === 'string'
    ) {
      return body.error
    }
  } catch {
    // A resposta pode não conter JSON válido.
  }

  return `Erro no pedido (${response.status})`
}

/**
 * Validação client espelha o contrato Zod do serviço: falha cedo
 * e só chama a API com `storeName` presente + cor/URL plausíveis.
 */
function validateInput(input: {
  storeName: string
  contactEmail: string
  primaryColorHex: string
  logoUrl: string
}) {
  if (!input.storeName.trim()) {
    return 'O nome da loja é obrigatório'
  }

  const email =
    input.contactEmail.trim()

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  ) {
    return 'Email de contacto inválido'
  }

  const color =
    input.primaryColorHex.trim()

  if (
    color &&
    !/^#[0-9a-fA-F]{6}$/.test(color)
  ) {
    return 'A cor da loja deve ser um hex #RRGGBB'
  }

  const logoUrl = input.logoUrl.trim()

  if (
    logoUrl &&
    !/^\/|https?:\/\//.test(logoUrl)
  ) {
    return 'URL do logótipo inválido (caminho /… ou https://…)'
  }

  return null
}

/**
 * Configurações white-label: identidade da loja editável sem
 * tocar no código. Os campos vazios gravam `null` (a vitrine usa
 * os defaults do template; o nome nunca fica vazio — default).
 */
export default function SettingsPage() {
  const [branding, setBranding] = useState<Branding | null>(null)
  const [loading, setLoading] =
    useState(true)
  const [loadError, setLoadError] =
    useState('')
  const [actionError, setActionError] =
    useState('')
  const [savedMessage, setSavedMessage] =
    useState('')
  const [submitting, setSubmitting] =
    useState(false)

  const [storeName, setStoreName] =
    useState('')
  const [contactEmail, setContactEmail] =
    useState('')
  const [contactPhone, setContactPhone] =
    useState('')
  const [nif, setNif] = useState('')
  const [address, setAddress] =
    useState('')
  const [
    primaryColorHex,
    setPrimaryColorHex,
  ] = useState(DEFAULT_PRIMARY_COLOR)
  const [logoUrl, setLogoUrl] =
    useState('')

  function fillForm(
    payload: SettingsPayload,
  ) {
    setStoreName(
      payload.raw?.storeName ??
        DEFAULT_STORE_NAME,
    )
    setContactEmail(
      payload.raw?.contactEmail ?? '',
    )
    setContactPhone(
      payload.raw?.contactPhone ?? '',
    )
    setNif(payload.raw?.nif ?? '')
    setAddress(payload.raw?.address ?? '')
    setPrimaryColorHex(
      payload.raw?.primaryColorHex ??
        DEFAULT_PRIMARY_COLOR,
    )
    setLogoUrl(payload.raw?.logoUrl ?? '')
  }

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadSettings() {
      try {
        setLoading(true)
        setLoadError('')

        const response = await fetch(
          '/api/admin/settings',
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            await getApiError(
              response,
            ),
          )
        }

        const payload =
          (await response.json()) as SettingsPayload

        setBranding(
          payload.branding,
        )
        fillForm(payload)
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
            : 'Não foi possível carregar as configurações da loja',
        )
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      controller.abort()
    }
  }, [])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (submitting) {
      return
    }

    const input = {
      storeName,
      contactEmail,
      primaryColorHex,
      logoUrl,
    }

    const validationError =
      validateInput(input)

    if (validationError) {
      setActionError(
        validationError,
      )
      return
    }

    setSubmitting(true)
    setActionError('')
    setSavedMessage('')

    try {
      const response = await fetch(
        '/api/admin/settings',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            // Campos deixados vazios limpam o valor gravado.
            storeName,
            contactEmail,
            contactPhone,
            nif,
            address,
            primaryColorHex,
            logoUrl,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          await getApiError(
            response,
          ),
        )
      }

      const payload =
        (await response.json()) as {
          branding: Branding
        }

      setBranding(
        payload.branding,
      )
      setSavedMessage(
        'Configurações guardadas. Recarrega a loja para ver a identidade atualizada.',
      )
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar as configurações',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass =
    'w-full rounded-md border px-3 py-2 disabled:opacity-60'

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          Configurações
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Identidade da loja (template white-label): nome, contactos, NIF,
          morada, cor e logótipo. Os campos vazios usam os valores por
          omissão do template.
        </p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-medium">
          Identidade da loja
        </h2>

        {loading && (
          <p className="text-sm text-gray-600">
            A carregar configurações...
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

        {!loading && branding && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="settings-store-name"
                className="mb-1 block text-sm font-medium"
              >
                Nome da loja
              </label>

              <input
                id="settings-store-name"
                type="text"
                value={storeName}
                onChange={(event) =>
                  setStoreName(
                    event.target.value,
                  )
                }
                disabled={submitting}
                required
                maxLength={80}
                className={fieldClass}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="settings-contact-email"
                  className="mb-1 block text-sm font-medium"
                >
                  Email de contacto
                </label>

                <input
                  id="settings-contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) =>
                    setContactEmail(
                      event.target.value,
                    )
                  }
                  disabled={submitting}
                  maxLength={160}
                  className={fieldClass}
                />
              </div>

              <div>
                <label
                  htmlFor="settings-contact-phone"
                  className="mb-1 block text-sm font-medium"
                >
                  Telefone de contacto
                </label>

                <input
                  id="settings-contact-phone"
                  type="text"
                  value={contactPhone}
                  onChange={(event) =>
                    setContactPhone(
                      event.target.value,
                    )
                  }
                  disabled={submitting}
                  maxLength={40}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="settings-nif"
                  className="mb-1 block text-sm font-medium"
                >
                  NIF
                </label>

                <input
                  id="settings-nif"
                  type="text"
                  value={nif}
                  onChange={(event) =>
                    setNif(
                      event.target.value,
                    )
                  }
                  disabled={submitting}
                  maxLength={20}
                  className={fieldClass}
                />
              </div>

              <div>
                <label
                  htmlFor="settings-address"
                  className="mb-1 block text-sm font-medium"
                >
                  Morada
                </label>

                <input
                  id="settings-address"
                  type="text"
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target.value,
                    )
                  }
                  disabled={submitting}
                  maxLength={200}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="settings-primary-color"
                  className="mb-1 block text-sm font-medium"
                >
                  Cor da loja (hex)
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Seletor de cor da loja"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(
                        primaryColorHex,
                      )
                        ? primaryColorHex
                        : DEFAULT_PRIMARY_COLOR
                    }
                    onChange={(event) =>
                      setPrimaryColorHex(
                        event.target.value.toUpperCase(),
                      )
                    }
                    disabled={submitting}
                    className="size-9 cursor-pointer rounded-md border"
                  />

                  <input
                    id="settings-primary-color"
                    type="text"
                    value={
                      primaryColorHex
                    }
                    onChange={(event) =>
                      setPrimaryColorHex(
                        event.target.value,
                      )
                    }
                    disabled={submitting}
                    maxLength={7}
                    placeholder="#ef5b2a"
                    className={
                      fieldClass
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="settings-logo-url"
                  className="mb-1 block text-sm font-medium"
                >
                  URL do logótipo
                </label>

                <input
                  id="settings-logo-url"
                  type="text"
                  value={logoUrl}
                  onChange={(event) =>
                    setLogoUrl(
                      event.target.value,
                    )
                  }
                  disabled={submitting}
                  maxLength={255}
                  placeholder="/brand/logo-horizontal-dark.png"
                  className={
                    fieldClass
                  }
                />
              </div>
            </div>

            {actionError && (
              <p
                role="alert"
                className="text-sm text-red-600"
              >
                {actionError}
              </p>
            )}

            {savedMessage && (
              <p
                role="status"
                className="text-sm text-green-700"
              >
                {savedMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'A guardar...'
                : 'Guardar configurações'}
            </button>
          </form>
        )}
      </section>

      {branding && (
        <section className="mt-6 rounded-lg border p-5">
          <h2 className="mb-2 text-lg font-medium">
            Pré-visualização
          </h2>

          <div className="flex items-center gap-3">
            <span
              className="inline-block size-8 rounded-full"
              style={{
                backgroundColor:
                  branding.primaryColorHex,
              }}
            />

            <span className="text-lg font-black tracking-tight">
              {branding.storeName}
            </span>
          </div>

          {branding.logoUrl && (
            <p className="mt-3 text-sm text-gray-600">
              Logótipo atual:{' '}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                {branding.logoUrl}
              </code>
            </p>
          )}
        </section>
      )}
    </main>
  )
}
