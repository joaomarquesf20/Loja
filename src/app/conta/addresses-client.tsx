'use client'

import {
  type FormEvent,
  useEffect,
  useState,
} from 'react'

type Address = {
  id: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  postalCode: string
  country: string
}

type AddressForm = {
  name: string
  addressLine1: string
  addressLine2: string
  city: string
  postalCode: string
  country: string
}

type AddressesMode =
  | 'loading'
  | 'ready'
  | 'error'

type AddressesResponse = {
  addresses: Address[]
}

type AddressResponse = {
  address: Address
}

const emptyForm: AddressForm = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  country: '',
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isAddress(
  value: unknown,
): value is Address {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.addressLine1 ===
      'string' &&
    (
      value.addressLine2 === null ||
      typeof value.addressLine2 ===
        'string'
    ) &&
    typeof value.city === 'string' &&
    typeof value.postalCode ===
      'string' &&
    typeof value.country === 'string'
  )
}

async function getResponseError(
  response: Response,
) {
  try {
    const body: unknown =
      await response.json()

    if (
      isRecord(body) &&
      typeof body.error === 'string'
    ) {
      return body.error
    }
  } catch {
    // A resposta pode não ter JSON.
  }

  return 'Não foi possível atualizar as moradas'
}

async function parseAddresses(
  response: Response,
): Promise<Address[]> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !Array.isArray(
      body.addresses,
    ) ||
    !body.addresses.every(
      isAddress,
    )
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return (
    body as AddressesResponse
  ).addresses
}

async function parseAddress(
  response: Response,
): Promise<Address> {
  const body: unknown =
    await response.json()

  if (
    !isRecord(body) ||
    !isAddress(body.address)
  ) {
    throw new Error(
      'Resposta inválida do servidor',
    )
  }

  return (
    body as AddressResponse
  ).address
}

async function fetchAddresses() {
  const response = await fetch(
    '/api/addresses',
    {
      method: 'GET',
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error(
      await getResponseError(
        response,
      ),
    )
  }

  return parseAddresses(response)
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  return error instanceof Error
    ? error.message
    : fallback
}

export function AddressesClient() {
  const [mode, setMode] =
    useState<AddressesMode>(
      'loading',
    )

  const [
    addresses,
    setAddresses,
  ] = useState<Address[]>([])

  const [form, setForm] =
    useState<AddressForm>(
      emptyForm,
    )

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null,
  )

  const [
    pendingAction,
    setPendingAction,
  ] = useState<string | null>(
    null,
  )

  const [error, setError] =
    useState<string | null>(
      null,
    )

  const isPending =
    pendingAction !== null

  useEffect(() => {
    let cancelled = false

    async function loadAddresses() {
      setError(null)

      try {
        const nextAddresses =
          await fetchAddresses()

        if (!cancelled) {
          setAddresses(
            nextAddresses,
          )
          setMode('ready')
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              caughtError,
              'Não foi possível carregar as moradas',
            ),
          )

          setMode('error')
        }
      }
    }

    void loadAddresses()

    return () => {
      cancelled = true
    }
  }, [])

  function updateField(
    field: keyof AddressForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function startEditing(
    address: Address,
  ) {
    if (isPending) {
      return
    }

    setError(null)
    setEditingId(address.id)

    setForm({
      name: address.name,
      addressLine1:
        address.addressLine1,
      addressLine2:
        address.addressLine2 ??
        '',
      city: address.city,
      postalCode:
        address.postalCode,
      country: address.country,
    })
  }

  function cancelEditing() {
    if (isPending) {
      return
    }

    setError(null)
    resetForm()
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isPending) {
      return
    }

    const addressId = editingId

    setError(null)
    setPendingAction(
      addressId
        ? `edit:${addressId}`
        : 'create',
    )

    try {
      const response = await fetch(
        '/api/addresses',
        {
          method: addressId
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ...(addressId
              ? {
                  addressId,
                }
              : {}),
            ...form,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
          ),
        )
      }

      const savedAddress =
        await parseAddress(
          response,
        )

      if (addressId) {
        setAddresses(
          (current) =>
            current.map(
              (address) =>
                address.id ===
                addressId
                  ? savedAddress
                  : address,
            ),
        )
      } else {
        setAddresses(
          (current) =>
            [
              ...current,
              savedAddress,
            ].sort((first, second) =>
              first.id.localeCompare(
                second.id,
              ),
            ),
        )
      }

      resetForm()
    } catch (caughtError) {
      setError(
        getErrorMessage(
          caughtError,
          editingId
            ? 'Não foi possível atualizar a morada'
            : 'Não foi possível criar a morada',
        ),
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function deleteAddress(
    address: Address,
  ) {
    if (isPending) {
      return
    }

    const confirmed =
      window.confirm(
        'Queres mesmo apagar esta morada?',
      )

    if (!confirmed) {
      return
    }

    setError(null)
    setPendingAction(
      `delete:${address.id}`,
    )

    try {
      const response = await fetch(
        '/api/addresses',
        {
          method: 'DELETE',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            addressId:
              address.id,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
          ),
        )
      }

      setAddresses(
        (current) =>
          current.filter(
            (currentAddress) =>
              currentAddress.id !==
              address.id,
          ),
      )

      if (
        editingId === address.id
      ) {
        resetForm()
      }
    } catch (caughtError) {
      setError(
        getErrorMessage(
          caughtError,
          'Não foi possível apagar a morada',
        ),
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function retryLoad() {
    if (isPending) {
      return
    }

    setMode('loading')
    setError(null)

    try {
      const nextAddresses =
        await fetchAddresses()

      setAddresses(nextAddresses)
      setMode('ready')
    } catch (caughtError) {
      setError(
        getErrorMessage(
          caughtError,
          'Não foi possível carregar as moradas',
        ),
      )

      setMode('error')
    }
  }

  if (mode === 'loading') {
    return (
      <section className="rounded-xl border p-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A carregar moradas…
        </p>
      </section>
    )
  }

  if (mode === 'error') {
    return (
      <section
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
      >
        <h2 className="font-semibold">
          Não foi possível carregar
          as moradas
        </h2>

        <p className="mt-2 text-sm">
          {error ??
            'Ocorreu um erro ao carregar as moradas.'}
        </p>

        <button
          type="button"
          onClick={() =>
            void retryLoad()
          }
          className="mt-4 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-900 dark:border-red-800 dark:hover:bg-red-950"
        >
          Tentar novamente
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-xl border p-6">
      <h2 className="text-xl font-bold">
        Moradas
      </h2>

      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Gere as moradas associadas
        à tua conta.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {addresses.length ===
        0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-neutral-600 dark:text-neutral-400">
            Ainda não tens moradas
            guardadas.
          </p>
        ) : (
          addresses.map(
            (address) => {
              const isDeleting =
                pendingAction ===
                `delete:${address.id}`

              return (
                <article
                  key={address.id}
                  className="rounded-lg border p-4"
                >
                  <h3 className="font-semibold">
                    {address.name}
                  </h3>

                  <address className="mt-2 not-italic text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                    <div>
                      {
                        address.addressLine1
                      }
                    </div>

                    {address.addressLine2 ? (
                      <div>
                        {
                          address.addressLine2
                        }
                      </div>
                    ) : null}

                    <div>
                      {
                        address.postalCode
                      }{' '}
                      {address.city}
                    </div>

                    <div>
                      {address.country}
                    </div>
                  </address>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        startEditing(
                          address,
                        )
                      }
                      disabled={
                        isPending
                      }
                      className="rounded-lg border px-3 py-2 text-sm font-semibold transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-neutral-900"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteAddress(
                          address,
                        )
                      }
                      disabled={
                        isPending
                      }
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      {isDeleting
                        ? 'A remover…'
                        : 'Remover'}
                    </button>
                  </div>
                </article>
              )
            },
          )
        )}
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="mt-8 border-t pt-6"
      >
        <h3 className="text-lg font-bold">
          {editingId
            ? 'Editar morada'
            : 'Adicionar morada'}
        </h3>

        <fieldset
          disabled={isPending}
          className="mt-5 space-y-4 disabled:opacity-70"
        >
          <div>
            <label
              htmlFor="address-name"
              className="block text-sm font-semibold"
            >
              Nome
            </label>

            <input
              id="address-name"
              type="text"
              autoComplete="name"
              required
              maxLength={120}
              value={form.name}
              onChange={(event) =>
                updateField(
                  'name',
                  event.target.value,
                )
              }
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="address-line-1"
              className="block text-sm font-semibold"
            >
              Morada
            </label>

            <input
              id="address-line-1"
              type="text"
              autoComplete="address-line1"
              required
              maxLength={200}
              value={
                form.addressLine1
              }
              onChange={(event) =>
                updateField(
                  'addressLine1',
                  event.target.value,
                )
              }
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="address-line-2"
              className="block text-sm font-semibold"
            >
              Complemento da morada
              (opcional)
            </label>

            <input
              id="address-line-2"
              type="text"
              autoComplete="address-line2"
              maxLength={200}
              value={
                form.addressLine2
              }
              onChange={(event) =>
                updateField(
                  'addressLine2',
                  event.target.value,
                )
              }
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="address-city"
              className="block text-sm font-semibold"
            >
              Localidade
            </label>

            <input
              id="address-city"
              type="text"
              autoComplete="address-level2"
              required
              maxLength={100}
              value={form.city}
              onChange={(event) =>
                updateField(
                  'city',
                  event.target.value,
                )
              }
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="address-postal-code"
              className="block text-sm font-semibold"
            >
              Código postal
            </label>

            <input
              id="address-postal-code"
              type="text"
              autoComplete="postal-code"
              required
              maxLength={20}
              value={
                form.postalCode
              }
              onChange={(event) =>
                updateField(
                  'postalCode',
                  event.target.value,
                )
              }
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="address-country"
              className="block text-sm font-semibold"
            >
              País
            </label>

            <input
              id="address-country"
              type="text"
              autoComplete="country-name"
              required
              maxLength={100}
              value={form.country}
              onChange={(event) =>
                updateField(
                  'country',
                  event.target.value,
                )
              }
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-neutral-900"
            >
              {isPending
                ? 'A guardar…'
                : editingId
                  ? 'Guardar alterações'
                  : 'Guardar morada'}
            </button>

            {editingId ? (
              <button
                type="button"
                onClick={
                  cancelEditing
                }
                className="rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-neutral-900"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>
        </fieldset>
      </form>
    </section>
  )
}
